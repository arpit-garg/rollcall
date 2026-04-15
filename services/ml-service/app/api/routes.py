from fastapi import APIRouter

from app.core.settings import settings
from app.schemas.verification import VerificationRequest, VerificationResponse

router = APIRouter()


@router.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": "ml-service",
        "thresholds": {
            "faceSimilarity": settings.face_similarity_threshold,
            "liveness": settings.liveness_threshold,
        },
    }


@router.post("/internal/verify", response_model=VerificationResponse)
def verify(request: VerificationRequest) -> VerificationResponse:
    base_face_score = max(request.faceSimilarityThreshold + 0.08, 0.83)
    base_liveness_score = max(request.livenessThreshold + 0.07, 0.87)

    if request.imageSizeBytes < 50_000:
        return VerificationResponse(
            status="failed",
            faceScore=round(request.faceSimilarityThreshold - 0.04, 4),
            livenessScore=round(request.livenessThreshold - 0.12, 4),
        )

    return VerificationResponse(
        status="verified",
        faceScore=round(base_face_score, 4),
        livenessScore=round(base_liveness_score, 4),
    )
