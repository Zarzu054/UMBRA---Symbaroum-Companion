import { useEffect, useMemo, useState } from "react";
import type { ChangePasswordInput, LoginInput, RegisterInput } from "@umbra/shared";

type Props = {
  mode: "login" | "register";
  isSubmitting: boolean;
  error: string | null;
  onModeChange: (mode: "login" | "register") => void;
  onLogin: (input: LoginInput) => Promise<void>;
  onRegister: (input: RegisterInput) => Promise<void>;
  onRequestPasswordReset: (email: string) => Promise<void>;
  onResetPassword: (token: string, newPassword: string) => Promise<void>;
};

type AuthScreen = "login" | "register" | "forgot" | "reset";

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
  mode,
  isSubmitting,
  error,
  onModeChange,
  onLogin,
  onRegister,
  onRequestPasswordReset,
  onResetPassword
}: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"player" | "gm">("player");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotStatus, setForgotStatus] = useState<string | null>(null);
  const [isForgotScreen, setIsForgotScreen] = useState(false);
  const [resetToken, setResetToken] = useState(() => parseResetTokenFromHash());
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [resetStatus, setResetStatus] = useState<string | null>(null);
  const allowPublicRegistration = import.meta.env.VITE_ALLOW_PUBLIC_REGISTRATION !== "false";
  const activeScreen: AuthScreen = useMemo(() => {
    if (resetToken) return "reset";
    if (isForgotScreen) return "forgot";
    if (mode === "register") return "register";
    return "login";
  }, [isForgotScreen, mode, resetToken]);

  useEffect(() => {
    function syncResetToken(): void {
      setResetToken(parseResetTokenFromHash());
      setResetStatus(null);
    }

    syncResetToken();
    window.addEventListener("hashchange", syncResetToken);
    return () => window.removeEventListener("hashchange", syncResetToken);
  }, []);

  async function submit(): Promise<void> {
    if (activeScreen === "login") {
      await onLogin({ email, password });
      return;
    }

    await onRegister({ email, password, role });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void submit();
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
    onModeChange("login");
  }

  const resetMismatchError =
    resetConfirmPassword && resetPasswordValue !== resetConfirmPassword
      ? "La confirmacion no coincide con la nueva contrasena"
      : null;

  return (
    <main className="page auth-page">
      <section className="panel auth-panel">
        <h1>UMBRA</h1>
        <p>Symbaroum Companion</p>

        {allowPublicRegistration && (activeScreen === "login" || activeScreen === "register") ? (
          <div className="auth-switch">
            <button className={mode === "login" ? "active" : ""} onClick={() => onModeChange("login")}>Entrar</button>
            <button className={mode === "register" ? "active" : ""} onClick={() => onModeChange("register")}>Registro</button>
          </div>
        ) : null}

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
                onModeChange("login");
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
                onModeChange("login");
              }}
            >
              Volver a entrar
            </button>
          </form>
        ) : activeScreen === "login" || activeScreen === "register" ? (
          <>
            <form className="form-grid auth-form-grid" onSubmit={handleSubmit} autoComplete="on">
              <input
                id="auth-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete={activeScreen === "login" ? "username" : "email"}
                aria-label="Correo"
                placeholder="Correo"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <input
                id="auth-password"
                name="password"
                type="password"
                autoComplete={activeScreen === "login" ? "current-password" : "new-password"}
                aria-label="Contrasena"
                placeholder="Contrasena"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              {activeScreen === "register" && allowPublicRegistration ? (
                <select
                  id="auth-role"
                  name="role"
                  autoComplete="off"
                  value={role}
                  onChange={(event) => setRole(event.target.value as "player" | "gm")}
                >
                  <option value="player">Jugador</option>
                  <option value="gm">Director de Juego</option>
                </select>
              ) : null}

              {error ? <p className="error auth-error">{error}</p> : null}

              <button className="auth-submit" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Procesando..." : activeScreen === "login" ? "Entrar" : "Crear cuenta"}
              </button>
            </form>

            {activeScreen === "login" ? (
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
            ) : null}
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
};

export function ForcedPasswordChangeView({ email, isSubmitting, error, onSubmit }: ForcedPasswordChangeProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const mismatchError =
    confirmPassword && newPassword !== confirmPassword ? "La confirmacion no coincide con la nueva contrasena" : null;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (mismatchError) {
      return;
    }
    void onSubmit({ currentPassword, newPassword });
  }

  return (
    <main className="page auth-page">
      <section className="panel auth-panel">
        <h1>UMBRA</h1>
        <p>Debes cambiar la contrasena temporal antes de continuar.</p>
        <p className="meta-text">{email}</p>

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

          {mismatchError ? <p className="error auth-error">{mismatchError}</p> : null}
          {!mismatchError && error ? <p className="error auth-error">{error}</p> : null}

          <button className="auth-submit" type="submit" disabled={isSubmitting || Boolean(mismatchError)}>
            {isSubmitting ? "Actualizando..." : "Guardar nueva contrasena"}
          </button>
        </form>
      </section>
    </main>
  );
}
