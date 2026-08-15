import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const apiRoot = path.resolve(__dirname, "..");
const migrationsDir = path.join(apiRoot, "prisma", "migrations");

function runPrisma(args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn("npx", ["prisma", ...args], {
      cwd: apiRoot,
      env: process.env,
      shell: true,
      stdio: options.inherit ? "inherit" : ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    if (!options.inherit) {
      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
    }

    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

function runSheetRepair() {
  return new Promise((resolve) => {
    const child = spawn("npx", ["tsx", "scripts/repair-character-sheets.ts"], {
      cwd: apiRoot,
      env: process.env,
      shell: true,
      stdio: "inherit"
    });
    child.on("close", (code) => resolve(code ?? 1));
  });
}

function runCampaignItemImport() {
  return new Promise((resolve) => {
    const child = spawn("npx", ["tsx", "scripts/import-campaign-items.ts"], {
      cwd: apiRoot,
      env: process.env,
      shell: true,
      stdio: "inherit"
    });
    child.on("close", (code) => resolve(code ?? 1));
  });
}

async function finishWithSheetRepair() {
  output("Revisando y normalizando las fichas existentes...");
  const repairCode = await runSheetRepair();
  if (repairCode !== 0) {
    fail("Las migraciones se aplicaron, pero la reparación de fichas no pudo completarse.");
  }
  output("Importando los objetos personalizados de personajes vinculados...");
  const importCode = await runCampaignItemImport();
  if (importCode !== 0) {
    fail("Las migraciones se aplicaron, pero la importación de objetos de campaña no pudo completarse.");
  }
  process.exit(0);
}

async function getMigrationNames() {
  const entries = await readdir(migrationsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function output(text) {
  process.stdout.write(`${text}\n`);
}

function fail(text) {
  process.stderr.write(`${text}\n`);
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  fail("DATABASE_URL no esta definido. No se puede ejecutar el despliegue de migraciones.");
}

const deploy = await runPrisma(["migrate", "deploy"]);
if (deploy.code === 0) {
  process.stdout.write(deploy.stdout);
  process.stderr.write(deploy.stderr);
  await finishWithSheetRepair();
}

const deployOutput = `${deploy.stdout}\n${deploy.stderr}`;
const looksLikeNonEmptyBaselineCase =
  deployOutput.includes("P3005") ||
  /schema .* not empty/i.test(deployOutput) ||
  /database schema is not empty/i.test(deployOutput);

if (!looksLikeNonEmptyBaselineCase) {
  process.stdout.write(deploy.stdout);
  process.stderr.write(deploy.stderr);
  process.exit(deploy.code);
}

output("Base de datos no vacia detectada sin historial de Prisma. Verificando si el esquema actual ya coincide con prisma/schema.prisma...");

const diff = await runPrisma(["migrate", "diff", "--from-url", process.env.DATABASE_URL, "--to-schema-datamodel", "prisma/schema.prisma", "--exit-code"]);
if (diff.code === 2) {
  process.stdout.write(diff.stdout);
  process.stderr.write(diff.stderr);
  fail(
    "La base de datos no vacia no coincide con el schema actual. No es seguro hacer baseline automatico. Ajusta el esquema o resuelve manualmente las migraciones."
  );
}

if (diff.code !== 0) {
  process.stdout.write(diff.stdout);
  process.stderr.write(diff.stderr);
  fail("No se pudo verificar el diff del esquema antes del baseline automatico.");
}

const migrationNames = await getMigrationNames();
output(`Esquema alineado detectado. Marcando ${migrationNames.length} migraciones como aplicadas...`);

for (const migrationName of migrationNames) {
  const resolveResult = await runPrisma(["migrate", "resolve", "--applied", migrationName], { inherit: true });
  if (resolveResult.code !== 0) {
    fail(`No se pudo marcar la migracion ${migrationName} como aplicada.`);
  }
}

output("Baseline automatico completado. Ejecutando prisma migrate deploy de nuevo...");

const secondDeploy = await runPrisma(["migrate", "deploy"], { inherit: true });
if (secondDeploy.code !== 0) {
  fail("El despliegue de migraciones fallo incluso despues del baseline automatico.");
}

await finishWithSheetRepair();
