import os

from pydantic import BaseModel


class Settings(BaseModel):
    service_name: str = "ml-service"
    similarity_threshold: float = float(os.getenv("FACE_SIMILARITY_THRESHOLD", "0.75"))
    liveness_threshold: float = float(os.getenv("LIVENESS_THRESHOLD", "0.80"))
    minio_endpoint: str = os.getenv("MINIO_ENDPOINT", "minio:9000")
    minio_access_key: str = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
    minio_secret_key: str = os.getenv("MINIO_SECRET_KEY", "minioadmin")
    minio_bucket: str = os.getenv("MINIO_BUCKET", "face-templates")


settings = Settings()
