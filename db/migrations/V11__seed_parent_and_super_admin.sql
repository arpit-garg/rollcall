INSERT INTO users (id, name, email, password_hash, role, hostel_id, room_number, is_active)
VALUES
(
  '4b9bb865-c6dc-453f-8d28-5ddb7a3dc4ad',
  'Campus Super Admin',
  'superadmin@college.edu',
  '$2a$10$GtwXiJPyYapRPBoR/Gqkq.D6GwEIxMJB/isVne5CORGS7tnpCKGcW',
  'super_admin',
  NULL,
  NULL,
  true
),
(
  '971f9e22-7d24-4cc4-b09a-c9ccbd68fbf4',
  'Sonal Parent',
  'parent@college.edu',
  '$2a$10$KOm/zgc.9aDfkSfgVJLhhuWWKJfy63F/fAAyYyiTDiy3oKdYJJyUW',
  'parent',
  '0f68b6d1-a7cf-47cf-b23e-7e4ff6ca58a4',
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

INSERT INTO parent_students (parent_id, student_id)
VALUES (
  '971f9e22-7d24-4cc4-b09a-c9ccbd68fbf4',
  '8f71928b-74d0-4dbb-b30a-1e5da85a20fd'
)
ON CONFLICT (student_id) DO UPDATE
SET parent_id = EXCLUDED.parent_id;
