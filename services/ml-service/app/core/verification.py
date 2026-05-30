"""
Face verification using FaceNet-512.

Provides functions to:
- Compute 512-dim L2-normalized face embeddings
- Compare embeddings via cosine similarity
- End-to-end image → embedding pipeline
"""

import logging
from typing import Optional

import numpy as np
import torch
from facenet_pytorch import InceptionResnetV1

from app.core.face_detection import get_face_tensor

logger = logging.getLogger(__name__)

# Load FaceNet-512 model once at module level (singleton)
_device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
_resnet = InceptionResnetV1(pretrained="vggface2").eval().to(_device)

logger.info("FaceNet-512 model loaded (device=%s)", _device)


def validate_embedding(embedding: np.ndarray | None) -> np.ndarray | None:
    """Return a finite 512-dimensional embedding array, or None if invalid."""
    if embedding is None:
        return None
    try:
        array = np.asarray(embedding, dtype=np.float32)
    except (TypeError, ValueError):
        return None
    if array.shape != (512,) or not np.all(np.isfinite(array)):
        return None
    if np.linalg.norm(array) <= 0:
        return None
    return array


def compute_embedding(face_tensor: torch.Tensor) -> np.ndarray:
    """Compute a 512-dim L2-normalized embedding from an MTCNN-aligned face tensor.

    Args:
        face_tensor: A (3, 160, 160) float tensor (normalized to [-1, 1]).

    Returns:
        A (512,) float32 numpy array, L2-normalized.
    """
    with torch.no_grad():
        # Add batch dimension: (3, 160, 160) → (1, 3, 160, 160)
        batch = face_tensor.unsqueeze(0).to(_device)
        emb = _resnet(batch)  # (1, 512)

    vec = emb.squeeze().cpu().numpy()
    # L2 normalize
    vec = vec / (np.linalg.norm(vec) + 1e-10)
    valid_embedding = validate_embedding(vec)
    if valid_embedding is None:
        raise ValueError("FaceNet produced an invalid embedding")
    return valid_embedding


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Compute cosine similarity between two L2-normalized embeddings.

    Args:
        a: First embedding (512,).
        b: Second embedding (512,).

    Returns:
        Similarity score in range [0.0, 1.0]. Higher = more similar.
        (Technically cosine similarity is [-1, 1] but for L2-normalized
        face embeddings it's practically always [0, 1].)
    """
    valid_a = validate_embedding(a)
    valid_b = validate_embedding(b)
    if valid_a is None or valid_b is None:
        raise ValueError("cosine_similarity requires finite 512-dimensional embeddings")

    sim = float(np.dot(valid_a, valid_b) / (np.linalg.norm(valid_a) * np.linalg.norm(valid_b) + 1e-10))
    # Clamp to [0, 1] for safety
    return max(0.0, min(1.0, sim))


def image_to_embedding(image_bytes: bytes) -> Optional[np.ndarray]:
    """End-to-end: raw image bytes → 512-dim FaceNet embedding.

    Uses MTCNN to detect and align the face, then FaceNet to embed it.

    Args:
        image_bytes: Raw image file bytes (JPEG/PNG).

    Returns:
        A (512,) float32 numpy array, or None if no face detected.
    """
    face_tensor = get_face_tensor(image_bytes)
    if face_tensor is None:
        return None

    embedding = compute_embedding(face_tensor)
    logger.info("Computed FaceNet embedding: shape=%s, norm=%.4f", embedding.shape, np.linalg.norm(embedding))
    return embedding
