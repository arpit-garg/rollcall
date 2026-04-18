import { pool } from "../config/db.js";

export async function findFaceTemplate(studentId) {
  const { rows } = await pool.query(
    `
      SELECT id, student_id, embedding_ref, model_version, enrolled_at, is_valid
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

export async function upsertEnrolledTemplate(studentId, modelVersion, embeddingRef) {
  await pool.query(
    `
      INSERT INTO face_templates (student_id, embedding_ref, model_version, is_valid)
      VALUES ($1, $2, $3, true)
      ON CONFLICT (student_id) DO UPDATE
      SET
        embedding_ref = EXCLUDED.embedding_ref,
        model_version = EXCLUDED.model_version,
        is_valid = true,
        enrolled_at = now()
    `,
    [studentId, embeddingRef, modelVersion]
  );
}

export async function invalidateTemplate(studentId) {
  await pool.query(
    `
      UPDATE face_templates
      SET is_valid = false
      WHERE student_id = $1
    `,
    [studentId]
  );
}

export async function setEnrollmentProcessing(studentId) {
  await pool.query(
    `
      INSERT INTO face_templates (student_id, embedding_ref, model_version, is_valid)
      VALUES ($1, 'processing://pending', 'processing', false)
      ON CONFLICT (student_id) DO UPDATE
      SET
        embedding_ref = 'processing://pending',
        model_version = 'processing',
        is_valid = false,
        enrolled_at = now()
    `,
    [studentId]
  );
}
