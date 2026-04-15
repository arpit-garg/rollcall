from pydantic import BaseModel


class Settings(BaseModel):
    service_name: str = "ml-service"
    similarity_threshold: float = 0.75
    liveness_threshold: float = 0.80


settings = Settings()
