"""
Passive liveness detection using MiniFASNet (Silent-Face-Anti-Spoofing).

Uses two lightweight CNN models:
  - MiniFASNetV2 with crop scale 2.7
  - MiniFASNetV1SE with crop scale 4.0

Each model outputs 3-class logits (real, print-attack, replay-attack).
The "real" probabilities from both models are summed (range 0–2).
A combined score > 1.0 typically indicates a live face.

The score is normalized to 0.0–1.0 for the API response.
"""

import logging
from typing import List, Optional, Tuple

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

    # Model configurations: (factory_fn, weight_path, crop_scale)
    _MODEL_CONFIGS = None  # set in __init__ after settings are available

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

                # Handle state_dict key prefix stripping (some checkpoints
                # wrap keys under 'module.' from DataParallel training)
                first_key = next(iter(state_dict))
                if first_key.startswith("module."):
                    state_dict = {
                        k.replace("module.", "", 1): v
                        for k, v in state_dict.items()
                    }

                model.load_state_dict(state_dict)
                model.eval()
                self.models.append(model)
                self.scales.append(scale)
                logger.info("Loaded anti-spoofing weights: %s (scale=%.1f)", weight_path, scale)
            except Exception as error:
                logger.warning(
                    "Anti-spoofing weights could not be loaded: %s (%s) — this model configuration will be skipped",
                    weight_path,
                    error,
                )

    def _crop_face(
        self,
        image: np.ndarray,
        bbox: List[int],
        scale: float,
    ) -> np.ndarray:
        """Crop face region with a scale factor and resize to 80x80.

        Args:
            image: BGR numpy array of the full image.
            bbox: [x, y, w, h] bounding box of the detected face.
            scale: Expansion factor around the bounding box.

        Returns:
            80x80 BGR numpy array of the cropped face.
        """
        src_h, src_w = image.shape[:2]
        x, y, box_w, box_h = bbox

        # Compute actual scale (clamped to image bounds)
        actual_scale = min(
            (src_h - 1) / max(box_h, 1),
            (src_w - 1) / max(box_w, 1),
            scale,
        )

        new_w = box_w * actual_scale
        new_h = box_h * actual_scale

        center_x = x + box_w / 2
        center_y = y + box_h / 2

        x1 = max(0, int(center_x - new_w / 2))
        y1 = max(0, int(center_y - new_h / 2))
        x2 = min(src_w - 1, int(center_x + new_w / 2))
        y2 = min(src_h - 1, int(center_y + new_h / 2))

        crop = image[y1:y2, x1:x2]

        if crop.size == 0:
            # Fallback: use the original bbox crop
            crop = image[y : y + box_h, x : x + box_w]

        resized = cv2.resize(crop, (80, 80), interpolation=cv2.INTER_LINEAR)
        return resized

    def _preprocess(self, face_crop: np.ndarray) -> torch.Tensor:
        """Convert an 80x80 BGR crop to a model-ready tensor.

        Returns:
            Tensor of shape (1, 3, 80, 80), float32.
        """
        # BGR → RGB, HWC → CHW, normalize to [0, 1]
        rgb = cv2.cvtColor(face_crop, cv2.COLOR_BGR2RGB)
        tensor = torch.from_numpy(rgb.transpose(2, 0, 1)).float() / 255.0
        return tensor.unsqueeze(0).to(_device)

    def predict(self, image: np.ndarray, bbox: List[int]) -> float:
        """Run anti-spoofing on a detected face.

        Args:
            image: Full BGR image.
            bbox: [x, y, w, h] face bounding box.

        Returns:
            Combined "real" probability (sum of softmax[0] from both models).
            Range 0.0–2.0. Values > 1.0 typically indicate a live face.
        """
        combined_score = 0.0

        for model, scale in zip(self.models, self.scales):
            crop = self._crop_face(image, bbox, scale)
            tensor = self._preprocess(crop)

            with torch.no_grad():
                logits = model(tensor)
                probs = F.softmax(logits, dim=1)
                # Class 0 = real, class 1 = print, class 2 = replay
                real_prob = probs[0, 0].item()
                combined_score += real_prob

        return combined_score

    @property
    def is_loaded(self) -> bool:
        """Check if at least one model has loaded weights."""
        return len(self.models) > 0


# Module-level singleton — initialized when the module is first imported.
# Lazy initialization to avoid loading models if liveness is never used.
_anti_spoofing: Optional[AntiSpoofing] = None


def _get_anti_spoofing() -> AntiSpoofing:
    global _anti_spoofing
    if _anti_spoofing is None:
        _anti_spoofing = AntiSpoofing()
    return _anti_spoofing


def check_liveness(image: np.ndarray, bbox: List[int]) -> float:
    """Compute a normalized liveness score for a detected face.

    Args:
        image: Full BGR numpy array.
        bbox: [x, y, w, h] face bounding box from MTCNN.

    Returns:
        Liveness score in range 0.0–1.0.
        Higher values indicate the face is more likely to be real.
    """
    model = _get_anti_spoofing()

    if not model.is_loaded:
        logger.warning("No anti-spoofing models loaded — returning 1.0")
        return 1.0

    # Combined score is in [0, 2] — normalize to [0, 1]
    raw_score = model.predict(image, bbox)
    normalized = min(max(raw_score / 2.0, 0.0), 1.0)

    logger.info("Liveness raw_score=%.4f normalized=%.4f", raw_score, normalized)
    return round(normalized, 4)
