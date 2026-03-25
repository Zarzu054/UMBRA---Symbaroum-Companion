#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${1:-$HOME/UMBRA---Symbaroum-Companion}"
BRANCH="${2:-main}"
ENV_FILE="${3:-deploy/ubuntu/.env.server}"
COMPOSE_FILE="${4:-docker-compose.prod.yml}"

if [ ! -d "$REPO_DIR/.git" ]; then
  echo "No existe un repo git en: $REPO_DIR" >&2
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
else
  echo "No se ha encontrado Docker Compose en el servidor." >&2
  exit 1
fi

cd "$REPO_DIR"

if [ ! -f "$ENV_FILE" ]; then
  echo "Falta el archivo de entorno: $ENV_FILE" >&2
  exit 1
fi

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

$COMPOSE_CMD --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build

ATTEMPTS=18
SLEEP_SECONDS=5

for attempt in $(seq 1 "$ATTEMPTS"); do
  if curl -fsS http://127.0.0.1:4000/health >/dev/null 2>&1; then
    echo "Despliegue completado y healthcheck OK."
    exit 0
  fi

  echo "Esperando healthcheck ($attempt/$ATTEMPTS)..."
  sleep "$SLEEP_SECONDS"
done

echo "El despliegue termino, pero /health no responde correctamente." >&2
$COMPOSE_CMD --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps >&2 || true
$COMPOSE_CMD --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs --tail=120 app >&2 || true
exit 1
