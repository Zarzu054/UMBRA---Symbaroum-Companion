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

  async sendTemporaryCredentialsEmail(
    recipientEmail: string,
    temporaryPassword: string,
    kind: "welcome" | "reactivation" | "resend"
  ): Promise<void> {
    this.ensureConfigured();
    const loginUrl = env.APP_BASE_URL.replace(/\/$/, "");
    const heading = kind === "welcome"
      ? "Tu cuenta de UMBRA esta lista"
      : kind === "reactivation"
        ? "Tu cuenta de UMBRA ha sido reactivada"
        : "Nuevas credenciales temporales de UMBRA";

    await this.transporter.sendMail({
      from: getConfiguredFromAddress(),
      to: recipientEmail,
      subject: `UMBRA · ${heading}`,
      text: [
        heading,
        "",
        `Usuario: ${recipientEmail}`,
        `Contrasena temporal: ${temporaryPassword}`,
        "",
        "Por seguridad, deberas cambiar esta contrasena la primera vez que inicies sesion.",
        `Acceder a UMBRA: ${loginUrl}`,
        "",
        "Si no esperabas este mensaje, contacta con la administracion de UMBRA."
      ].join("\n"),
      html: `
        <div style="font-family:Georgia,serif;color:#231913;line-height:1.5;">
          <h2 style="margin-bottom:12px;">${escapeHtml(heading)}</h2>
          <p><strong>Usuario:</strong> ${escapeHtml(recipientEmail)}</p>
          <p><strong>Contrasena temporal:</strong></p>
          <p style="padding:12px;border:1px solid #b69872;border-radius:10px;background:#f7f0e5;font-family:monospace;font-size:18px;">
            ${escapeHtml(temporaryPassword)}
          </p>
          <p>Por seguridad, deberas cambiar esta contrasena la primera vez que inicies sesion.</p>
          <p>
            <a href="${escapeHtml(loginUrl)}" style="display:inline-block;padding:10px 16px;border-radius:12px;background:#efe6d6;border:1px solid #b69872;color:#7f341f;text-decoration:none;">
              Acceder a UMBRA
            </a>
          </p>
          <p>Si no esperabas este mensaje, contacta con la administracion de UMBRA.</p>
        </div>
      `
    });
  }

  async sendAccountDeactivatedEmail(
    recipientEmail: string,
    reasonLabel: string,
    explanation: string
  ): Promise<void> {
    this.ensureConfigured();

    await this.transporter.sendMail({
      from: getConfiguredFromAddress(),
      to: recipientEmail,
      subject: "UMBRA · Cuenta desactivada",
      text: [
        "Tu cuenta de UMBRA ha sido desactivada.",
        "",
        `Motivo: ${reasonLabel}`,
        `Explicacion: ${explanation}`,
        "",
        "El acceso y las sesiones de la cuenta han quedado bloqueados. Tus datos se conservan.",
        "Si necesitas mas informacion, contacta con la administracion de UMBRA."
      ].join("\n"),
      html: `
        <div style="font-family:Georgia,serif;color:#231913;line-height:1.5;">
          <h2 style="margin-bottom:12px;">Cuenta de UMBRA desactivada</h2>
          <p>Tu acceso y tus sesiones han quedado bloqueados. Tus datos se conservan.</p>
          <p><strong>Motivo:</strong> ${escapeHtml(reasonLabel)}</p>
          <p><strong>Explicacion:</strong> ${escapeHtml(explanation)}</p>
          <p>Si necesitas mas informacion, contacta con la administracion de UMBRA.</p>
        </div>
      `
    });
  }

  private ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new AppError("MAIL_NOT_CONFIGURED", "El envio de correo no esta configurado", 503);
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
