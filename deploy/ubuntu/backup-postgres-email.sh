#!/usr/bin/env bash
set -euo pipefail

DESTINATION_EMAIL="${1:-}"
REPO_DIR="${2:-$HOME/UMBRA---Symbaroum-Companion}"
ENV_FILE="${3:-deploy/ubuntu/.env.server}"
COMPOSE_FILE="${4:-docker-compose.prod.yml}"
BACKUP_DIR="${5:-${UMBRA_BACKUP_DIR:-$HOME/umbra-backups/postgres}}"

if [ -z "$DESTINATION_EMAIL" ]; then
  read -r -p "Email destino para enviar el backup: " DESTINATION_EMAIL
fi

if [[ ! "$DESTINATION_EMAIL" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$ ]]; then
  echo "Email destino no valido: $DESTINATION_EMAIL" >&2
  exit 1
fi

if [ ! -d "$REPO_DIR" ]; then
  echo "No existe el directorio del repo: $REPO_DIR" >&2
  exit 1
fi

cd "$REPO_DIR"

if [ ! -f "$ENV_FILE" ]; then
  echo "Falta el archivo de entorno: $ENV_FILE" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

: "${SMTP_HOST:?SMTP_HOST no esta definido en $ENV_FILE}"

before_marker="$(mktemp)"
touch "$before_marker"

bash deploy/ubuntu/backup-postgres.sh "$REPO_DIR" "$ENV_FILE" "$COMPOSE_FILE" "$BACKUP_DIR"

backup_path="$(find "$BACKUP_DIR" -type f -name "umbra-postgres-*.dump" -newer "$before_marker" -printf "%T@ %p\n" | sort -nr | head -n 1 | cut -d' ' -f2-)"
rm -f "$before_marker"

if [ -z "$backup_path" ] || [ ! -f "$backup_path" ]; then
  echo "No se ha encontrado el backup recien creado en $BACKUP_DIR" >&2
  exit 1
fi

checksum_path="${backup_path}.sha256"

echo "Enviando backup a: $DESTINATION_EMAIL"
python3 deploy/ubuntu/send-backup-email.py \
  --to "$DESTINATION_EMAIL" \
  --backup "$backup_path" \
  --checksum "$checksum_path"

echo "Backup enviado por email:"
echo "$backup_path"
