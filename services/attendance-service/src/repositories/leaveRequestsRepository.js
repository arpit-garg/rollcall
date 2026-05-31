import { pool } from "../config/db.js";

function formatDateValue(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  return value.toISOString().slice(0, 10);
}

function mapLeaveRequest(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    studentId: row.student_id,
    parentId: row.parent_id,
    requestedFrom: formatDateValue(row.requested_from),
    requestedTo: formatDateValue(row.requested_to),
    destination: row.destination,
    reason: row.reason,
    status: row.status,
    parentNote: row.parent_note,
    decidedAt: row.decided_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    studentName: row.student_name || null,
    roomNumber: row.room_number || null
  };
}

export async function createLeaveRequest({
  studentId,
  parentId,
  requestedFrom,
  requestedTo,
  destination,
  reason
}) {
  const { rows } = await pool.query(
    `
      INSERT INTO leave_requests (
        student_id,
        parent_id,
        requested_from,
        requested_to,
        destination,
        reason
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, student_id, parent_id, requested_from, requested_to,
                destination, reason, status, parent_note, decided_at,
                created_at, updated_at
    `,
    [studentId, parentId, requestedFrom, requestedTo, destination, reason]
  );

  return mapLeaveRequest(rows[0]);
}

export async function listLeaveRequestsForStudent(studentId) {
  const { rows } = await pool.query(
    `
      SELECT id, student_id, parent_id, requested_from, requested_to,
             destination, reason, status, parent_note, decided_at,
             created_at, updated_at
      FROM leave_requests
      WHERE student_id = $1
      ORDER BY created_at DESC
    `,
    [studentId]
  );

  return rows.map(mapLeaveRequest);
}

export async function listLeaveRequestsForParent(parentId) {
  const { rows } = await pool.query(
    `
      SELECT
        lr.id,
        lr.student_id,
        lr.parent_id,
        lr.requested_from,
        lr.requested_to,
        lr.destination,
        lr.reason,
        lr.status,
        lr.parent_note,
        lr.decided_at,
        lr.created_at,
        lr.updated_at,
        student.name AS student_name,
        student.room_number
      FROM leave_requests lr
      INNER JOIN users student ON student.id = lr.student_id
      WHERE lr.parent_id = $1
      ORDER BY lr.created_at DESC
    `,
    [parentId]
  );

  return rows.map(mapLeaveRequest);
}

export async function decideLeaveRequest({ requestId, parentId, status, parentNote }) {
  const { rows } = await pool.query(
    `
      UPDATE leave_requests
      SET status = $3,
          parent_note = $4,
          decided_at = now(),
          updated_at = now()
      WHERE id = $1
        AND parent_id = $2
        AND status = 'pending'
      RETURNING id, student_id, parent_id, requested_from, requested_to,
                destination, reason, status, parent_note, decided_at,
                created_at, updated_at
    `,
    [requestId, parentId, status, parentNote]
  );

  return mapLeaveRequest(rows[0]);
}
