import cors from "@fastify/cors";
import Fastify from "fastify";
import { verifyDatabaseConnection } from "./config/db.js";
import { env } from "./config/env.js";
import { registerRoutes } from "./routes/index.js";

async function bootstrap(): Promise<void> {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: true,
    credentials: true
  });

  await registerRoutes(app);
  await verifyDatabaseConnection();

  await app.listen({ port: env.API_PORT, host: "0.0.0.0" });
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});