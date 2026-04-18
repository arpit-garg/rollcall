from fastapi import APIRouter

from app.core.config import settings
from app.schemas.ml import (
    EnrollmentRequest,
    EnrollmentResponse,
    VerificationRequest,
    VerificationResponse,
)

router = APIRouter()


@router.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": settings.service_name,
        "thresholds": {
            "faceSimilarity": settings.similarity_threshold,
            "liveness": settings.liveness_threshold,
        },
    }


@router.post("/api/v1/internal/enroll", response_model=EnrollmentResponse)
def enroll(payload: EnrollmentRequest) -> EnrollmentResponse:
    _ = payload
    return EnrollmentResponse(status="queued", modelVersion="facenet-v1")


@router.post("/api/v1/internal/verify", response_model=VerificationResponse)
def verify(request: VerificationRequest) -> VerificationResponse:
    image_name = request.imageName.lower()

    if "spoof" in image_name or "photo" in image_name:
        return VerificationResponse(
            status="failed",
            faceScore=0.61,
            livenessScore=0.22,
        )

    if "mismatch" in image_name:
        return VerificationResponse(
            status="failed",
            faceScore=0.58,
            livenessScore=0.95,
        )

    base_face_score = max(request.similarityThreshold + 0.08, 0.83)
    base_liveness_score = max(request.livenessThreshold + 0.1, 0.9)

    return VerificationResponse(
        status="verified",
        faceScore=round(base_face_score, 4),
        livenessScore=round(base_liveness_score, 4),
    )
