# UMBRA - Symbaroum Companion

Monorepo skeleton for a TypeScript full-stack app with MVC-oriented structure on both backend and frontend.

## Stack

- Backend: Node.js, Fastify, TypeScript, PostgreSQL
- Frontend: React, Vite, TypeScript
- Shared package: `packages/shared` for types and validation schemas
- ORM and migrations: Prisma
- Containerized dev runtime: Docker Compose

## Project structure

- `apps/api`: backend API with MVC folders (`models`, `services`, `controllers`, `routes`)
- `apps/api/prisma`: Prisma schema, migrations and seed
- `apps/web`: React app with MVC-like folders (`models`, `services`, `controllers`, `views`)
- `packages/shared`: shared contracts and schemas
- `docker-compose.umbra.dev.yml`: local development orchestration

## Quick start with Docker

1. Copy env values:
   - `cp .env.example .env`
2. Start stack:
   - `docker compose -f docker-compose.umbra.dev.yml up --build`
3. Open app:
   - `http://localhost:5173`
4. API health check:
   - `http://localhost:4000/health`

The API container automatically runs Prisma generate, migrations deploy and seed before starting dev mode.

## Quick start without Docker

1. Install dependencies:
   - `npm install --prefix packages/shared`
   - `npm install --prefix apps/api`
   - `npm install --prefix apps/web`
2. Generate Prisma client and apply migrations:
   - `npm run prisma:generate --prefix apps/api`
   - `npm run prisma:migrate:deploy --prefix apps/api`
   - `npm run prisma:seed --prefix apps/api`
3. Start API:
   - `npm run dev --prefix apps/api`
4. Start Web:
   - `npm run dev --prefix apps/web`

## Auth and roles

- Public registration is limited to: `player`, `gm`
- `superadmin` accounts are seeded only and not self-registrable
- Frontend includes login/register UI and persistent sessions with token refresh

## Current API endpoints

- `GET /health`
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`
- `GET /api/characters` (protected)
- `POST /api/characters` (protected)
- `GET /admin/users` (superadmin)
- `POST /admin/users/:userId/revoke-sessions` (superadmin)

## Seed users

- Player
  - email: `dev-player@umbra.local`
  - password: `ChangeMe123!`
- Superadmin
  - email: `superadmin@umbra.local` (or `.env` `SUPERADMIN_EMAIL`)
  - password: `SuperAdmin123!` (or `.env` `SUPERADMIN_PASSWORD`)

## Notes

- Superadmin dashboard is available in the frontend when logged in as a superadmin.
- Revoke sessions action invalidates all refresh tokens for the target user.