import { pool } from "../config/db.js";

export async function appendAuditLog(actorId, action, entityType, entityId, metadata = null) {
  await pool.query(
    `
      INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
      VALUES ($1, $2, $3, $4, $5)
    `,
    [actorId, action, entityType, entityId, metadata]
  );
}
