import { pool } from "../config/db.js";

function mapLinkedStudent(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.student_id,
    name: row.student_name,
    hostelId: row.hostel_id,
    roomNumber: row.room_number,
    isActive: row.is_active
  };
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

export async function findLinkedStudentForParent(parentId) {
  const { rows } = await pool.query(
    `
      SELECT
        ps.student_id,
        student.name AS student_name,
        student.hostel_id,
        student.room_number,
        student.is_active
      FROM parent_students ps
      INNER JOIN users student ON student.id = ps.student_id
      WHERE ps.parent_id = $1
      ORDER BY ps.created_at ASC
      LIMIT 1
    `,
    [parentId]
  );

  return mapLinkedStudent(rows[0]);
}
