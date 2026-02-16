# UMBRA - Symbaroum Companion

Monorepo skeleton for a TypeScript full-stack app with MVC-oriented structure on both backend and frontend.

## Stack

- Backend: Node.js, Fastify, TypeScript, PostgreSQL
- Frontend: React, Vite, TypeScript
- Shared package: `packages/shared` for types and validation schemas
- ORM and migrations: Prisma
- Containerized dev runtime: Docker Compose

## Project structure

- `apps/api`: Backend API with MVC folders (`models`, `services`, `controllers`, `routes`)
- `apps/api/prisma`: Prisma schema, migrations and seed
- `apps/web`: React app with MVC-like folders (`models`, `services`, `controllers`, `views`)
- `packages/shared`: Shared contracts and schemas
- `docker-compose.umbra.dev.yml`: Local development orchestration

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
   - `npm install`
2. Generate Prisma client and apply migrations:
   - `npm run prisma:generate -w @umbra/api`
   - `npm run prisma:migrate:deploy -w @umbra/api`
   - `npm run prisma:seed -w @umbra/api`
3. Start API:
   - `npm run dev:api`
4. Start Web:
   - `npm run dev:web`

## Current API endpoints

- `GET /health`
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`
- `GET /api/characters` (protected)
- `POST /api/characters` (protected)

## Dev seed user

- email: `dev-player@umbra.local`
- password: `ChangeMe123!`

## Notes

- Access tokens are short lived and refresh tokens rotate on `/auth/refresh`.
- Character endpoints now resolve owner from the authenticated JWT.