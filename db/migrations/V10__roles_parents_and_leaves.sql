DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    INNER JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'user_role'
      AND e.enumlabel = 'parent'
  ) THEN
    ALTER TYPE user_role ADD VALUE 'parent';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    INNER JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'user_role'
      AND e.enumlabel = 'super_admin'
  ) THEN
    ALTER TYPE user_role ADD VALUE 'super_admin';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'leave_request_status') THEN
    CREATE TYPE leave_request_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS parent_students (
  parent_id UUID NOT NULL REFERENCES users(id),
  student_id UUID NOT NULL UNIQUE REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (parent_id, student_id),
  CHECK (parent_id <> student_id)
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id),
  parent_id UUID NOT NULL REFERENCES users(id),
  requested_from DATE NOT NULL,
  requested_to DATE NOT NULL,
  destination VARCHAR(160) NOT NULL,
  reason TEXT NOT NULL,
  status leave_request_status NOT NULL DEFAULT 'pending',
  parent_note TEXT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (requested_to >= requested_from),
  CHECK (student_id <> parent_id)
);

CREATE INDEX IF NOT EXISTS parent_students_parent_id_idx
  ON parent_students (parent_id);

CREATE INDEX IF NOT EXISTS leave_requests_student_created_at_idx
  ON leave_requests (student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS leave_requests_parent_status_created_at_idx
  ON leave_requests (parent_id, status, created_at DESC);
