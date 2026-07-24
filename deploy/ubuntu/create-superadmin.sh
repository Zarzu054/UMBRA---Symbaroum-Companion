#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${1:-$(pwd)}"
ENV_FILE="${2:-deploy/ubuntu/.env.server}"
COMPOSE_FILE="${3:-docker-compose.prod.yml}"

fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

if [ ! -d "$REPO_DIR" ]; then
  fail "No existe el directorio del repositorio: $REPO_DIR"
fi

cd "$REPO_DIR"

if [ ! -f "$ENV_FILE" ]; then
  fail "Falta el archivo de entorno: $ENV_FILE"
fi

if [ ! -f "$COMPOSE_FILE" ]; then
  fail "Falta el archivo de Docker Compose: $COMPOSE_FILE"
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD=(docker-compose)
else
  fail "No se ha encontrado Docker Compose en el servidor."
fi

if ! "${COMPOSE_CMD[@]}" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T app true >/dev/null 2>&1; then
  fail "El contenedor app no esta en ejecucion. Despliega UMBRA antes de crear el superadmin."
fi

if [ ! -t 0 ]; then
  fail "Este script debe ejecutarse de forma interactiva desde una terminal."
fi

read -r -p "Correo del superadmin: " superadmin_email
if [ -z "$superadmin_email" ]; then
  fail "El correo no puede estar vacio."
fi

read -r -s -p "Contrasena temporal: " superadmin_password
printf '\n'
read -r -s -p "Repite la contrasena temporal: " superadmin_password_confirmation
printf '\n'

if [ "$superadmin_password" != "$superadmin_password_confirmation" ]; then
  unset superadmin_password superadmin_password_confirmation
  fail "Las contrasenas no coinciden."
fi

if [ "${#superadmin_password}" -lt 12 ]; then
  unset superadmin_password superadmin_password_confirmation
  fail "La contrasena debe tener al menos 12 caracteres."
fi

printf '%s\n%s\n' "$superadmin_email" "$superadmin_password" |
  "${COMPOSE_CMD[@]}" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T app \
    npm run superadmin:create --prefix apps/api

unset superadmin_password superadmin_password_confirmation
