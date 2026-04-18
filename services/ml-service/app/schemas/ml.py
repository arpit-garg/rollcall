from pydantic import BaseModel


class EnrollmentRequest(BaseModel):
    studentId: str
    imageObjectKey: str


class EnrollmentResponse(BaseModel):
    status: str
    modelVersion: str
    embeddingRef: str


class VerificationRequest(BaseModel):
    studentId: str
    jobId: str
    imageObjectKey: str
    templateRef: str
    similarityThreshold: float
    livenessThreshold: float


class VerificationResponse(BaseModel):
    status: str
    faceScore: float | None
    livenessScore: float | None
