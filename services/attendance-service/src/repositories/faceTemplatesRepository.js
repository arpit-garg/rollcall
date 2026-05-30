import { pool } from "../config/db.js";

export async function findFaceTemplate(studentId) {
  const { rows } = await pool.query(
    `
      SELECT id, student_id, embedding_ref, model_version, enrolled_at, is_valid,
             enrollment_attempt_id, enrollment_status
      FROM face_templates
      WHERE student_id = $1
      LIMIT 1
    `,
    [studentId]
  );

  return rows[0] || null;
}

export async function getEnrollmentStatus(studentId) {
  const template = await findFaceTemplate(studentId);

  if (!template) {
    return { status: "not_enrolled" };
  }

  if (template.enrollment_status === "processing") {
    return {
      status: "processing",
      updatedAt: template.enrolled_at
    };
  }

  if (!template.is_valid) {
    if (template.model_version === "processing") {
      return {
        status: "processing",
        updatedAt: template.enrolled_at
      };
    }

    return {
      status: "re_enrollment_required",
      updatedAt: template.enrolled_at
    };
  }

  return {
    status: "enrolled",
    modelVersion: template.model_version,
    updatedAt: template.enrolled_at
  };
}

export async function upsertEnrolledTemplate(studentId, modelVersion, embeddingRef, attemptId = null) {
  const { rows } = await pool.query(
    `
      INSERT INTO face_templates (student_id, embedding_ref, model_version, is_valid)
      VALUES ($1, $2, $3, true)
      ON CONFLICT (student_id) DO UPDATE
      SET
        embedding_ref = EXCLUDED.embedding_ref,
        model_version = EXCLUDED.model_version,
        is_valid = true,
        enrollment_attempt_id = NULL,
        enrollment_status = 'idle',
        enrolled_at = now()
      WHERE $4::uuid IS NULL
         OR face_templates.enrollment_attempt_id = $4::uuid
      RETURNING id
    `,
    [studentId, embeddingRef, modelVersion, attemptId]
  );

  return rows.length > 0;
}

export async function invalidateTemplate(studentId) {
  await pool.query(
    `
      UPDATE face_templates
      SET is_valid = false,
          model_version = 'failed',
          enrollment_attempt_id = NULL,
          enrollment_status = 'idle'
      WHERE student_id = $1
    `,
    [studentId]
  );
}

export async function setEnrollmentProcessing(studentId, attemptId) {
  await pool.query(
    `
      INSERT INTO face_templates (
        student_id,
        embedding_ref,
        model_version,
        is_valid,
        enrollment_attempt_id,
        enrollment_status
      )
      VALUES ($1, 'processing://pending', 'processing', false, $2, 'processing')
      ON CONFLICT (student_id) DO UPDATE
      SET
        enrollment_attempt_id = EXCLUDED.enrollment_attempt_id,
        enrollment_status = 'processing',
        enrolled_at = now()
    `,
    [studentId, attemptId]
  );
}

export async function failEnrollmentAttempt(studentId, attemptId) {
  await pool.query(
    `
      UPDATE face_templates
      SET
        enrollment_attempt_id = NULL,
        enrollment_status = 'idle',
        is_valid = CASE WHEN is_valid THEN true ELSE false END,
        model_version = CASE WHEN is_valid THEN model_version ELSE 'failed' END
      WHERE student_id = $1
        AND enrollment_attempt_id = $2
    `,
    [studentId, attemptId]
  );
}
