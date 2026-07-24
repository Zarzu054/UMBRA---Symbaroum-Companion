# Produccion local en este PC

## Modelo operativo

- PostgreSQL corre en Docker usando el servicio `postgres` ya existente.
- La API corre nativamente en Node.js sobre este PC.
- En produccion, la API sirve el frontend compilado, asi que todo entra por el mismo origen.
- El acceso publico por registro queda deshabilitado.

## Archivos preparados

- `.env`
- `apps/web/.env.production`
- `scripts/bootstrap-production.ps1`
- `scripts/start-production.ps1`

## Primer arranque

Desde la raiz del repo:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\bootstrap-production.ps1
```

Este paso:

- levanta PostgreSQL
- instala dependencias
- genera Prisma
- aplica migraciones
- ejecuta el seed inicial
- compila `packages/shared`
- compila `apps/web`

## Arranque normal

Desde la raiz del repo:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-production.ps1
```

La aplicacion quedara disponible en:

```text
http://<IP-DE-ESTE-PC>:4000
```

## Cuentas seed del MVP

- `aliciagarciamanzano16@gmail.com`
- `carloszarzuelar@gmail.com`
- `pabpinbae@gmail.com`
- `hugo.villasan.gt@gmail.com`

Contrasena inicial:

```text
UmbraStart123!
```

Cada usuario debe cambiarla en el primer login.

## Importante sobre el seed

- El seed ya no resetea contrasenas existentes por defecto.
- Si alguna vez quieres forzar el reseteo de las cuentas seed, cambia en `.env`:

```text
RESET_SEEDED_PASSWORDS=true
```

- Ejecuta de nuevo:

```powershell
npm.cmd run prisma:seed --prefix apps/api
```

- Luego vuelve a dejar `RESET_SEEDED_PASSWORDS=false`.

## Rebuild del frontend tras cambios

Si cambias codigo del frontend:

```powershell
npm.cmd run build --prefix packages/shared
npm.cmd run build --prefix apps/web
```

## Recomendaciones operativas minimas

- Abre el puerto `4000` en el firewall solo para tu red o los IPs que necesites.
- El registro público está deshabilitado. Las cuentas de juego se crean desde el panel de superadministración.
- Si mas adelante pones un dominio o HTTPS, coloca un reverse proxy delante de `http://localhost:4000`.
