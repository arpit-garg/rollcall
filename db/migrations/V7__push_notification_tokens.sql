CREATE TABLE IF NOT EXISTS push_notification_tokens (
  token TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform VARCHAR(20) NOT NULL,
  disabled_at TIMESTAMPTZ,
  last_registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_notification_tokens_user_active_idx
  ON push_notification_tokens (user_id, last_registered_at DESC)
  WHERE disabled_at IS NULL;
