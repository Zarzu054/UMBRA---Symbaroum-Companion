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

## Backups

Los datos de usuarios viven en PostgreSQL. Consulta `docs/BACKUPS.md` para crear backups manuales, enviarlos por email y restaurarlos.

Ejemplo rapido para crear un backup y enviarlo por email:

```bash
cd ~/UMBRA---Symbaroum-Companion
bash deploy/ubuntu/backup-postgres-email.sh destino@example.com
```

## Deploy automatico desde GitHub Actions

Se ha preparado el workflow:

- `.github/workflows/deploy-main.yml`

Y el script remoto:

- `deploy/ubuntu/deploy.sh`

El flujo es:

1. push a `main`
2. GitHub Actions entra por SSH al servidor
3. en el servidor se ejecuta:
   - `git fetch origin main`
   - `git checkout main`
   - `git reset --hard origin/main`
   - `docker compose ... up -d --build`
   - comprobacion de `http://127.0.0.1:4000/health`

### Secrets de GitHub necesarios

En el repositorio de GitHub, crea estos secrets:

- `DEPLOY_HOST`
- `DEPLOY_PORT`
- `DEPLOY_USER`
- `DEPLOY_SSH_KEY`
- `DEPLOY_PATH`

Valores esperados:

- `DEPLOY_HOST`: IP o hostname publico del servidor
- `DEPLOY_PORT`: normalmente `22`
- `DEPLOY_USER`: usuario SSH del servidor, por ejemplo `zarzu`
- `DEPLOY_SSH_KEY`: clave privada que GitHub Actions usara para entrar al servidor
- `DEPLOY_PATH`: ruta absoluta del repo en el servidor, por ejemplo `/home/zarzu/UMBRA---Symbaroum-Companion`

### Preparacion del servidor para el deploy por git

El servidor debe poder hacer `git fetch origin main` sin pedir password.

Opciones validas:

- usar una deploy key SSH en el servidor con acceso de solo lectura al repo
- o usar una clave SSH personal del usuario del servidor con acceso al repo

Compruebalo en el servidor:

```bash
cd ~/UMBRA---Symbaroum-Companion
git fetch origin main
```

Si ese comando pide credenciales o falla, GitHub Actions no podra desplegar.
