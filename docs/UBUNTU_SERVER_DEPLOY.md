# Ubuntu server deploy

## Arquitectura

- `cloudflared` ya corre en el host Ubuntu
- UMBRA se publica localmente solo en `127.0.0.1:4000`
- Cloudflare Tunnel apunta a `http://localhost:4000`
- Docker Compose levanta:
  - `postgres`
  - `app`

## Archivos preparados

- `docker-compose.prod.yml`
- `apps/api/Dockerfile.prod`
- `scripts/docker-entrypoint.prod.sh`
- `deploy/ubuntu/.env.server.example`

## Preparacion

En el servidor Ubuntu:

```bash
git clone <tu-repo> umbra
cd umbra
cp deploy/ubuntu/.env.server.example deploy/ubuntu/.env.server
```

Edita `deploy/ubuntu/.env.server` y define como minimo:

- `POSTGRES_PASSWORD`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- opcionalmente `SUPERADMIN_EMAIL`
- opcionalmente `SUPERADMIN_PASSWORD`

## Arranque

```bash
docker compose --env-file deploy/ubuntu/.env.server -f docker-compose.prod.yml up -d --build
```

## Cloudflare Tunnel

Haz que tu tunnel publique:

```text
umbra.z4rzu.com -> http://localhost:4000
```

Como el contenedor publica solo en `127.0.0.1:4000`, no expones el servicio directamente a internet fuera de Cloudflare Tunnel.

## Seed

Por defecto:

- `RUN_SEED_ON_START=true`
- el seed crea las 4 cuentas del grupo si no existen
- no resetea contrasenas existentes salvo que pongas `RESET_SEEDED_PASSWORDS=true`

Contrasena temporal inicial:

```text
UmbraStart123!
```

## Operacion diaria

Actualizar:

```bash
git pull
docker compose --env-file deploy/ubuntu/.env.server -f docker-compose.prod.yml up -d --build
```

Ver logs:

```bash
docker compose --env-file deploy/ubuntu/.env.server -f docker-compose.prod.yml logs -f app
```

Parar:

```bash
docker compose --env-file deploy/ubuntu/.env.server -f docker-compose.prod.yml down
```
