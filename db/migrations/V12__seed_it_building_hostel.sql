INSERT INTO hostels (id, name, center_lat, center_lng, radius_metres)
VALUES (
  'cd4800be-3f83-4367-aa7c-361934d07906',
  'IT-Building',
  31.3968980,
  75.5340740,
  150
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  center_lat = EXCLUDED.center_lat,
  center_lng = EXCLUDED.center_lng,
  radius_metres = EXCLUDED.radius_metres;

INSERT INTO users (id, name, email, password_hash, role, hostel_id, room_number, is_active)
VALUES (
  '00b16e79-292f-43d3-9c91-4953626f49a1',
  'IT Building Warden',
  'itb@nitj.ac.in',
  '$2a$10$GtwXiJPyYapRPBoR/Gqkq.D6GwEIxMJB/isVne5CORGS7tnpCKGcW',
  'warden',
  'cd4800be-3f83-4367-aa7c-361934d07906',
  NULL,
  true
)
ON CONFLICT (email) DO UPDATE
SET
  name = EXCLUDED.name,
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  hostel_id = EXCLUDED.hostel_id,
  room_number = EXCLUDED.room_number,
  is_active = EXCLUDED.is_active;
