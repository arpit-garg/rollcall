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

export async function findActiveUserById(id) {
  const { rows } = await pool.query(
    `
      SELECT id, name, email, password_hash, role, hostel_id, room_number, is_active
      FROM users
      WHERE id = $1
        AND is_active = true
      LIMIT 1
    `,
    [id]
  );

  return mapUser(rows[0]);
}

export async function findParentLinkByStudentId(studentId) {
  const { rows } = await pool.query(
    `
      SELECT parent_id, student_id, created_at
      FROM parent_students
      WHERE student_id = $1
      LIMIT 1
    `,
    [studentId]
  );

  if (!rows[0]) {
    return null;
  }

  return {
    parentId: rows[0].parent_id,
    studentId: rows[0].student_id,
    createdAt: rows[0].created_at
  };
}

async function insertUser(executor, { name, email, passwordHash, role = "student", hostelId = null, roomNumber = null }) {
  const { rows } = await executor.query(
    `
      INSERT INTO users (name, email, password_hash, role, hostel_id, room_number, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, true)
      RETURNING id, name, email, role, hostel_id, room_number, is_active
    `,
    [
      name.trim(),
      email.trim().toLowerCase(),
      passwordHash,
      role,
      hostelId,
      roomNumber ? roomNumber.trim() : null
    ]
  );

  return mapUser(rows[0]);
}

export async function createUser({ name, email, passwordHash, role = "student", hostelId = null, roomNumber = null }) {
  return insertUser(pool, {
    name,
    email,
    passwordHash,
    role,
    hostelId,
    roomNumber
  });
}

export async function createParentForStudent({ name, email, passwordHash, student }) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const parent = await insertUser(client, {
      name,
      email,
      passwordHash,
      role: "parent",
      hostelId: student.hostelId
    });

    await client.query(
      `
        INSERT INTO parent_students (parent_id, student_id)
        VALUES ($1, $2)
      `,
      [parent.id, student.id]
    );

    await client.query("COMMIT");
    return parent;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listWardens() {
  const { rows } = await pool.query(
    `
      SELECT
        u.id,
        u.name,
        u.email,
        u.role,
        u.hostel_id,
        u.room_number,
        u.is_active,
        h.name AS hostel_name
      FROM users u
      LEFT JOIN hostels h ON h.id = u.hostel_id
      WHERE u.role = 'warden'
      ORDER BY u.name ASC
    `
  );

  return rows.map((row) => ({
    ...mapUser(row),
    hostelName: row.hostel_name
  }));
}
