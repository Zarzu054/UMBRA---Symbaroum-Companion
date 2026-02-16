import { Pool } from "pg";
import { env } from "./env.js";

export const db = new Pool({
  connectionString: env.DATABASE_URL
});

export async function verifyDatabaseConnection(): Promise<void> {
  await db.query("SELECT 1");
}