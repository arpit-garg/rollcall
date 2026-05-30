import { randomUUID } from "node:crypto";
import { pool } from "../config/db.js";

function mapRecord(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    windowId: row.window_id,
    studentId: row.student_id,
    status: row.status,
    jobId: row.job_id,
    geoLat: row.geo_lat === null ? null : Number(row.geo_lat),
    geoLng: row.geo_lng === null ? null : Number(row.geo_lng),
    geoVerified: row.geo_verified,
    faceScore: row.face_score === null ? null : Number(row.face_score),
    livenessScore: row.liveness_score === null ? null : Number(row.liveness_score),
    submittedAt: row.submitted_at,
    resolvedAt: row.resolved_at
  };
}

function mapRecordWithHostel(row) {
  const record = mapRecord(row);

  if (!record) {
    return null;
  }

  return {
    ...record,
    hostelId: row.hostel_id
  };
}

export async function findRecordByJobIdForStudent(jobId, studentId) {
  const { rows } = await pool.query(
    `
      SELECT id, window_id, student_id, status, job_id, geo_lat, geo_lng, geo_verified,
             face_score, liveness_score, submitted_at, resolved_at
      FROM attendance_records
      WHERE job_id = $1
        AND student_id = $2
      LIMIT 1
    `,
    [jobId, studentId]
  );

  return mapRecord(rows[0]);
}

export async function findActiveRecord(windowId, studentId) {
  const { rows } = await pool.query(
    `
      SELECT id, window_id, student_id, status, job_id, geo_lat, geo_lng, geo_verified,
             face_score, liveness_score, submitted_at, resolved_at
      FROM attendance_records
      WHERE window_id = $1
        AND student_id = $2
        AND status IN ('pending', 'verified', 'overridden')
      LIMIT 1
    `,
    [windowId, studentId]
  );

  return mapRecord(rows[0]);
}

export async function countFailedAttempts(windowId, studentId) {
  const { rows } = await pool.query(
    `
      SELECT COUNT(*)::int AS failed_attempts
      FROM attendance_records
      WHERE window_id = $1
        AND student_id = $2
        AND status = 'failed'
    `,
    [windowId, studentId]
  );

  return rows[0]?.failed_attempts ?? 0;
}

export async function createPendingRecord({ windowId, studentId, latitude, longitude }) {
  const jobId = randomUUID();

  const { rows } = await pool.query(
    `
      INSERT INTO attendance_records (
        window_id,
        student_id,
        status,
        job_id,
        geo_lat,
        geo_lng,
        geo_verified,
        submitted_at
      )
      VALUES ($1, $2, 'pending', $3, $4, $5, true, now())
      RETURNING id, window_id, student_id, status, job_id, geo_lat, geo_lng, geo_verified,
                face_score, liveness_score, submitted_at, resolved_at
    `,
    [windowId, studentId, jobId, latitude, longitude]
  );

  return mapRecord(rows[0]);
}

export async function resolveRecord(jobId, outcome) {
  const { rows } = await pool.query(
    `
      UPDATE attendance_records
      SET status = $2,
          face_score = $3,
          liveness_score = $4,
          resolved_at = now()
      WHERE job_id = $1
        AND status = 'pending'
      RETURNING id, window_id, student_id, status, job_id, geo_lat, geo_lng, geo_verified,
                face_score, liveness_score, submitted_at, resolved_at,
                (
                  SELECT hostel_id
                  FROM attendance_windows
                  WHERE attendance_windows.id = attendance_records.window_id
                ) AS hostel_id
    `,
    [jobId, outcome.status, outcome.faceScore, outcome.livenessScore]
  );

  return mapRecordWithHostel(rows[0]);
}

export async function getStudentHistory(studentId) {
  const { rows } = await pool.query(
    `
      SELECT id, window_id, student_id, status, job_id, geo_lat, geo_lng, geo_verified,
             face_score, liveness_score, submitted_at, resolved_at
      FROM attendance_records
      WHERE student_id = $1
      ORDER BY submitted_at DESC
    `,
    [studentId]
  );

  return rows.map(mapRecord);
}

export async function getRecordById(recordId) {
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
        aw.hostel_id
      FROM attendance_records ar
      INNER JOIN attendance_windows aw ON aw.id = ar.window_id
      WHERE ar.id = $1
      LIMIT 1
    `,
    [recordId]
  );

  if (!rows[0]) {
    return null;
  }

  return mapRecordWithHostel(rows[0]);
}

export async function createOverride({ recordId, wardenId, reason }) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const recordResult = await client.query(
      `
        UPDATE attendance_records
        SET status = 'overridden',
            resolved_at = now()
        WHERE id = $1
          AND status = 'failed'
        RETURNING id, window_id, student_id, status, job_id, geo_lat, geo_lng, geo_verified,
                  face_score, liveness_score, submitted_at, resolved_at
      `,
      [recordId]
    );

    if (!recordResult.rows[0]) {
      await client.query("ROLLBACK");
      return null;
    }

    const overrideResult = await client.query(
      `
        INSERT INTO overrides (attendance_record_id, warden_id, reason)
        VALUES ($1, $2, $3)
        RETURNING id, attendance_record_id, warden_id, reason, override_at
      `,
      [recordId, wardenId, reason]
    );

    await client.query("COMMIT");

    return {
      record: mapRecord(recordResult.rows[0]),
      override: {
        id: overrideResult.rows[0].id,
        attendanceRecordId: overrideResult.rows[0].attendance_record_id,
        wardenId: overrideResult.rows[0].warden_id,
        reason: overrideResult.rows[0].reason,
        overrideAt: overrideResult.rows[0].override_at
      }
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listOverrides(hostelId) {
  const { rows } = await pool.query(
    `
      SELECT
        o.id,
        o.attendance_record_id,
        o.warden_id,
        o.reason,
        o.override_at,
        ar.student_id,
        ar.submitted_at,
        student.name AS student_name,
        student.room_number,
        warden.name AS warden_name
      FROM overrides o
      INNER JOIN attendance_records ar ON ar.id = o.attendance_record_id
      INNER JOIN attendance_windows aw ON aw.id = ar.window_id
      INNER JOIN users student ON student.id = ar.student_id
      INNER JOIN users warden ON warden.id = o.warden_id
      WHERE aw.hostel_id = $1
      ORDER BY o.override_at DESC
    `,
    [hostelId]
  );

  return rows.map((row) => ({
    id: row.id,
    attendanceRecordId: row.attendance_record_id,
    wardenId: row.warden_id,
    wardenName: row.warden_name,
    studentId: row.student_id,
    studentName: row.student_name,
    roomNumber: row.room_number,
    reason: row.reason,
    submittedAt: row.submitted_at,
    overrideAt: row.override_at
  }));
}
