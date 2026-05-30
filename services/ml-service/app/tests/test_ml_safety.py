import io
import re
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
import torch
from fastapi import HTTPException
from pydantic import ValidationError


SERVICE_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = SERVICE_ROOT.parents[1]
sys.path.insert(0, str(SERVICE_ROOT))


class FakeS3Error(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


class FakeResponse:
    def __init__(self, data: bytes) -> None:
        self._data = data

    def read(self) -> bytes:
        return self._data

    def close(self) -> None:
        pass

    def release_conn(self) -> None:
        pass


class FakeMinio:
    def __init__(self, *args, **kwargs) -> None:
        self.objects = {}
        self.removed = []

    def bucket_exists(self, bucket: str) -> bool:
        return True

    def make_bucket(self, bucket: str) -> None:
        pass

    def get_object(self, bucket: str, object_key: str) -> FakeResponse:
        if object_key not in self.objects:
            raise FakeS3Error("NoSuchKey")
        return FakeResponse(self.objects[object_key])

    def put_object(self, bucket: str, object_key: str, data, length: int, content_type=None) -> None:
        self.objects[object_key] = data.read()

    def remove_object(self, bucket: str, object_key: str) -> None:
        self.removed.append(object_key)

    def stat_object(self, bucket: str, object_key: str) -> None:
        if object_key not in self.objects:
            raise FakeS3Error("NoSuchKey")


class FakeMTCNN:
    def __init__(self, *args, **kwargs) -> None:
        pass

    def detect(self, image):
        return None, None

    def __call__(self, image):
        return None


class FakeFaceNet:
    def __init__(self, *args, **kwargs) -> None:
        pass

    def eval(self):
        return self

    def to(self, device):
        return self


minio_module = types.ModuleType("minio")
minio_module.Minio = FakeMinio
minio_error_module = types.ModuleType("minio.error")
minio_error_module.S3Error = FakeS3Error
sys.modules.setdefault("minio", minio_module)
sys.modules.setdefault("minio.error", minio_error_module)

facenet_module = types.ModuleType("facenet_pytorch")
facenet_module.MTCNN = FakeMTCNN
facenet_module.InceptionResnetV1 = FakeFaceNet
sys.modules.setdefault("facenet_pytorch", facenet_module)


from app.api import routes  # noqa: E402
from app.core.fasnet_backbone import MiniFASNetV1SE, MiniFASNetV2  # noqa: E402
from app.core import liveness, storage  # noqa: E402
from app.schemas.ml import EnrollmentRequest, VerificationRequest  # noqa: E402


def verification_request(**overrides) -> VerificationRequest:
    data = {
        "studentId": "student-1",
        "jobId": "job-1",
        "imageObjectKey": "temp/verification/student-1/selfie.jpg",
        "templateRef": "templates/student-1/embedding.npy",
        "similarityThreshold": 0.75,
        "livenessThreshold": 0.8,
    }
    data.update(overrides)
    return VerificationRequest(**data)


class MlRouteSafetyTests(unittest.TestCase):
    def test_tiny_verification_image_does_not_bypass_when_demo_disabled(self) -> None:
        request = verification_request()

        with (
            patch.object(routes, "read_object_bytes", return_value=b"x"),
            patch.object(routes, "detect_face", return_value=None),
            patch.object(routes, "remove_object_if_exists", return_value=None),
        ):
            response = routes.verify(request)

        self.assertEqual("failed", response.status)
        self.assertIsNone(response.faceScore)

    def test_seed_template_does_not_auto_verify(self) -> None:
        request = verification_request(templateRef="seed://student-1")
        frame = np.zeros((80, 80, 3), dtype=np.uint8)

        with (
            patch.object(routes, "read_object_bytes", return_value=b"x" * 1000),
            patch.object(routes, "detect_face", return_value=(frame, [1, 1, 20, 20])),
            patch.object(routes, "check_liveness", return_value=0.95),
            patch.object(routes, "image_to_embedding", return_value=np.ones(512, dtype=np.float32)),
            patch.object(routes, "load_embedding", return_value=None),
            patch.object(routes, "remove_object_if_exists", return_value=None),
        ):
            response = routes.verify(request)

        self.assertEqual("failed", response.status)
        self.assertIsNone(response.faceScore)

    def test_thresholds_are_bounded(self) -> None:
        with self.assertRaises(ValidationError):
            verification_request(similarityThreshold=1.01)

        with self.assertRaises(ValidationError):
            verification_request(livenessThreshold=-0.01)

    def test_object_keys_are_restricted_to_expected_prefixes(self) -> None:
        with self.assertRaises(ValidationError):
            EnrollmentRequest(studentId="student-1", imageObjectKey="templates/student-1/embedding.npy")

        with self.assertRaises(ValidationError):
            verification_request(imageObjectKey="../secrets.env")

        with self.assertRaises(ValidationError):
            verification_request(templateRef="temp/verification/student-1/selfie.jpg")

    def test_cleanup_failure_does_not_override_successful_response(self) -> None:
        request = verification_request()

        with (
            patch.object(routes, "read_object_bytes", return_value=b"x" * 1000),
            patch.object(routes, "detect_face", return_value=None),
            patch.object(routes, "remove_object_if_exists", side_effect=RuntimeError("cleanup failed")),
        ):
            response = routes.verify(request)

        self.assertEqual("failed", response.status)

    def test_corrupt_image_returns_422(self) -> None:
        request = verification_request()

        with (
            patch.object(routes, "read_object_bytes", return_value=b"x" * 1000),
            patch.object(routes, "detect_face", side_effect=ValueError("Failed to decode image bytes")),
            patch.object(routes, "remove_object_if_exists", return_value=None),
        ):
            with self.assertRaises(HTTPException) as raised:
                routes.verify(request)

        self.assertEqual(422, raised.exception.status_code)

    def test_invalid_embedding_shape_fails_closed(self) -> None:
        request = verification_request()
        frame = np.zeros((80, 80, 3), dtype=np.uint8)

        with (
            patch.object(routes, "read_object_bytes", return_value=b"x" * 1000),
            patch.object(routes, "detect_face", return_value=(frame, [1, 1, 20, 20])),
            patch.object(routes, "check_liveness", return_value=0.95),
            patch.object(routes, "image_to_embedding", return_value=np.ones(512, dtype=np.float32)),
            patch.object(routes, "load_embedding", return_value=np.ones(2, dtype=np.float32)),
            patch.object(routes, "remove_object_if_exists", return_value=None),
        ):
            response = routes.verify(request)

        self.assertEqual("failed", response.status)
        self.assertIsNone(response.faceScore)

    def test_health_reports_not_ready_when_required_models_missing(self) -> None:
        with patch.object(routes, "is_service_ready", return_value=(False, {"anti_spoofing": False}), create=True):
            response = routes.health()

        self.assertFalse(response["ready"])
        self.assertNotEqual("ok", response["status"])


class LivenessSafetyTests(unittest.TestCase):
    def tearDown(self) -> None:
        liveness._anti_spoofing = None

    def test_missing_liveness_models_fail_closed(self) -> None:
        liveness._anti_spoofing = types.SimpleNamespace(is_loaded=False, models=[], predict=lambda image, bbox: 1.0)

        score = liveness.check_liveness(np.zeros((10, 10, 3), dtype=np.uint8), [0, 0, 5, 5])

        self.assertEqual(0.0, score)

    def test_single_loaded_model_normalizes_by_loaded_model_count_when_allowed(self) -> None:
        original_settings = liveness.settings
        liveness.settings = types.SimpleNamespace(
            require_all_liveness_models=False,
            required_liveness_model_count=2,
        )
        liveness._anti_spoofing = types.SimpleNamespace(
            is_loaded=True,
            models=[object()],
            predict=lambda image, bbox: 0.8,
        )
        try:
            score = liveness.check_liveness(np.zeros((10, 10, 3), dtype=np.uint8), [0, 0, 5, 5])
        finally:
            liveness.settings = original_settings

        self.assertEqual(0.8, score)

    def test_predict_uses_real_face_probability_class(self) -> None:
        class RealClassModel:
            def __call__(self, tensor):
                return torch.tensor([[0.0, 5.0, -5.0]], dtype=torch.float32)

        anti_spoofing = object.__new__(liveness.AntiSpoofing)
        anti_spoofing.models = [RealClassModel(), RealClassModel()]
        anti_spoofing.scales = [1.0, 1.0]

        score = anti_spoofing.predict(np.zeros((20, 20, 3), dtype=np.uint8), [1, 1, 10, 10])

        self.assertGreater(score, 1.9)

    def test_preprocess_matches_minifasnet_raw_bgr_input(self) -> None:
        anti_spoofing = object.__new__(liveness.AntiSpoofing)
        crop = np.zeros((2, 2, 3), dtype=np.uint8)
        crop[:, :] = [10, 20, 30]

        tensor = anti_spoofing._preprocess(crop).cpu()

        self.assertEqual(10.0, tensor[0, 0, 0, 0].item())
        self.assertEqual(20.0, tensor[0, 1, 0, 0].item())
        self.assertEqual(30.0, tensor[0, 2, 0, 0].item())

    def test_crop_keeps_requested_scale_near_image_edges(self) -> None:
        anti_spoofing = object.__new__(liveness.AntiSpoofing)
        image = np.zeros((100, 100, 3), dtype=np.uint8)
        image[:, :, 0] = np.arange(100, dtype=np.uint8)

        crop = anti_spoofing._crop_face(image, [0, 0, 20, 20], 2.7)

        self.assertEqual((80, 80, 3), crop.shape)
        self.assertGreaterEqual(int(crop[-1, -1, 0]), 50)


class MiniFASNetBackboneTests(unittest.TestCase):
    def test_backbone_uses_checkpoint_compatible_layer_names(self) -> None:
        state_keys = set(MiniFASNetV2(conv6_kernel=(5, 5)).state_dict())

        self.assertIn("conv2_dw.conv.weight", state_keys)
        self.assertIn("conv_23.conv.conv.weight", state_keys)
        self.assertIn("conv_3.model.0.conv.conv.weight", state_keys)
        self.assertIn("conv_6_dw.conv.weight", state_keys)
        self.assertIn("prob.weight", state_keys)

    def test_v1se_backbone_uses_checkpoint_compatible_se_layers(self) -> None:
        state_keys = set(MiniFASNetV1SE(conv6_kernel=(5, 5)).state_dict())

        self.assertIn("conv_3.model.3.se_module.fc1.weight", state_keys)
        self.assertIn("conv_4.model.5.se_module.bn2.running_mean", state_keys)
        self.assertIn("conv_5.model.1.se_module.fc2.weight", state_keys)


class StorageSafetyTests(unittest.TestCase):
    def setUp(self) -> None:
        self.original_client = storage.client
        storage.client = FakeMinio()

    def tearDown(self) -> None:
        storage.client = self.original_client

    def test_storage_rejects_untrusted_read_and_delete_keys(self) -> None:
        with self.assertRaises(ValueError):
            storage.read_object_bytes("../secrets.env")

        with self.assertRaises(ValueError):
            storage.remove_object_if_exists("templates/student-1/embedding.npy")

    def test_load_embedding_rejects_invalid_shape(self) -> None:
        buffer = io.BytesIO()
        np.save(buffer, np.ones(2, dtype=np.float32))
        storage.client.objects["templates/student-1/embedding.npy"] = buffer.getvalue()

        self.assertIsNone(storage.load_embedding("templates/student-1/embedding.npy"))


class DockerSafetyTests(unittest.TestCase):
    def test_dockerfile_pins_model_downloads_with_checksums(self) -> None:
        dockerfile = (REPO_ROOT / "services" / "ml-service" / "Dockerfile").read_text(encoding="utf-8")

        self.assertIn("ADD --checksum=sha256:", dockerfile)
        self.assertNotIn("/raw/master/", dockerfile)

    def test_dockerfile_uses_current_mini_fasnet_weight_checksums(self) -> None:
        dockerfile = (REPO_ROOT / "services" / "ml-service" / "Dockerfile").read_text(encoding="utf-8")
        pinned_downloads = {
            url: checksum
            for checksum, url in re.findall(
                r"ADD --checksum=sha256:([0-9a-f]{64})\s+\\\s+(\S+)\s+\\",
                dockerfile,
            )
        }

        self.assertEqual(
            "a5eb02e1843f19b5386b953cc4c9f011c3f985d0ee2bb9819eea9a142099bec0",
            pinned_downloads[
                "https://huggingface.co/spaces/aaavvvrrr/face-anti-spoofing/resolve/d9b3330bc1c961613bf3904bd6bac0ca0411310f/weights/2.7_80x80_MiniFASNetV2.pth"
            ],
        )
        self.assertEqual(
            "84ee1d37d96894d5e82de5a57df044ef80a58be2b218b5ed7cdfd875ec2f5990",
            pinned_downloads[
                "https://huggingface.co/spaces/aaavvvrrr/face-anti-spoofing/resolve/52d5df1a644e37e2fdc4b77b7e04bdc92bb973d5/weights/4_0_0_80x80_MiniFASNetV1SE.pth"
            ],
        )


if __name__ == "__main__":
    unittest.main()
