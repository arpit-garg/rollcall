"""
Face detection using MTCNN from facenet-pytorch.

Provides two functions:
- detect_face(): returns the full image + bounding box [x, y, w, h] for MiniFASNet
- get_face_tensor(): returns the 3x160x160 MTCNN-aligned face tensor for FaceNet

MTCNN is initialized once at module load (singleton pattern) to avoid
re-creating the model on every request.
"""

import logging
from typing import List, Optional, Tuple

import cv2
import numpy as np
import torch
from PIL import Image
from facenet_pytorch import MTCNN

logger = logging.getLogger(__name__)

# Initialize MTCNN once (singleton)
# image_size=160 matches FaceNet's expected input
# margin=20 adds slight padding around detected faces
_device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
_mtcnn = MTCNN(
    image_size=160,
    margin=20,
    device=_device,
    post_process=True,  # normalize to [-1, 1] for FaceNet
)

# A separate MTCNN instance for bounding box detection only
_mtcnn_detect = MTCNN(
    image_size=160,
    margin=0,
    keep_all=False,
    device=_device,
    post_process=False,
)


def _decode_image(image_bytes: bytes) -> np.ndarray:
    """Decode raw image bytes to a BGR numpy array."""
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Failed to decode image bytes")
    return img


def detect_face(
    image_bytes: bytes,
) -> Optional[Tuple[np.ndarray, List[int]]]:
    """Detect the primary face in an image.

    Args:
        image_bytes: Raw image file bytes (JPEG/PNG).

    Returns:
        Tuple of (bgr_frame, [x, y, w, h]) if a face is found, else None.
        The bbox is in pixel coordinates on the original image.
    """
    bgr = _decode_image(image_bytes)
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    pil_img = Image.fromarray(rgb)

    # Detect bounding boxes: returns (boxes, probs) or (None, None)
    boxes, probs = _mtcnn_detect.detect(pil_img)

    if boxes is None or len(boxes) == 0:
        logger.info("No face detected in image")
        return None

    # Take the highest-confidence detection
    best_idx = int(np.argmax(probs))
    x1, y1, x2, y2 = boxes[best_idx]

    # Convert to [x, y, w, h] format (integers, clipped to image bounds)
    h, w = bgr.shape[:2]
    x = max(0, int(x1))
    y = max(0, int(y1))
    bw = min(w - x, int(x2 - x1))
    bh = min(h - y, int(y2 - y1))

    if bw <= 0 or bh <= 0:
        logger.info("Detected face has invalid bbox dimensions")
        return None

    logger.info("Face detected: bbox=[%d, %d, %d, %d] conf=%.3f", x, y, bw, bh, probs[best_idx])
    return bgr, [x, y, bw, bh]


def get_face_tensor(
    image_bytes: bytes,
) -> Optional[torch.Tensor]:
    """Extract a 3x160x160 MTCNN-aligned face tensor for FaceNet.

    Args:
        image_bytes: Raw image file bytes (JPEG/PNG).

    Returns:
        A (3, 160, 160) float tensor normalized to [-1, 1], or None if no face found.
    """
    bgr = _decode_image(image_bytes)
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    pil_img = Image.fromarray(rgb)

    # MTCNN returns a 3x160x160 tensor or None
    face_tensor = _mtcnn(pil_img)
    if face_tensor is None:
        logger.info("MTCNN could not extract aligned face tensor")
    return face_tensor
