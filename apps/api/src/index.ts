import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { access, readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ZodError } from "zod";
import { verifyDatabaseConnection, prisma } from "./config/prisma.js";
import { env } from "./config/env.js";
import { registerRoutes } from "./routes/index.js";
import { AppError } from "./utils/AppError.js";

async function bootstrap(): Promise<void> {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: true,
    credentials: true,
    exposedHeaders: ["X-Umbra-Pdf-Page"]
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      reply.code(error.statusCode).send({
        error: error.code,
        message: error.message
      });
      return;
    }

    const zodLikeError =
      error instanceof ZodError ||
      (typeof error === "object" &&
        error !== null &&
        "name" in error &&
        (error as { name?: string }).name === "ZodError" &&
        "issues" in error &&
        Array.isArray((error as { issues?: unknown }).issues));

    if (zodLikeError) {
      const issues = (error as { issues: Array<{ message?: string; path?: Array<string | number> }> }).issues;
      const first = issues[0];
      reply.code(400).send({
        error: "VALIDATION_ERROR",
        message: first?.message ?? "Datos de entrada invalidos",
        details: issues.map((issue) => ({
          path: (issue.path ?? []).join("."),
          message: issue.message ?? "Valor invalido"
        }))
      });
      return;
    }

    if (typeof (error as { statusCode?: unknown }).statusCode === "number") {
      const statusCode = (error as { statusCode: number }).statusCode;
      if (statusCode >= 400 && statusCode < 500) {
        const message = error instanceof Error ? error.message : "Solicitud invalida";
        reply.code(statusCode).send({
          error: "REQUEST_ERROR",
          message
        });
        return;
      }
    }

    app.log.error({ err: error }, "Unhandled API error");

    reply.code(500).send({
      error: "INTERNAL_SERVER_ERROR",
      message: "Error inesperado"
    });
  });

  await registerRoutes(app);
  if (env.NODE_ENV === "production") {
    registerProductionFrontend(app);
  }
  await verifyDatabaseConnection();

  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });

  await app.listen({ port: env.API_PORT, host: "0.0.0.0" });
}

function registerProductionFrontend(app: FastifyInstance): void {
  const webDistRoot = fileURLToPath(new URL("../../web/dist/", import.meta.url));
  const indexFile = resolve(webDistRoot, "index.html");

  app.setNotFoundHandler(async (request, reply) => {
    const requestPath = request.url.split("?")[0] ?? "/";

    if (
      request.method !== "GET" ||
      requestPath.startsWith("/auth") ||
      requestPath.startsWith("/api") ||
      requestPath.startsWith("/admin") ||
      requestPath === "/health"
    ) {
      reply.code(404).send({
        error: "NOT_FOUND",
        message: "Recurso no encontrado"
      });
      return;
    }

    const candidatePath =
      requestPath === "/" || !extname(requestPath)
        ? indexFile
        : resolve(webDistRoot, `.${requestPath}`);

    if (!candidatePath.startsWith(webDistRoot)) {
      reply.code(403).send({
        error: "FORBIDDEN",
        message: "Ruta no permitida"
      });
      return;
    }

    const filePath = (await fileExists(candidatePath)) ? candidatePath : indexFile;
    if (!(await fileExists(filePath))) {
      reply.code(404).send({
        error: "WEB_BUILD_MISSING",
        message: "No se ha encontrado el build web de produccion"
      });
      return;
    }

    reply.type(getContentType(filePath));
    reply.send(await readFile(filePath));
  });
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function getContentType(path: string): string {
  switch (extname(path).toLowerCase()) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".woff2":
      return "font/woff2";
    case ".pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
