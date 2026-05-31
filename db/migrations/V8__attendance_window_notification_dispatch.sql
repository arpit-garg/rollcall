ALTER TABLE attendance_windows
  ADD COLUMN IF NOT EXISTS notification_dispatch_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notifications_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS attendance_windows_notification_dispatch_idx
  ON attendance_windows (opens_at)
  WHERE is_open = true AND notifications_sent_at IS NULL;
