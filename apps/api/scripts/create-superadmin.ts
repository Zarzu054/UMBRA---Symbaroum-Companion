import argon2 from "argon2";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();

const inputSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z
    .string()
    .min(12)
    .max(128)
    .regex(/[a-z]/)
    .regex(/[A-Z]/)
    .regex(/[0-9]/)
    .regex(/[^A-Za-z0-9]/)
});

async function readInput(): Promise<{ email: string; password: string }> {
  let input = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) {
    input += chunk;
  }

  const separatorIndex = input.indexOf("\n");
  if (separatorIndex < 0) {
    throw new Error("INVALID_INPUT");
  }

  const email = input.slice(0, separatorIndex).replace(/\r$/, "");
  const password = input.slice(separatorIndex + 1).replace(/\r?\n$/, "");
  const parsed = inputSchema.safeParse({ email, password });
  if (!parsed.success) {
    throw new Error("INVALID_INPUT");
  }
  return {
    email: parsed.data.email!,
    password: parsed.data.password!
  };
}

async function main(): Promise<void> {
  const { email, password } = await readInput();
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { role: true }
  });

  if (existing) {
    if (existing.role === "superadmin") {
      throw new Error("SUPERADMIN_EXISTS");
    }
    throw new Error("EMAIL_IN_USE");
  }

  const passwordHash = await argon2.hash(password);
  await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: "superadmin",
      status: "active",
      mustChangePassword: true
    }
  });

  process.stdout.write(`Cuenta superadmin creada: ${email}\n`);
  process.stdout.write("Debera cambiar la contrasena en el primer inicio de sesion.\n");
}

main()
  .catch((error: unknown) => {
    const code = error instanceof Error ? error.message : "";
    if (code === "INVALID_INPUT") {
      process.stderr.write(
        "Correo o contrasena no validos. La contrasena debe tener entre 12 y 128 caracteres, con mayuscula, minuscula, numero y simbolo.\n"
      );
    } else if (code === "SUPERADMIN_EXISTS") {
      process.stderr.write("Ya existe una cuenta superadmin con ese correo. No se ha modificado.\n");
    } else if (code === "EMAIL_IN_USE") {
      process.stderr.write("El correo ya pertenece a una cuenta de jugador o director. No se ha modificado.\n");
    } else {
      process.stderr.write("No se pudo crear la cuenta superadmin. Revisa la conexion y los logs de PostgreSQL.\n");
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
