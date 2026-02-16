# UMBRA - Symbaroum Companion

Monorepo skeleton for a TypeScript full-stack app with MVC-oriented structure on both backend and frontend.

## Stack

- Backend: Node.js, Fastify, TypeScript, PostgreSQL
- Frontend: React, Vite, TypeScript
- Shared package: `packages/shared` for types and validation schemas
- Containerized dev runtime: Docker Compose

## Project structure

- `apps/api`: Backend API with MVC folders (`models`, `services`, `controllers`, `routes`)
- `apps/web`: React app with MVC-like folders (`models`, `services`, `controllers`, `views`)
- `packages/shared`: Shared contracts and schemas
- `infra/postgres`: PostgreSQL init scripts
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

## Quick start without Docker

1. Install dependencies:
   - `npm install`
2. Start API:
   - `npm run dev:api`
3. Start Web:
   - `npm run dev:web`

## Current API endpoints

- `GET /health`
- `GET /api/characters`
- `POST /api/characters`

## Notes

- Auth is intentionally stubbed for now with a fixed dev owner id.
- The next step is implementing your custom auth module and replacing the dev owner logic.