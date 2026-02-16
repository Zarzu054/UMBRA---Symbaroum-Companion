import cors from "@fastify/cors";
import Fastify from "fastify";
import { ZodError } from "zod";
import { verifyDatabaseConnection, prisma } from "./config/prisma.js";
import { env } from "./config/env.js";
import { registerRoutes } from "./routes/index.js";
import { AppError } from "./utils/AppError.js";

async function bootstrap(): Promise<void> {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: true,
    credentials: true
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
      const issues = (error as { issues: Array<{ message?: string }> }).issues;
      const first = issues[0];
      reply.code(400).send({
        error: "VALIDATION_ERROR",
        message: first?.message ?? "Datos de entrada invalidos"
      });
      return;
    }

    if (typeof (error as { statusCode?: unknown }).statusCode === "number") {
      const statusCode = (error as { statusCode: number }).statusCode;
      if (statusCode >= 400 && statusCode < 500) {
        reply.code(statusCode).send({
          error: "REQUEST_ERROR",
          message: error.message || "Solicitud invalida"
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
  await verifyDatabaseConnection();

  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });

  await app.listen({ port: env.API_PORT, host: "0.0.0.0" });
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
