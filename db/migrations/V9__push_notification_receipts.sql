CREATE TABLE IF NOT EXISTS push_notification_receipts (
  ticket_id TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  last_error TEXT,
  check_started_at TIMESTAMPTZ,
  checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_notification_receipts_pending_idx
  ON push_notification_receipts (created_at ASC)
  WHERE status = 'pending';
