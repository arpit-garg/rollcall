INSERT INTO hostels (id, name, center_lat, center_lng, radius_metres)
VALUES (
  '0f68b6d1-a7cf-47cf-b23e-7e4ff6ca58a4',
  'Main Boys Hostel',
  28.6139390,
  77.2090230,
  150
),
(
  'a5a4bff2-179f-4eb1-8bf0-b8959d8a26bb',
  'Mbh-F',
  31.3996,
  75.5366,
  150
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  center_lat = EXCLUDED.center_lat,
  center_lng = EXCLUDED.center_lng,
  radius_metres = EXCLUDED.radius_metres;

INSERT INTO users (id, name, email, password_hash, role, hostel_id, room_number, is_active)
VALUES
(
  '8f71928b-74d0-4dbb-b30a-1e5da85a20fd',
  'Aarav Student',
  'student@college.edu',
  '$2a$10$KOm/zgc.9aDfkSfgVJLhhuWWKJfy63F/fAAyYyiTDiy3oKdYJJyUW',
  'student',
  '0f68b6d1-a7cf-47cf-b23e-7e4ff6ca58a4',
  'A-102',
  true
),
(
  '54c1feaf-7bb9-4cc7-ac54-f1ed08dcb22c',
  'Meera Warden',
  'warden@college.edu',
  '$2a$10$GtwXiJPyYapRPBoR/Gqkq.D6GwEIxMJB/isVne5CORGS7tnpCKGcW',
  'warden',
  '0f68b6d1-a7cf-47cf-b23e-7e4ff6ca58a4',
  NULL,
  true
),
(
  'f394f84f-2c92-4c26-bf87-2b4d0fc6ebca',
  'Riya Sharma',
  'riya.sharma@college.edu',
  '$2a$10$KOm/zgc.9aDfkSfgVJLhhuWWKJfy63F/fAAyYyiTDiy3oKdYJJyUW',
  'student',
  '0f68b6d1-a7cf-47cf-b23e-7e4ff6ca58a4',
  'A-204',
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

INSERT INTO users (id, name, email, password_hash, role, hostel_id, room_number, is_active)
VALUES
(
  '015ca63a-111a-4f2f-b1e3-2dac3ee22d4e',
  'MBH-F Warden',
  'mbhf@nitj.ac.in',
  '$2a$10$GtwXiJPyYapRPBoR/Gqkq.D6GwEIxMJB/isVne5CORGS7tnpCKGcW',
  'warden',
  'a5a4bff2-179f-4eb1-8bf0-b8959d8a26bb',
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
