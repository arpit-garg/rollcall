import io
import json
import os
from datetime import datetime, timezone

from minio import Minio
from minio.error import S3Error

from app.core.config import settings


def _parse_endpoint(endpoint: str) -> tuple[str, bool]:
    if endpoint.startswith("http://"):
        return endpoint.replace("http://", "", 1), False
    if endpoint.startswith("https://"):
        return endpoint.replace("https://", "", 1), True
    return endpoint, False


_endpoint, _secure = _parse_endpoint(settings.minio_endpoint)
client = Minio(
    _endpoint,
    access_key=settings.minio_access_key,
    secret_key=settings.minio_secret_key,
    secure=_secure,
)


def ensure_bucket() -> None:
    if not client.bucket_exists(settings.minio_bucket):
        client.make_bucket(settings.minio_bucket)


def read_object_bytes(object_key: str) -> bytes:
    ensure_bucket()
    response = client.get_object(settings.minio_bucket, object_key)
    try:
        return response.read()
    finally:
        response.close()
        response.release_conn()


def put_template_object(student_id: str, payload: dict) -> str:
    ensure_bucket()
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    object_key = f"templates/{student_id}/{timestamp}.json"
    data = json.dumps(payload).encode("utf-8")
    client.put_object(
        settings.minio_bucket,
        object_key,
        io.BytesIO(data),
        len(data),
        content_type="application/json",
    )
    return object_key


def remove_object_if_exists(object_key: str) -> None:
    ensure_bucket()
    try:
        client.remove_object(settings.minio_bucket, object_key)
    except S3Error as error:
        if error.code != "NoSuchKey":
            raise


def object_exists(object_key: str) -> bool:
    ensure_bucket()
    try:
        client.stat_object(settings.minio_bucket, object_key)
        return True
    except S3Error as error:
        if error.code == "NoSuchKey":
            return False
        raise
