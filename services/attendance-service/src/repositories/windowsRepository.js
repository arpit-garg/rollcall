import { pool } from "../config/db.js";

function mapWindow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    hostelId: row.hostel_id,
    openedBy: row.opened_by,
    date: row.date,
    opensAt: row.opens_at,
    closesAt: row.closes_at,
    isOpen: row.is_open,
    createdAt: row.created_at
  };
}

export async function createWindow({ hostelId, openedBy, opensAt, closesAt }) {
  const { rows } = await pool.query(
    `
      INSERT INTO attendance_windows (hostel_id, opened_by, date, opens_at, closes_at, is_open)
      VALUES ($1, $2, $3::date, $3::timestamptz, $4::timestamptz, true)
      RETURNING id, hostel_id, opened_by, date, opens_at, closes_at, is_open, created_at
    `,
    [hostelId, openedBy, opensAt, closesAt]
  );

  return mapWindow(rows[0]);
}

export async function listWindows(hostelId) {
  const { rows } = await pool.query(
    `
      SELECT id, hostel_id, opened_by, date, opens_at, closes_at,
             (is_open AND closes_at >= now()) AS is_open,
             created_at
      FROM attendance_windows
      WHERE hostel_id = $1
      ORDER BY created_at DESC
    `,
    [hostelId]
  );

  return rows.map(mapWindow);
}

export async function closeWindow(windowId, hostelId) {
  const { rows } = await pool.query(
    `
      UPDATE attendance_windows
      SET is_open = false
      WHERE id = $1 AND hostel_id = $2
      RETURNING id, hostel_id, opened_by, date, opens_at, closes_at, is_open, created_at
    `,
    [windowId, hostelId]
  );

  return mapWindow(rows[0]);
}

export async function findActiveWindow(hostelId) {
  const { rows } = await pool.query(
    `
      SELECT id, hostel_id, opened_by, date, opens_at, closes_at, is_open, created_at
      FROM attendance_windows
      WHERE hostel_id = $1
        AND is_open = true
        AND opens_at <= now()
        AND closes_at >= now()
      ORDER BY opens_at DESC
      LIMIT 1
    `,
    [hostelId]
  );

  return mapWindow(rows[0]);
}

export async function getWindowRecords(windowId, hostelId) {
  const { rows } = await pool.query(
    `
      SELECT
        ar.id,
        ar.window_id,
        ar.student_id,
        ar.status,
        ar.job_id,
        ar.geo_lat,
        ar.geo_lng,
        ar.geo_verified,
        ar.face_score,
        ar.liveness_score,
        ar.submitted_at,
        ar.resolved_at,
        u.name AS student_name,
        u.room_number
      FROM attendance_records ar
      INNER JOIN users u ON u.id = ar.student_id
      INNER JOIN attendance_windows aw ON aw.id = ar.window_id
      WHERE ar.window_id = $1
        AND aw.hostel_id = $2
      ORDER BY ar.submitted_at DESC
    `,
    [windowId, hostelId]
  );

  return rows.map((row) => ({
    id: row.id,
    windowId: row.window_id,
    studentId: row.student_id,
    studentName: row.student_name,
    roomNumber: row.room_number,
    status: row.status,
    jobId: row.job_id,
    geoLat: row.geo_lat === null ? null : Number(row.geo_lat),
    geoLng: row.geo_lng === null ? null : Number(row.geo_lng),
    geoVerified: row.geo_verified,
    faceScore: row.face_score === null ? null : Number(row.face_score),
    livenessScore: row.liveness_score === null ? null : Number(row.liveness_score),
    submittedAt: row.submitted_at,
    resolvedAt: row.resolved_at
  }));
}
