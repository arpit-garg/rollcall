from pydantic import BaseModel, Field, field_validator


def _validate_object_key(value: str, allowed_prefixes: tuple[str, ...], field_name: str) -> str:
    if not value or not isinstance(value, str):
        raise ValueError(f"{field_name} is required")
    if value.startswith("/") or "\\" in value or "//" in value:
        raise ValueError(f"{field_name} is not a valid object key")
    if any(part in {"", ".", ".."} for part in value.split("/")):
        raise ValueError(f"{field_name} is not a valid object key")
    if not any(value.startswith(prefix) for prefix in allowed_prefixes):
        raise ValueError(f"{field_name} must start with one of: {', '.join(allowed_prefixes)}")
    return value


class EnrollmentRequest(BaseModel):
    studentId: str
    imageObjectKey: str

    @field_validator("imageObjectKey")
    @classmethod
    def validate_image_object_key(cls, value: str) -> str:
        return _validate_object_key(value, ("temp/enrollment/",), "imageObjectKey")


class EnrollmentResponse(BaseModel):
    status: str
    modelVersion: str
    embeddingRef: str


class VerificationRequest(BaseModel):
    studentId: str
    jobId: str
    imageObjectKey: str
    templateRef: str
    similarityThreshold: float = Field(ge=0.0, le=1.0)
    livenessThreshold: float = Field(ge=0.0, le=1.0)

    @field_validator("imageObjectKey")
    @classmethod
    def validate_image_object_key(cls, value: str) -> str:
        return _validate_object_key(value, ("temp/verification/",), "imageObjectKey")

    @field_validator("templateRef")
    @classmethod
    def validate_template_ref(cls, value: str) -> str:
        if value.startswith("seed://"):
            if value == "seed://" or any(part in {".", ".."} for part in value.replace("seed://", "").split("/")):
                raise ValueError("templateRef is not a valid seed reference")
            return value
        return _validate_object_key(value, ("templates/",), "templateRef")


class VerificationResponse(BaseModel):
    status: str
    faceScore: float | None
    livenessScore: float | None
