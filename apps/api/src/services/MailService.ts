import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

function getConfiguredFromAddress(): string {
  return env.SMTP_FROM || env.SMTP_USER;
}

export class MailService {
  private transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER && env.SMTP_PASS ? {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS
    } : undefined
  });

  isConfigured(): boolean {
    return Boolean(env.SMTP_HOST && getConfiguredFromAddress());
  }

  async sendPasswordResetEmail(recipientEmail: string, resetUrl: string): Promise<void> {
    if (!this.isConfigured()) {
      throw new AppError("MAIL_NOT_CONFIGURED", "El envio de correo no esta configurado", 503);
    }

    await this.transporter.sendMail({
      from: getConfiguredFromAddress(),
      to: recipientEmail,
      subject: "UMBRA · Recuperacion de contrasena",
      text: [
        "Has solicitado restablecer tu contrasena en UMBRA.",
        "",
        "Abre este enlace para definir una nueva contrasena:",
        resetUrl,
        "",
        "Si no solicitaste este cambio, puedes ignorar este mensaje."
      ].join("\n"),
      html: `
        <div style="font-family: Georgia, serif; color: #231913;">
          <h2 style="margin-bottom: 12px;">UMBRA</h2>
          <p>Has solicitado restablecer tu contrasena.</p>
          <p>
            <a href="${resetUrl}" style="display:inline-block;padding:10px 16px;border-radius:12px;background:#efe6d6;border:1px solid #b69872;color:#7f341f;text-decoration:none;">
              Restablecer contrasena
            </a>
          </p>
          <p style="word-break: break-all;">${resetUrl}</p>
          <p>Si no solicitaste este cambio, puedes ignorar este mensaje.</p>
        </div>
      `
    });
  }
}
