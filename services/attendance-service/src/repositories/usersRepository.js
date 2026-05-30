import { pool } from "../config/db.js";

function mapUser(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    role: row.role,
    hostelId: row.hostel_id,
    isActive: row.is_active
  };
}

export async function findActiveUserById(userId) {
  const { rows } = await pool.query(
    `
      SELECT id, role, hostel_id, is_active
      FROM users
      WHERE id = $1
        AND is_active = true
      LIMIT 1
    `,
    [userId]
  );

  return mapUser(rows[0]);
}

export async function findUserById(userId) {
  const { rows } = await pool.query(
    `
      SELECT id, role, hostel_id, is_active
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [userId]
  );

  return mapUser(rows[0]);
}
