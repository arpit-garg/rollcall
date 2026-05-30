import os

from pydantic import BaseModel


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _bounded_float(name: str, default: str) -> float:
    value = float(os.getenv(name, default))
    if value < 0.0 or value > 1.0:
        raise ValueError(f"{name} must be between 0.0 and 1.0")
    return value


class Settings(BaseModel):
    service_name: str = "ml-service"
    environment: str = os.getenv("APP_ENV", os.getenv("ENVIRONMENT", "production")).strip().lower()
    similarity_threshold: float = _bounded_float("FACE_SIMILARITY_THRESHOLD", "0.75")
    liveness_threshold: float = _bounded_float("LIVENESS_THRESHOLD", "0.80")
    minio_endpoint: str = os.getenv("MINIO_ENDPOINT", "minio:9000")
    minio_access_key: str = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
    minio_secret_key: str = os.getenv("MINIO_SECRET_KEY", "minioadmin")
    minio_bucket: str = os.getenv("MINIO_BUCKET", "face-templates")
    fasnet_v2_weights: str = os.getenv("FASNET_V2_WEIGHTS", "/app/weights/MiniFASNetV2.pth")
    fasnet_v1se_weights: str = os.getenv("FASNET_V1SE_WEIGHTS", "/app/weights/MiniFASNetV1SE.pth")
    allow_demo_bypass: bool = _env_bool("ML_ALLOW_DEMO_BYPASS", False)
    require_all_liveness_models: bool = _env_bool("REQUIRE_ALL_LIVENESS_MODELS", True)
    required_liveness_model_count: int = 2

    @property
    def is_demo_bypass_enabled(self) -> bool:
        return self.allow_demo_bypass and self.environment not in {"prod", "production"}


settings = Settings()
