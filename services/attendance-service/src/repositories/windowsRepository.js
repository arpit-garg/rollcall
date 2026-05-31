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

function formatDateValue(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  return value.toISOString().slice(0, 10);
}

function mapRosterAttendanceRecord(row) {
  if (!row.attendance_record_id) {
    return null;
  }

  return {
    id: row.attendance_record_id,
    windowId: row.window_id,
    studentId: row.student_id,
    status: row.attendance_status,
    jobId: row.attendance_job_id,
    geoLat: row.attendance_geo_lat === null ? null : Number(row.attendance_geo_lat),
    geoLng: row.attendance_geo_lng === null ? null : Number(row.attendance_geo_lng),
    geoVerified: row.attendance_geo_verified,
    faceScore: row.attendance_face_score === null ? null : Number(row.attendance_face_score),
    livenessScore: row.attendance_liveness_score === null ? null : Number(row.attendance_liveness_score),
    submittedAt: row.attendance_submitted_at,
    resolvedAt: row.attendance_resolved_at
  };
}

function mapRosterLeaveRequest(row) {
  if (!row.leave_request_id) {
    return null;
  }

  return {
    id: row.leave_request_id,
    studentId: row.student_id,
    parentId: row.leave_parent_id,
    requestedFrom: formatDateValue(row.leave_requested_from),
    requestedTo: formatDateValue(row.leave_requested_to),
    destination: row.leave_destination,
    reason: row.leave_reason,
    status: row.leave_status,
    parentNote: row.leave_parent_note,
    decidedAt: row.leave_decided_at,
    createdAt: row.leave_created_at,
    updatedAt: row.leave_updated_at
  };
}

export async function createWindow({ hostelId, openedBy, opensAt, closesAt }) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [hostelId]);

    const overlapping = await findOverlappingWindowForClient(client, hostelId, opensAt, closesAt);

    if (overlapping) {
      await client.query("ROLLBACK");
      return {
        overlapping
      };
    }

    const { rows } = await client.query(
      `
        INSERT INTO attendance_windows (hostel_id, opened_by, date, opens_at, closes_at, is_open)
        VALUES ($1, $2, ($3::timestamptz)::date, $3::timestamptz, $4::timestamptz, true)
        RETURNING id, hostel_id, opened_by, date, opens_at, closes_at, is_open, created_at
      `,
      [hostelId, openedBy, opensAt, closesAt]
    );

    await client.query("COMMIT");
    return {
      window: mapWindow(rows[0])
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
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

export async function getWindowRoster(windowId, hostelId) {
  const { rows } = await pool.query(
    `
      SELECT
        aw.id AS window_id,
        aw.date AS window_date,
        aw.opens_at,
        aw.closes_at,
        student.id AS student_id,
        student.name AS student_name,
        student.room_number,
        latest_record.id AS attendance_record_id,
        latest_record.status AS attendance_status,
        latest_record.job_id AS attendance_job_id,
        latest_record.geo_lat AS attendance_geo_lat,
        latest_record.geo_lng AS attendance_geo_lng,
        latest_record.geo_verified AS attendance_geo_verified,
        latest_record.face_score AS attendance_face_score,
        latest_record.liveness_score AS attendance_liveness_score,
        latest_record.submitted_at AS attendance_submitted_at,
        latest_record.resolved_at AS attendance_resolved_at,
        approved_leave.id AS leave_request_id,
        approved_leave.parent_id AS leave_parent_id,
        approved_leave.requested_from AS leave_requested_from,
        approved_leave.requested_to AS leave_requested_to,
        approved_leave.destination AS leave_destination,
        approved_leave.reason AS leave_reason,
        approved_leave.status AS leave_status,
        approved_leave.parent_note AS leave_parent_note,
        approved_leave.decided_at AS leave_decided_at,
        approved_leave.created_at AS leave_created_at,
        approved_leave.updated_at AS leave_updated_at
      FROM attendance_windows aw
      INNER JOIN users student
        ON student.hostel_id = aw.hostel_id
       AND student.role = 'student'
       AND student.is_active = true
      LEFT JOIN LATERAL (
        SELECT id, status, job_id, geo_lat, geo_lng, geo_verified,
               face_score, liveness_score, submitted_at, resolved_at
        FROM attendance_records ar
        WHERE ar.window_id = aw.id
          AND ar.student_id = student.id
        ORDER BY ar.submitted_at DESC
        LIMIT 1
      ) latest_record ON true
      LEFT JOIN LATERAL (
        SELECT id, parent_id, requested_from, requested_to, destination, reason,
               status, parent_note, decided_at, created_at, updated_at
        FROM leave_requests lr
        WHERE lr.student_id = student.id
          AND lr.status = 'approved'
          AND aw.date BETWEEN lr.requested_from AND lr.requested_to
        ORDER BY lr.decided_at DESC NULLS LAST, lr.created_at DESC
        LIMIT 1
      ) approved_leave ON true
      WHERE aw.id = $1
        AND aw.hostel_id = $2
      ORDER BY
        CASE
          WHEN latest_record.id IS NOT NULL THEN 0
          WHEN approved_leave.id IS NOT NULL THEN 1
          ELSE 2
        END,
        student.name ASC
    `,
    [windowId, hostelId]
  );

  return rows.map((row) => {
    const attendanceRecord = mapRosterAttendanceRecord(row);
    const leaveRequest = mapRosterLeaveRequest(row);
    const leaveApplied = !attendanceRecord && Boolean(leaveRequest);

    return {
      windowId: row.window_id,
      windowDate: formatDateValue(row.window_date),
      opensAt: row.opens_at,
      closesAt: row.closes_at,
      studentId: row.student_id,
      studentName: row.student_name,
      roomNumber: row.room_number,
      windowStatus: attendanceRecord ? "marked" : leaveRequest ? "on_leave" : "absent",
      attendanceStatus: attendanceRecord?.status || null,
      attendanceRecord,
      leaveApplied,
      leaveRequest
    };
  });
}

export async function findOverlappingWindow(hostelId, opensAt, closesAt) {
  return findOverlappingWindowForClient(pool, hostelId, opensAt, closesAt);
}

async function findOverlappingWindowForClient(client, hostelId, opensAt, closesAt) {
  const { rows } = await client.query(
    `
      SELECT id, opens_at, closes_at
      FROM attendance_windows
      WHERE hostel_id = $1
        AND is_open = true
        AND (
          (opens_at <= $2 AND closes_at > $2) OR
          (opens_at < $3 AND closes_at >= $3) OR
          (opens_at >= $2 AND closes_at <= $3)
        )
      LIMIT 1
    `,
    [hostelId, opensAt, closesAt]
  );

  return rows[0] || null;
}
