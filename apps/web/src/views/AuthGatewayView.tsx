import { useEffect, useMemo, useState } from "react";
import type { ChangePasswordInput, LoginInput } from "@umbra/shared";
import { AppearancePopover } from "../components/AppearancePopover";

type Props = {
  isSubmitting: boolean;
  error: string | null;
  onLogin: (input: LoginInput) => Promise<void>;
  onRequestPasswordReset: (email: string) => Promise<void>;
  onResetPassword: (token: string, newPassword: string) => Promise<void>;
};

type AuthScreen = "login" | "forgot" | "reset";

function parseResetTokenFromHash(): string {
  const rawHash = window.location.hash.replace(/^#/, "");
  if (!rawHash.startsWith("reset-password")) {
    return "";
  }

  const [, search = ""] = rawHash.split("?");
  return new URLSearchParams(search).get("token") ?? "";
}

function clearResetHash(): void {
  if (window.location.hash.startsWith("#reset-password")) {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }
}

export function AuthGatewayView({
  isSubmitting,
  error,
  onLogin,
  onRequestPasswordReset,
  onResetPassword
}: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotStatus, setForgotStatus] = useState<string | null>(null);
  const [isForgotScreen, setIsForgotScreen] = useState(false);
  const [resetToken, setResetToken] = useState(() => parseResetTokenFromHash());
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [resetStatus, setResetStatus] = useState<string | null>(null);
  const activeScreen: AuthScreen = useMemo(() => {
    if (resetToken) return "reset";
    if (isForgotScreen) return "forgot";
    return "login";
  }, [isForgotScreen, resetToken]);

  useEffect(() => {
    function syncResetToken(): void {
      setResetToken(parseResetTokenFromHash());
      setResetStatus(null);
    }

    syncResetToken();
    window.addEventListener("hashchange", syncResetToken);
    return () => window.removeEventListener("hashchange", syncResetToken);
  }, []);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void onLogin({ email, password });
  }

  async function handleForgotSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setForgotStatus(null);
    await onRequestPasswordReset(forgotEmail);
    setForgotStatus("Si existe una cuenta con ese correo, se ha enviado un enlace de recuperacion.");
  }

  async function handleResetSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (resetMismatchError || !resetToken) {
      return;
    }

    await onResetPassword(resetToken, resetPasswordValue);
    setResetStatus("Contrasena restablecida. Ya puedes iniciar sesion con la nueva clave.");
    setResetPasswordValue("");
    setResetConfirmPassword("");
    setResetToken("");
    setIsForgotScreen(false);
    clearResetHash();
  }

  const resetMismatchError =
    resetConfirmPassword && resetPasswordValue !== resetConfirmPassword
      ? "La confirmacion no coincide con la nueva contrasena"
      : null;

  return (
    <main className="page auth-page">
      <div className="auth-appearance-control"><AppearancePopover /></div>
      <section className="panel auth-panel">
        <h1>UMBRA</h1>
        <p>Symbaroum Companion</p>

        {activeScreen === "reset" ? (
          <form className="form-grid auth-form-grid" onSubmit={handleResetSubmit} autoComplete="on">
            <p className="meta-text">Define una nueva contrasena para tu cuenta.</p>
            <input
              type="password"
              name="newPassword"
              autoComplete="new-password"
              aria-label="Nueva contrasena"
              placeholder="Nueva contrasena"
              value={resetPasswordValue}
              onChange={(event) => setResetPasswordValue(event.target.value)}
            />
            <input
              type="password"
              name="confirmNewPassword"
              autoComplete="new-password"
              aria-label="Confirmar nueva contrasena"
              placeholder="Confirmar nueva contrasena"
              value={resetConfirmPassword}
              onChange={(event) => setResetConfirmPassword(event.target.value)}
            />
            {resetMismatchError ? <p className="error auth-error">{resetMismatchError}</p> : null}
            {!resetMismatchError && error ? <p className="error auth-error">{error}</p> : null}
            {!resetMismatchError && !error && resetStatus ? <p className="meta-text">{resetStatus}</p> : null}
            <button className="auth-submit" type="submit" disabled={isSubmitting || Boolean(resetMismatchError)}>
              {isSubmitting ? "Restableciendo..." : "Restablecer contrasena"}
            </button>
            <button
              type="button"
              className="subtle-button"
              onClick={() => {
                clearResetHash();
                setResetToken("");
                setResetStatus(null);
                setIsForgotScreen(false);
              }}
            >
              Volver a entrar
            </button>
          </form>
        ) : activeScreen === "forgot" ? (
          <form
            className="form-grid auth-form-grid auth-single-form"
            onSubmit={(event) => void handleForgotSubmit(event)}
            autoComplete="on"
          >
            <div className="auth-form-copy">
              <h2>Recuperar contrasena</h2>
              <p className="meta-text">Introduce el correo asociado a tu cuenta para recibir un enlace de recuperacion.</p>
            </div>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              aria-label="Correo de recuperacion"
              placeholder="Correo de tu cuenta"
              value={forgotEmail}
              onChange={(event) => setForgotEmail(event.target.value)}
            />
            {error ? <p className="error auth-error">{error}</p> : null}
            {!error && forgotStatus ? <p className="meta-text">{forgotStatus}</p> : null}
            <button type="submit" className="auth-submit" disabled={isSubmitting}>
              {isSubmitting ? "Enviando..." : "Enviar enlace"}
            </button>
            <button
              type="button"
              className="subtle-button"
              onClick={() => {
                setForgotStatus(null);
                setIsForgotScreen(false);
              }}
            >
              Volver a entrar
            </button>
          </form>
        ) : activeScreen === "login" ? (
          <>
            <form className="form-grid auth-form-grid" onSubmit={handleSubmit} autoComplete="on">
              <input
                id="auth-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="username"
                aria-label="Correo"
                placeholder="Correo"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <input
                id="auth-password"
                name="password"
                type="password"
                autoComplete="current-password"
                aria-label="Contrasena"
                placeholder="Contrasena"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              {error ? <p className="error auth-error">{error}</p> : null}

              <button className="auth-submit" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Procesando..." : "Entrar"}
              </button>
            </form>

            <button
              type="button"
              className="subtle-button"
              onClick={() => {
                setForgotEmail(email);
                setForgotStatus(null);
                setIsForgotScreen(true);
              }}
            >
              Recuperar contrasena
            </button>
          </>
        ) : null}
      </section>
    </main>
  );
}

type ForcedPasswordChangeProps = {
  email: string;
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (input: ChangePasswordInput) => Promise<void>;
  onLogout: () => Promise<void>;
};

export function ForcedPasswordChangeView({ email, isSubmitting, error, onSubmit, onLogout }: ForcedPasswordChangeProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const mismatchError =
    confirmPassword && newPassword !== confirmPassword ? "La confirmacion no coincide con la nueva contrasena" : null;
  const lengthError =
    newPassword && newPassword.length < 8 ? "La nueva contrasena debe tener al menos 8 caracteres" : null;
  const reuseError =
    newPassword && currentPassword === newPassword ? "La nueva contrasena debe ser distinta de la temporal" : null;
  const validationError = lengthError || reuseError || mismatchError;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (validationError) {
      return;
    }
    void onSubmit({ currentPassword, newPassword });
  }

  return (
    <main className="page auth-page">
      <div className="auth-appearance-control"><AppearancePopover /></div>
      <section className="panel auth-panel">
        <h1>UMBRA</h1>
        <p>Debes cambiar la contrasena temporal antes de continuar.</p>
        <p className="meta-text">{email}</p>
        <div className="auth-password-guidance">
          <strong>Tu nueva contrasena debe:</strong>
          <span>Tener al menos 8 caracteres.</span>
          <span>Ser distinta de la contrasena temporal.</span>
        </div>

        <form className="form-grid auth-form-grid" onSubmit={handleSubmit} autoComplete="on">
          <input
            type="password"
            name="currentPassword"
            autoComplete="current-password"
            aria-label="Contrasena actual"
            placeholder="Contrasena temporal"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
          <input
            type="password"
            name="newPassword"
            autoComplete="new-password"
            aria-label="Nueva contrasena"
            placeholder="Nueva contrasena"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
          <input
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            aria-label="Confirmar nueva contrasena"
            placeholder="Confirmar nueva contrasena"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />

          {validationError ? <p className="error auth-error">{validationError}</p> : null}
          {!validationError && error ? <p className="error auth-error">{error}</p> : null}

          <button className="auth-submit" type="submit" disabled={isSubmitting || Boolean(validationError)}>
            {isSubmitting ? "Actualizando..." : "Guardar nueva contrasena"}
          </button>
          <button type="button" className="subtle-button" disabled={isSubmitting} onClick={() => void onLogout()}>
            Cerrar sesion
          </button>
        </form>
      </section>
    </main>
  );
}
