"""
Passive liveness detection using MiniFASNet (Silent-Face-Anti-Spoofing).

Uses two lightweight CNN models:
  - MiniFASNetV2 with crop scale 2.7
  - MiniFASNetV1SE with crop scale 4.0

Each model outputs 3-class logits where class index 1 is the real-face
class. Real probabilities from loaded models are summed and normalized to
0.0-1.0 for the API response. Missing required models fail closed.
"""

import logging
from typing import List, Optional

import cv2
import numpy as np
import torch
import torch.nn.functional as F

from app.core.config import settings
from app.core.fasnet_backbone import MiniFASNetV1SE, MiniFASNetV2

logger = logging.getLogger(__name__)

_device = torch.device("cuda" if torch.cuda.is_available() else "cpu")


class AntiSpoofing:
    """Dual-model MiniFASNet anti-spoofing classifier."""

    def __init__(self) -> None:
        configs = [
            (MiniFASNetV2, settings.fasnet_v2_weights, 2.7),
            (MiniFASNetV1SE, settings.fasnet_v1se_weights, 4.0),
        ]

        self.models: list = []
        self.scales: List[float] = []

        for factory_fn, weight_path, scale in configs:
            model = factory_fn(conv6_kernel=(5, 5))
            model = model.to(_device)

            try:
                state_dict = torch.load(weight_path, map_location=_device, weights_only=False)

                # Some checkpoints wrap keys under "module." from DataParallel training.
                first_key = next(iter(state_dict))
                if first_key.startswith("module."):
                    state_dict = {k.replace("module.", "", 1): v for k, v in state_dict.items()}

                model.load_state_dict(state_dict)
                model.eval()
                self.models.append(model)
                self.scales.append(scale)
                logger.info("Loaded anti-spoofing weights: %s (scale=%.1f)", weight_path, scale)
            except Exception as error:
                logger.warning(
                    "Anti-spoofing weights could not be loaded: %s (%s); this model configuration will be skipped",
                    weight_path,
                    error,
                )

    def _crop_face(
        self,
        image: np.ndarray,
        bbox: List[int],
        scale: float,
    ) -> np.ndarray:
        """Crop face region with a scale factor and resize to 80x80."""
        src_h, src_w = image.shape[:2]
        x, y, box_w, box_h = bbox

        actual_scale = min(
            (src_h - 1) / max(box_h, 1),
            (src_w - 1) / max(box_w, 1),
            scale,
        )

        new_w = box_w * actual_scale
        new_h = box_h * actual_scale

        center_x = x + box_w / 2
        center_y = y + box_h / 2

        x1 = center_x - new_w / 2
        y1 = center_y - new_h / 2
        x2 = center_x + new_w / 2
        y2 = center_y + new_h / 2

        if x1 < 0:
            x2 -= x1
            x1 = 0
        if y1 < 0:
            y2 -= y1
            y1 = 0
        if x2 > src_w - 1:
            x1 -= x2 - src_w + 1
            x2 = src_w - 1
        if y2 > src_h - 1:
            y1 -= y2 - src_h + 1
            y2 = src_h - 1

        x1 = max(0, int(x1))
        y1 = max(0, int(y1))
        x2 = min(src_w - 1, int(x2))
        y2 = min(src_h - 1, int(y2))

        crop = image[y1 : y2 + 1, x1 : x2 + 1]

        if crop.size == 0:
            crop = image[y : y + box_h, x : x + box_w]

        return cv2.resize(crop, (80, 80), interpolation=cv2.INTER_LINEAR)

    def _preprocess(self, face_crop: np.ndarray) -> torch.Tensor:
        """Convert an 80x80 OpenCV BGR crop to the model's raw tensor format."""
        tensor = torch.from_numpy(face_crop.transpose(2, 0, 1)).float()
        return tensor.unsqueeze(0).to(_device)

    def predict(self, image: np.ndarray, bbox: List[int]) -> float:
        """Run anti-spoofing on a detected face."""
        combined_score = 0.0

        for model, scale in zip(self.models, self.scales):
            crop = self._crop_face(image, bbox, scale)
            tensor = self._preprocess(crop)

            with torch.no_grad():
                logits = model(tensor)
                probs = F.softmax(logits, dim=1)
                combined_score += probs[0, 1].item()

        return combined_score

    @property
    def is_loaded(self) -> bool:
        """Check if at least one model has loaded weights."""
        return len(self.models) > 0

    @property
    def loaded_model_count(self) -> int:
        return len(self.models)


_anti_spoofing: Optional[AntiSpoofing] = None


def _get_anti_spoofing() -> AntiSpoofing:
    global _anti_spoofing
    if _anti_spoofing is None:
        _anti_spoofing = AntiSpoofing()
    return _anti_spoofing


def check_liveness(image: np.ndarray, bbox: List[int]) -> float:
    """Compute a normalized liveness score for a detected face."""
    model = _get_anti_spoofing()

    if not model.is_loaded:
        logger.warning("No anti-spoofing models loaded; failing liveness closed")
        return 0.0

    loaded_model_count = len(getattr(model, "models", []))
    required_model_count = getattr(settings, "required_liveness_model_count", 2)
    if getattr(settings, "require_all_liveness_models", True) and loaded_model_count < required_model_count:
        logger.warning(
            "Only %d/%d anti-spoofing models loaded; failing liveness closed",
            loaded_model_count,
            required_model_count,
        )
        return 0.0

    raw_score = model.predict(image, bbox)
    normalized = min(max(raw_score / max(loaded_model_count, 1), 0.0), 1.0)

    logger.info("Liveness raw_score=%.4f normalized=%.4f", raw_score, normalized)
    return round(normalized, 4)


def is_liveness_ready() -> bool:
    """Return whether liveness has enough loaded models for the current policy."""
    model = _get_anti_spoofing()
    loaded_model_count = len(getattr(model, "models", []))
    if loaded_model_count == 0:
        return False
    if getattr(settings, "require_all_liveness_models", True):
        return loaded_model_count >= getattr(settings, "required_liveness_model_count", 2)
    return True
