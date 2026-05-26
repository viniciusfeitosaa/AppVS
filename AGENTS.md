# AGENTS.md

## Cursor Cloud specific instructions

### Overview

**Viva Saúde** is a multi-tenant healthcare workforce management platform (React + Express + PostgreSQL + Prisma). The repo has three main directories: `backend/`, `frontend/`, and `landing/` (static HTML).

### Services

| Service | Port | Command | Notes |
|---------|------|---------|-------|
| PostgreSQL 16 | 5432 | `sudo pg_ctlcluster 16 main start` | Must be running before backend starts. User `appmedico`, DB `appmedico`. |
| Backend (Express) | 3001 | `cd backend && npm run dev` | ts-node-dev with hot reload. Health check: `GET /health`. |
| Frontend (Vite) | 3000 | `cd frontend && npm run dev` | Proxies `/api` → `http://127.0.0.1:3001`. |

### Database setup (first time only)

The migrations assume a pre-existing baseline schema. For a fresh local database use `npx prisma db push` (in `backend/`) instead of `prisma migrate deploy`, then mark all migrations as applied:

```bash
cd backend
npx prisma db push --accept-data-loss
for dir in prisma/migrations/20*/; do npx prisma migrate resolve --applied "$(basename "$dir")"; done
npm run prisma:seed
```

After that, future `prisma migrate deploy` will work normally for new migrations.

### Seed credentials (dev only)

- **Master login endpoint**: `POST /api/auth/login-master`
- **Email**: `contato@sejavivasaude.com.br`
- **Password**: value of `MASTER_INITIAL_PASSWORD` in `backend/.env` (default: `MasterDev2024!`)

### Lint & Test

- Backend lint: `cd backend && npm run lint`
- Frontend lint: `cd frontend && npm run lint`
- Backend tests: `cd backend && npm test` (Jest, 12 unit tests)
- Frontend has no test script.

### Gotchas

- The backend starts the HTTP server immediately and connects to the DB in the background with retries. If the DB is unreachable the server still responds on `/health` but API calls that query the DB will fail.
- `backend/.env` and `frontend/.env` are gitignored. Create them from the respective `.env.example` files. Required backend vars: `DATABASE_URL`, `JWT_SECRET` (≥32 chars), `JWT_REFRESH_SECRET` (≥32 chars).
- SMTP / Resend / WhatsApp / DocuSeal env vars are optional for core dev work (login, dashboard, schedules).
