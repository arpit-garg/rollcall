# Rollcall

Rollcall is a multi-signal hostel attendance system for student attendance, leave approval, and warden administration.
It combines a student-focused Expo mobile app, a React admin dashboard for wardens, parents, and super admins, and a Docker-based backend stack built around Express, FastAPI, PostgreSQL, Redis, MinIO, and NGINX.

## What It Does

- Students sign up with an email address, enroll a face template, receive in-app notifications, request leave, and mark attendance during active hostel windows.
- Wardens open and close attendance windows, monitor live attendance records, review selected-window rosters, and log manual overrides when needed.
- Parents sign up separately using a registered student ID, review their linked child's attendance trail, and approve or reject leave requests.
- Super admins manage hostels and create warden accounts from the dashboard.

## Current Product Surface

- `mobile-app/`
  Student-only Expo app for login/signup, face enrollment, attendance, leave requests, history, and in-app notifications.
- `admin-dashboard/`
  React dashboard for wardens, parents, and super admins.
- `services/auth-service/`
  Authentication, signup, parent signup/linking, refresh token rotation, and super-admin management endpoints.
- `services/attendance-service/`
  Attendance windows, submissions, leave flows, overrides, notifications, selected-window roster, and parent-linked child views.
- `services/ml-service/`
  FastAPI service for face verification and liveness. Local development can run in demo mode.
- `db/migrations/`
  Flyway migrations for schema, seed data, parent/student linking, notifications, and leave support.
- `nginx/`
  Local API gateway and Socket.IO proxy.

## Architecture

```text
Admin Dashboard (Vite + React) ----\
                                    \
Mobile App (Expo + React Native) ----> NGINX Gateway :8080
                                      /        |            \
                                     /         |             \
                           Auth Service    Attendance      ML Service
                              :3001          :3002           :8000
                                 |             |                |
                                 +------ PostgreSQL ------------+
                                 +-------- Redis --------------+
                                               |
                                             MinIO
```

## Repo Layout

```text
admin-dashboard/                 Web dashboard for wardens, parents, super admins
mobile-app/                      Expo student app
services/
  auth-service/                  Auth, signup, refresh sessions, role management
  attendance-service/            Attendance windows, submissions, leave, overrides
  ml-service/                    FastAPI verification/liveness service
  test-support/                  Shared test connection helpers
db/migrations/                   Flyway schema and seed data
nginx/                           Local gateway config
docker-compose.yml               Local stack
package.json                     Root convenience scripts
```

## Prerequisites

- Docker and Docker Compose
- Node.js 20+ and npm
- Python 3.11 if you want to run the ML service checks outside Docker
- Expo Go or an emulator/device for the mobile app

## Quick Start

1. Create the backend environment file:

```bash
cp .env.example .env
```

2. Start the backend stack:

```bash
npm run compose:up
```

Use `docker compose up -d --build` instead if you want it in the background.

3. Install local JavaScript dependencies if you plan to run the dashboard, mobile app, or service tests outside Docker:

```bash
npm install --prefix services/auth-service
npm install --prefix services/attendance-service
npm install --prefix admin-dashboard
npm install --prefix mobile-app
```

4. Start the admin dashboard:

```bash
npm run dev --prefix admin-dashboard
```

5. Start the mobile app:

```bash
npm run start --prefix mobile-app
```

The first `ml-service` image build is the slowest part of setup because it installs CPU PyTorch and model dependencies.
The default `.env.example` also enables `ENABLE_DEMO_RESOLUTION=true`, so local attendance can resolve without a production ML pipeline.

## Local URLs And Ports

| Surface | URL / Port | Notes |
| --- | --- | --- |
| API gateway | `http://localhost:8080` | Best entrypoint for mobile traffic |
| Admin dashboard | `http://localhost:5173` | Vite dev server |
| Auth service | `http://localhost:3001/api/v1` | Direct service access |
| Attendance service | `http://localhost:3002/api/v1` | Direct service access |
| ML service | `http://localhost:8000` | FastAPI |
| Postgres | `localhost:5435` | Docker-mapped from container `5432` |
| Redis | `localhost:6379` | Local queue/session store |
| MinIO API | `http://localhost:9000` | Object storage |
| MinIO console | `http://localhost:9001` | Uses `.env` MinIO credentials |

Health endpoints:

- `http://localhost:8080/health/auth`
- `http://localhost:8080/health/attendance`
- `http://localhost:8080/health/ml`

## Frontend Configuration

### Admin dashboard

Copy the dashboard env file if you need custom service URLs:

```bash
cp admin-dashboard/.env.example admin-dashboard/.env
```

Default values point directly to `localhost:3001` and `localhost:3002`.

### Mobile app

The mobile app auto-detects a sensible server origin in development and builds API URLs through the gateway on `:8080`.

- iOS simulator / local desktop: defaults toward `http://localhost`
- Android emulator: defaults toward `http://10.0.2.2`
- Physical device on LAN: use your machine's LAN IP if auto-detection is wrong

Optional override:

```bash
EXPO_PUBLIC_SERVER_ORIGIN=http://192.168.1.25 npm run start --prefix mobile-app
```
