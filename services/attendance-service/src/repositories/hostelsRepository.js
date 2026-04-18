import { pool } from "../config/db.js";

function mapHostel(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    centerLat: Number(row.center_lat),
    centerLng: Number(row.center_lng),
    radiusMetres: row.radius_metres
  };
}

export async function findHostelById(hostelId) {
  const { rows } = await pool.query(
    `
      SELECT id, name, center_lat, center_lng, radius_metres
      FROM hostels
      WHERE id = $1
      LIMIT 1
    `,
    [hostelId]
  );

  return mapHostel(rows[0]);
}
