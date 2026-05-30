CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE face_templates
  ADD COLUMN IF NOT EXISTS enrollment_attempt_id UUID,
  ADD COLUMN IF NOT EXISTS enrollment_status VARCHAR(20) NOT NULL DEFAULT 'idle';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'face_templates_enrollment_status_check'
  ) THEN
    ALTER TABLE face_templates
      ADD CONSTRAINT face_templates_enrollment_status_check
      CHECK (enrollment_status IN ('idle', 'processing'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'hostels_center_lat_check'
  ) THEN
    ALTER TABLE hostels
      ADD CONSTRAINT hostels_center_lat_check
      CHECK (center_lat BETWEEN -90 AND 90);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'hostels_center_lng_check'
  ) THEN
    ALTER TABLE hostels
      ADD CONSTRAINT hostels_center_lng_check
      CHECK (center_lng BETWEEN -180 AND 180);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'attendance_records_geo_lat_check'
  ) THEN
    ALTER TABLE attendance_records
      ADD CONSTRAINT attendance_records_geo_lat_check
      CHECK (geo_lat BETWEEN -90 AND 90);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'attendance_records_geo_lng_check'
  ) THEN
    ALTER TABLE attendance_records
      ADD CONSTRAINT attendance_records_geo_lng_check
      CHECK (geo_lng BETWEEN -180 AND 180);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'attendance_records_face_score_check'
  ) THEN
    ALTER TABLE attendance_records
      ADD CONSTRAINT attendance_records_face_score_check
      CHECK (face_score BETWEEN 0 AND 1);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'attendance_records_liveness_score_check'
  ) THEN
    ALTER TABLE attendance_records
      ADD CONSTRAINT attendance_records_liveness_score_check
      CHECK (liveness_score BETWEEN 0 AND 1);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'attendance_windows_no_open_overlap'
  ) THEN
    ALTER TABLE attendance_windows
      ADD CONSTRAINT attendance_windows_no_open_overlap
      EXCLUDE USING gist (
        hostel_id WITH =,
        tstzrange(opens_at, closes_at, '[)') WITH &&
      )
      WHERE (is_open);
  END IF;
END $$;
