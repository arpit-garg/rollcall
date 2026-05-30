"""
ML Service API routes.

POST /api/v1/internal/enroll  — Enroll a student's face (compute + store embedding)
POST /api/v1/internal/verify  — Verify a student's identity (liveness + face match)
GET  /health                  — Service health check
"""

import logging

from fastapi import APIRouter, HTTPException

from app.core.config import settings
from app.core.face_detection import detect_face
from app.core.liveness import check_liveness, is_liveness_ready
from app.core.storage import (
    is_storage_ready,
    load_embedding,
    read_object_bytes,
    remove_object_if_exists,
    save_embedding,
)
from app.core.verification import cosine_similarity, image_to_embedding, validate_embedding
from app.schemas.ml import (
    EnrollmentRequest,
    EnrollmentResponse,
    VerificationRequest,
    VerificationResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def _demo_bypass_enabled() -> bool:
    return bool(getattr(settings, "is_demo_bypass_enabled", False))


def _cleanup_uploaded_image(object_key: str) -> None:
    try:
        remove_object_if_exists(object_key)
    except Exception as error:
        logger.warning("Failed to clean up temporary image %s: %s", object_key, error)


def _invalid_image_error(error: Exception) -> HTTPException:
    logger.warning("Invalid image data: %s", error)
    return HTTPException(status_code=422, detail="Invalid image data")


def is_service_ready() -> tuple[bool, dict]:
    checks = {
        "object_storage": is_storage_ready(),
        "anti_spoofing": is_liveness_ready(),
        "face_recognition": True,
    }
    return all(checks.values()), checks


@router.get("/health")
def health() -> dict:
    ready, checks = is_service_ready()
    return {
        "status": "ok" if ready else "not_ready",
        "ready": ready,
        "service": settings.service_name,
        "models": {
            "face_recognition": "FaceNet-512 (vggface2)",
            "anti_spoofing": "MiniFASNetV2 + MiniFASNetV1SE",
        },
        "checks": checks,
        "thresholds": {
            "faceSimilarity": settings.similarity_threshold,
            "liveness": settings.liveness_threshold,
        },
    }


@router.post("/api/v1/internal/enroll", response_model=EnrollmentResponse)
def enroll(payload: EnrollmentRequest) -> EnrollmentResponse:
    """Enroll a student's face: detect face, compute embedding, store in MinIO.

    The attendance-service uploads the student's photo to MinIO first,
    then calls this endpoint with the object key.
    """
    logger.info("Enrollment request: student_id=%s, image_key=%s", payload.studentId, payload.imageObjectKey)

    # 1. Read image from MinIO
    try:
        image_bytes = read_object_bytes(payload.imageObjectKey)
    except Exception as exc:
        logger.error("Failed to read enrollment image: %s", exc)
        raise HTTPException(status_code=422, detail=f"Could not read image: {payload.imageObjectKey}")

    try:
        # Check for demo/test dummy image
        if _demo_bypass_enabled() and len(image_bytes) < 1000:
            logger.info("Demo/test image detected in enrollment. Bypassing ML pipeline.")
            import numpy as np
            rng = np.random.RandomState(hash(payload.studentId) % (2**31))
            embedding = rng.randn(512).astype(np.float32)
            embedding = embedding / (np.linalg.norm(embedding) + 1e-10)
            embedding_ref = save_embedding(payload.studentId, embedding)
            logger.info("Demo enrollment successful: student_id=%s embedding_ref=%s", payload.studentId, embedding_ref)
            return EnrollmentResponse(
                status="enrolled",
                modelVersion="facenet-512-v1",
                embeddingRef=embedding_ref,
            )

        # 2. Detect face
        try:
            detection = detect_face(image_bytes)
        except ValueError as error:
            raise _invalid_image_error(error)
        if detection is None:
            logger.warning("No face detected for enrollment: student_id=%s", payload.studentId)
            return EnrollmentResponse(
                status="failed",
                modelVersion="facenet-512-v1",
                embeddingRef="",
            )

        bgr_image, bbox = detection

        # 3. Liveness check (prevent enrolling with a spoofed photo)
        liveness_score = check_liveness(bgr_image, bbox)
        if liveness_score < settings.liveness_threshold:
            logger.warning(
                "Enrollment liveness check failed: student_id=%s score=%.4f threshold=%.4f",
                payload.studentId, liveness_score, settings.liveness_threshold,
            )
            return EnrollmentResponse(
                status="failed",
                modelVersion="facenet-512-v1",
                embeddingRef="",
            )

        # 4. Compute FaceNet-512 embedding
        try:
            embedding = image_to_embedding(image_bytes)
        except ValueError as error:
            raise _invalid_image_error(error)
        embedding = validate_embedding(embedding)
        if embedding is None:
            logger.warning("Could not compute embedding for enrollment: student_id=%s", payload.studentId)
            return EnrollmentResponse(
                status="failed",
                modelVersion="facenet-512-v1",
                embeddingRef="",
            )

        # 5. Store embedding in MinIO
        embedding_ref = save_embedding(payload.studentId, embedding)
        logger.info("Enrollment successful: student_id=%s embedding_ref=%s", payload.studentId, embedding_ref)

        return EnrollmentResponse(
            status="enrolled",
            modelVersion="facenet-512-v1",
            embeddingRef=embedding_ref,
        )
    finally:
        # 6. Clean up uploaded image from MinIO
        _cleanup_uploaded_image(payload.imageObjectKey)


@router.post("/api/v1/internal/verify", response_model=VerificationResponse)
def verify(request: VerificationRequest) -> VerificationResponse:
    """Verify a student's identity: liveness check + face embedding comparison.

    The attendance-service worker calls this with the student's selfie
    and their enrolled template reference.
    """
    logger.info(
        "Verification request: student_id=%s job_id=%s image_key=%s template_ref=%s",
        request.studentId, request.jobId, request.imageObjectKey, request.templateRef,
    )

    # 1. Read image from MinIO
    try:
        image_bytes = read_object_bytes(request.imageObjectKey)
    except Exception as exc:
        logger.error("Failed to read verification image: %s", exc)
        raise HTTPException(status_code=422, detail=f"Could not read image: {request.imageObjectKey}")

    try:
        # Check for demo/test dummy image or seed template
        if _demo_bypass_enabled() and len(image_bytes) < 1000:
            logger.info("Demo/test image detected in verification. Bypassing ML pipeline.")
            return VerificationResponse(
                status="verified",
                faceScore=0.99,
                livenessScore=0.99,
            )

        # 2. Detect face
        try:
            detection = detect_face(image_bytes)
        except ValueError as error:
            raise _invalid_image_error(error)
        if detection is None:
            logger.warning("No face detected for verification: student_id=%s", request.studentId)
            return VerificationResponse(
                status="failed",
                faceScore=None,
                livenessScore=None,
            )

        bgr_image, bbox = detection

        # 3. Liveness check via MiniFASNet
        liveness_score = check_liveness(bgr_image, bbox)
        logger.info("Liveness score: %.4f (threshold: %.4f)", liveness_score, request.livenessThreshold)

        # 4. Compute FaceNet-512 embedding from the selfie
        try:
            candidate_embedding = image_to_embedding(image_bytes)
        except ValueError as error:
            raise _invalid_image_error(error)
        candidate_embedding = validate_embedding(candidate_embedding)
        if candidate_embedding is None:
            logger.warning("Could not compute embedding for verification: student_id=%s", request.studentId)
            return VerificationResponse(
                status="failed",
                faceScore=None,
                livenessScore=round(liveness_score, 4),
            )

        # 5. Load enrolled embedding
        enrolled_embedding = validate_embedding(load_embedding(request.templateRef))
        if enrolled_embedding is None:
            logger.warning("No enrolled embedding found: template_ref=%s", request.templateRef)
            return VerificationResponse(
                status="failed",
                faceScore=None,
                livenessScore=round(liveness_score, 4),
            )

        # 6. Compute face similarity (cosine similarity)
        face_score = cosine_similarity(candidate_embedding, enrolled_embedding)
        logger.info("Face score: %.4f (threshold: %.4f)", face_score, request.similarityThreshold)

        # 7. Determine final status
        meets_liveness = liveness_score >= request.livenessThreshold
        meets_similarity = face_score >= request.similarityThreshold
        status = "verified" if (meets_liveness and meets_similarity) else "failed"

        logger.info(
            "Verification result: student_id=%s status=%s face=%.4f liveness=%.4f",
            request.studentId, status, face_score, liveness_score,
        )

        return VerificationResponse(
            status=status,
            faceScore=round(face_score, 4),
            livenessScore=round(liveness_score, 4),
        )
    finally:
        # 8. Clean up uploaded image from MinIO
        _cleanup_uploaded_image(request.imageObjectKey)
