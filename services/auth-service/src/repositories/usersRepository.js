import { pool } from "../config/db.js";

function mapUser(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    hostelId: row.hostel_id,
    roomNumber: row.room_number,
    isActive: row.is_active
  };
}

export async function findUserByEmail(email) {
  const { rows } = await pool.query(
    `
      SELECT id, name, email, password_hash, role, hostel_id, room_number, is_active
      FROM users
      WHERE email = $1
      LIMIT 1
    `,
    [email.trim().toLowerCase()]
  );

  return mapUser(rows[0]);
}

export async function findUserById(id) {
  const { rows } = await pool.query(
    `
      SELECT id, name, email, password_hash, role, hostel_id, room_number, is_active
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return mapUser(rows[0]);
}

export async function createUser({ name, email, passwordHash, hostelId, roomNumber }) {
  const { rows } = await pool.query(
    `
      INSERT INTO users (name, email, password_hash, role, hostel_id, room_number, is_active)
      VALUES ($1, $2, $3, 'student', $4, $5, true)
      RETURNING id, name, email, role, hostel_id, room_number, is_active
    `,
    [name.trim(), email.trim().toLowerCase(), passwordHash, hostelId, roomNumber ? roomNumber.trim() : null]
  );

  return mapUser(rows[0]);
}

