INSERT INTO face_templates (student_id, embedding_ref, model_version, is_valid)
VALUES (
  '8f71928b-74d0-4dbb-b30a-1e5da85a20fd',
  'seed://8f71928b-74d0-4dbb-b30a-1e5da85a20fd',
  'demo-facenet-v1',
  true
)
ON CONFLICT (student_id) DO UPDATE
SET
  embedding_ref = EXCLUDED.embedding_ref,
  model_version = EXCLUDED.model_version,
  is_valid = EXCLUDED.is_valid,
  enrolled_at = now();
