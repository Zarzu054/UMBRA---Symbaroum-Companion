#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${1:-}"
BACKUP_PATH="${2:-}"
ENV_FILE="${3:-deploy/ubuntu/.env.server}"
COMPOSE_FILE="${4:-docker-compose.prod.yml}"
CONFIRM="${5:-}"

if [ -z "$REPO_DIR" ] || [ -z "$BACKUP_PATH" ]; then
  echo "Uso: deploy/ubuntu/restore-postgres.sh <repo-dir> <backup.dump> [env-file] [compose-file] --yes" >&2
  exit 1
fi

if [ "$CONFIRM" != "--yes" ]; then
  echo "Restaurar reemplazara los datos actuales de PostgreSQL. Vuelve a ejecutar con --yes para confirmar." >&2
  exit 1
fi

if [ ! -d "$REPO_DIR" ]; then
  echo "No existe el directorio del repo: $REPO_DIR" >&2
  exit 1
fi

if [ ! -f "$BACKUP_PATH" ]; then
  echo "No existe el backup: $BACKUP_PATH" >&2
  exit 1
fi

cd "$REPO_DIR"

if [ ! -f "$ENV_FILE" ]; then
  echo "Falta el archivo de entorno: $ENV_FILE" >&2
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD=(docker-compose)
else
  echo "No se ha encontrado Docker Compose en el servidor." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

: "${POSTGRES_DB:?POSTGRES_DB no esta definido en $ENV_FILE}"
: "${POSTGRES_USER:?POSTGRES_USER no esta definido en $ENV_FILE}"

if [ -f "${BACKUP_PATH}.sha256" ]; then
  sha256sum --check "${BACKUP_PATH}.sha256"
fi

"${COMPOSE_CMD[@]}" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d postgres
"${COMPOSE_CMD[@]}" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" stop app >/dev/null 2>&1 || true

echo "Limpiando esquema public actual..."
"${COMPOSE_CMD[@]}" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres \
  psql --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" \
  --command="DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"

echo "Restaurando backup: $BACKUP_PATH"
"${COMPOSE_CMD[@]}" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres \
  pg_restore \
    --username="$POSTGRES_USER" \
    --dbname="$POSTGRES_DB" \
    --no-owner \
    --no-acl \
  < "$BACKUP_PATH"

"${COMPOSE_CMD[@]}" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d app

echo "Restauracion completada."
