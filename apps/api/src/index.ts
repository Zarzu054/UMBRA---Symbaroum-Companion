import cors from "@fastify/cors";
import Fastify from "fastify";
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

    reply.code(500).send({
      error: "INTERNAL_SERVER_ERROR",
      message: "Unexpected error"
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