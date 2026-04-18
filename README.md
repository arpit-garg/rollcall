# Hostel Attendance Verification System

Initial implementation baseline for the college hostel attendance project described in the TRD.

This first pass sets up:

- Docker-based local infrastructure for PostgreSQL, Redis, MinIO, NGINX, and the backend services
- Flyway-managed database schema matching the current data model
- Auth, attendance, and ML service skeletons with working REST endpoints
- Starter shells for the admin dashboard and Expo mobile app

What is intentionally incomplete in this iteration:

- Real face recognition, template encryption, and liveness inference are stubbed behind the ML service
- BullMQ queue processing and WebSocket broadcasting are not wired yet
- Client apps are scaffolded, not feature-complete
- Automated tests and CI are not added yet

## Repo Layout

```text
admin-dashboard/       React dashboard shell
mobile-app/            Expo mobile shell
services/
  auth-service/        JWT auth and refresh flow
  attendance-service/  Windows, attendance submission, overrides
  ml-service/          FastAPI verification stub
db/migrations/         Flyway SQL migrations
nginx/                 API gateway routing
docker-compose.yml     Local dev stack
```

## Local Start

1. Copy `.env.example` to `.env`.
2. Adjust values if needed.
3. Start the backend stack:

```bash
docker compose up --build
```

The API gateway is exposed on `http://localhost:8080`.

## Next Build Slice

- Replace the ML stub with actual queue-driven verification
- Add face enrollment flow and template storage in MinIO
- Add Socket.IO updates for the dashboard
- Add seeded demo data and integration tests
