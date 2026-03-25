#!/bin/sh
set -eu

cd /app

npm run prisma:generate --prefix apps/api
npm run prisma:migrate:deploy --prefix apps/api

if [ "${RUN_SEED_ON_START:-true}" = "true" ]; then
  npm run prisma:seed --prefix apps/api
fi

exec npm run start:prod --prefix apps/api
