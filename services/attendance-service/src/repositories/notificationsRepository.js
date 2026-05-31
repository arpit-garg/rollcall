import { pool } from "../config/db.js";

function mapNotification(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    hostelId: row.hostel_id,
    type: row.type,
    title: row.title,
    message: row.message,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: row.metadata || {},
    opensAt: row.metadata?.opensAt || null,
    closesAt: row.metadata?.closesAt || null,
    readAt: row.read_at,
    createdAt: row.created_at
  };
}

export async function createWindowOpenedNotificationsForHostel({ hostelId, window }) {
  const metadata = {
    windowId: window.id,
    opensAt: window.opensAt,
    closesAt: window.closesAt
  };

  const { rows } = await pool.query(
    `
      INSERT INTO notifications (
        user_id,
        hostel_id,
        type,
        title,
        message,
        entity_type,
        entity_id,
        metadata
      )
      SELECT
        id,
        hostel_id,
        'attendance_window_opened',
        'Attendance window opened',
        'Attendance window is now open.',
        'attendance_windows',
        $2,
        $3::jsonb
      FROM users
      WHERE hostel_id = $1
        AND role = 'student'
        AND is_active = true
      ON CONFLICT (user_id, type, entity_id)
        WHERE entity_id IS NOT NULL
        DO NOTHING
      RETURNING id
    `,
    [hostelId, window.id, JSON.stringify(metadata)]
  );

  return rows.length;
}

export async function listUnreadNotifications(userId) {
  const { rows } = await pool.query(
    `
      SELECT id, user_id, hostel_id, type, title, message, entity_type, entity_id,
             metadata, read_at, created_at
      FROM notifications
      WHERE user_id = $1
        AND read_at IS NULL
      ORDER BY created_at DESC
      LIMIT 20
    `,
    [userId]
  );

  return rows.map(mapNotification);
}

export async function markNotificationRead(notificationId, userId) {
  const { rows } = await pool.query(
    `
      UPDATE notifications
      SET read_at = COALESCE(read_at, now())
      WHERE id = $1
        AND user_id = $2
      RETURNING id, user_id, hostel_id, type, title, message, entity_type, entity_id,
                metadata, read_at, created_at
    `,
    [notificationId, userId]
  );

  return mapNotification(rows[0]);
}
