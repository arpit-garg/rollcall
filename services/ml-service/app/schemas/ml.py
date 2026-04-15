from pydantic import BaseModel


class EnrollmentRequest(BaseModel):
    studentId: str
    imageName: str


class EnrollmentResponse(BaseModel):
    status: str
    modelVersion: str


class VerificationRequest(BaseModel):
    studentId: str
    jobId: str
    imageName: str
    similarityThreshold: float
    livenessThreshold: float


class VerificationResponse(BaseModel):
    status: str
    faceScore: float | None
    livenessScore: float | None
