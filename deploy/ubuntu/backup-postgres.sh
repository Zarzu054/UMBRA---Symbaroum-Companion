#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${1:-$HOME/UMBRA---Symbaroum-Companion}"
ENV_FILE="${2:-deploy/ubuntu/.env.server}"
COMPOSE_FILE="${3:-docker-compose.prod.yml}"
BACKUP_DIR="${4:-${UMBRA_BACKUP_DIR:-$HOME/umbra-backups/postgres}}"
RETENTION_DAYS="${UMBRA_BACKUP_RETENTION_DAYS:-14}"

if [ ! -d "$REPO_DIR" ]; then
  echo "No existe el directorio del repo: $REPO_DIR" >&2
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

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

timestamp="$(date -u +%Y%m%d-%H%M%S)"
backup_name="umbra-postgres-${timestamp}.dump"
backup_path="${BACKUP_DIR}/${backup_name}"
checksum_path="${backup_path}.sha256"

echo "Creando backup: $backup_path"

"${COMPOSE_CMD[@]}" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres \
  pg_dump \
    --username="$POSTGRES_USER" \
    --dbname="$POSTGRES_DB" \
    --format=custom \
    --compress=9 \
    --no-owner \
    --no-acl \
    --file=- \
  > "$backup_path"

sha256sum "$backup_path" > "$checksum_path"
chmod 600 "$backup_path" "$checksum_path"

if [ -n "${UMBRA_BACKUP_REMOTE_DIR:-}" ]; then
  mkdir -p "$UMBRA_BACKUP_REMOTE_DIR"
  chmod 700 "$UMBRA_BACKUP_REMOTE_DIR" 2>/dev/null || true
  cp "$backup_path" "$checksum_path" "$UMBRA_BACKUP_REMOTE_DIR/"
  echo "Backup copiado a: $UMBRA_BACKUP_REMOTE_DIR"
fi

if [ "$RETENTION_DAYS" -gt 0 ]; then
  find "$BACKUP_DIR" -type f \( -name "umbra-postgres-*.dump" -o -name "umbra-postgres-*.dump.sha256" \) -mtime +"$RETENTION_DAYS" -delete

  if [ -n "${UMBRA_BACKUP_REMOTE_DIR:-}" ] && [ -d "$UMBRA_BACKUP_REMOTE_DIR" ]; then
    find "$UMBRA_BACKUP_REMOTE_DIR" -type f \( -name "umbra-postgres-*.dump" -o -name "umbra-postgres-*.dump.sha256" \) -mtime +"$RETENTION_DAYS" -delete
  fi
fi

echo "Backup completado:"
echo "$backup_path"
