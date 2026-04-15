CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('student', 'warden');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_status') THEN
    CREATE TYPE attendance_status AS ENUM ('pending', 'verified', 'failed', 'overridden');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS hostels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(160) NOT NULL,
  center_lat NUMERIC(10,7) NOT NULL,
  center_lng NUMERIC(10,7) NOT NULL,
  radius_metres INTEGER NOT NULL CHECK (radius_metres > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  email VARCHAR(180) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL,
  hostel_id UUID REFERENCES hostels(id),
  room_number VARCHAR(20),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS face_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL UNIQUE REFERENCES users(id),
  embedding_ref TEXT NOT NULL,
  model_version VARCHAR(40) NOT NULL,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_valid BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS attendance_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id UUID NOT NULL REFERENCES hostels(id),
  opened_by UUID NOT NULL REFERENCES users(id),
  date DATE NOT NULL,
  opens_at TIMESTAMPTZ NOT NULL,
  closes_at TIMESTAMPTZ NOT NULL,
  is_open BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  window_id UUID NOT NULL REFERENCES attendance_windows(id),
  student_id UUID NOT NULL REFERENCES users(id),
  status attendance_status NOT NULL,
  job_id UUID NOT NULL UNIQUE,
  geo_lat NUMERIC(10,7),
  geo_lng NUMERIC(10,7),
  geo_verified BOOLEAN NOT NULL DEFAULT false,
  face_score NUMERIC(5,4),
  liveness_score NUMERIC(5,4),
  submitted_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_record_id UUID NOT NULL UNIQUE REFERENCES attendance_records(id),
  warden_id UUID NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  override_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID REFERENCES users(id),
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(60) NOT NULL,
  entity_id UUID NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS attendance_records_window_student_unique
  ON attendance_records (window_id, student_id)
  WHERE status IN ('pending', 'verified', 'overridden');

CREATE INDEX IF NOT EXISTS attendance_records_student_submitted_at_idx
  ON attendance_records (student_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_actor_created_at_idx
  ON audit_logs (actor_id, created_at DESC);
