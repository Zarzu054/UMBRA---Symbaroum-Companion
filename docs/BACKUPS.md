# Backups de produccion

Los datos creados por usuarios viven en PostgreSQL. En produccion Docker los guarda en el volumen `umbra_postgres_prod_data`, pero ese volumen esta en el disco del servidor. Si el portatil muere, ese volumen muere con el portatil.

La estrategia minima es:

1. Crear un `pg_dump` periodico.
2. Guardarlo en una carpeta local del servidor.
3. Copiarlo tambien fuera del servidor: disco externo, NAS, carpeta sincronizada, rclone, etc.
4. Probar una restauracion antes de confiar en el sistema.

## Crear un backup manual

En el servidor Ubuntu:

```bash
cd ~/UMBRA---Symbaroum-Companion
bash deploy/ubuntu/backup-postgres.sh
```

Por defecto crea archivos en:

```text
~/umbra-backups/postgres/
```

Cada backup genera:

- `umbra-postgres-YYYYMMDD-HHMMSS.dump`
- `umbra-postgres-YYYYMMDD-HHMMSS.dump.sha256`

El `.dump` es un backup comprimido en formato custom de PostgreSQL. El `.sha256` sirve para comprobar que el archivo no se ha corrompido.

## Crear y enviar un backup por email

Configura SMTP en `deploy/ubuntu/.env.server`:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=usuario@example.com
SMTP_PASS=replace-with-smtp-password
SMTP_FROM=usuario@example.com
```

Despues ejecuta:

```bash
cd ~/UMBRA---Symbaroum-Companion
bash deploy/ubuntu/backup-postgres-email.sh destino@example.com
```

Tambien puedes ejecutarlo sin parametro y el script preguntara el email destino:

```bash
bash deploy/ubuntu/backup-postgres-email.sh
```

El script:

1. Crea un backup PostgreSQL igual que `backup-postgres.sh`.
2. Guarda el `.dump` y el `.sha256` en `~/umbra-backups/postgres/`.
3. Envia ambos archivos como adjuntos al email indicado.

Importante: el backup puede contener datos sensibles, incluyendo emails de usuarios, hashes de contrasena, tokens, personajes, campañas, notas y mensajes. Usa un correo de confianza y una cuenta SMTP protegida. Si la base de datos crece, el proveedor de email puede rechazar el adjunto por tamano; en ese caso usa `UMBRA_BACKUP_REMOTE_DIR`, `scp`, `rclone` o un almacenamiento externo.

## Copiar backups fuera del portatil

Define una ruta remota o externa en `deploy/ubuntu/.env.server`:

```env
UMBRA_BACKUP_REMOTE_DIR=/mnt/backup-disk/umbra-postgres
UMBRA_BACKUP_RETENTION_DAYS=30
```

Puede ser un disco USB montado, una carpeta de red, una carpeta sincronizada por otro servicio o cualquier ruta que no dependa del disco interno del portatil.

Despues ejecuta:

```bash
bash deploy/ubuntu/backup-postgres.sh
```

El script guardara el backup en la carpeta local y copiara tambien el `.dump` y el `.sha256` a `UMBRA_BACKUP_REMOTE_DIR`.

## Programar backup diario con cron

Edita el cron del usuario que despliega la app:

```bash
crontab -e
```

Añade una ejecucion diaria, por ejemplo a las 04:15:

```cron
15 4 * * * cd /home/zarzu/UMBRA---Symbaroum-Companion && bash deploy/ubuntu/backup-postgres.sh >> /home/zarzu/umbra-backups/backup.log 2>&1
```

Ajusta `/home/zarzu/UMBRA---Symbaroum-Companion` si tu repo esta en otra ruta.

## Restaurar un backup

La restauracion reemplaza los datos actuales de PostgreSQL. Usala solo en una instalacion nueva o tras confirmar que quieres sobrescribir la base de datos actual.

```bash
cd ~/UMBRA---Symbaroum-Companion
bash deploy/ubuntu/restore-postgres.sh \
  "$PWD" \
  "$HOME/umbra-backups/postgres/umbra-postgres-YYYYMMDD-HHMMSS.dump" \
  deploy/ubuntu/.env.server \
  docker-compose.prod.yml \
  --yes
```

El script:

1. Verifica el checksum si existe el archivo `.sha256`.
2. Para temporalmente el contenedor `app`.
3. Limpia el esquema `public` de PostgreSQL.
4. Restaura el dump.
5. Arranca de nuevo `app`.

## Comprobacion recomendada

Una vez al mes, copia el ultimo backup a otra maquina o a una instalacion de prueba y ejecuta la restauracion. Un backup que nunca se ha restaurado es solo una suposicion.

## Que queda protegido

Estos backups protegen:

- usuarios
- personajes
- monstruos
- NPCs
- campañas
- sesiones
- notas compartidas
- referencias de campaña
- mensajes de chat de campaña
- logs de experiencia
- tokens de sesion y reseteo existentes en base de datos

No protegen automaticamente archivos que vivan fuera de PostgreSQL. En este repo, los libros, resumenes y codigo ya deberian estar en Git/GitHub.
