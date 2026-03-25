import { useState } from "react";
import type { ChangePasswordInput, LoginInput, RegisterInput } from "@umbra/shared";

type Props = {
  mode: "login" | "register";
  isSubmitting: boolean;
  error: string | null;
  onModeChange: (mode: "login" | "register") => void;
  onLogin: (input: LoginInput) => Promise<void>;
  onRegister: (input: RegisterInput) => Promise<void>;
};

export function AuthGatewayView({ mode, isSubmitting, error, onModeChange, onLogin, onRegister }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"player" | "gm">("player");
  const allowPublicRegistration = import.meta.env.VITE_ALLOW_PUBLIC_REGISTRATION !== "false";

  async function submit(): Promise<void> {
    if (mode === "login") {
      await onLogin({ email, password });
      return;
    }

    await onRegister({ email, password, role });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void submit();
  }

  return (
    <main className="page auth-page">
      <section className="panel auth-panel">
        <h1>UMBRA</h1>
        <p>Companion de Symbaroum</p>

        {allowPublicRegistration ? (
          <div className="auth-switch">
            <button className={mode === "login" ? "active" : ""} onClick={() => onModeChange("login")}>Entrar</button>
            <button className={mode === "register" ? "active" : ""} onClick={() => onModeChange("register")}>Registro</button>
          </div>
        ) : null}

        <form className="form-grid auth-form-grid" onSubmit={handleSubmit} autoComplete="on">
          <input
            id="auth-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete={mode === "login" ? "username" : "email"}
            aria-label="Correo"
            placeholder="Correo"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <input
            id="auth-password"
            name="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            aria-label="Contrasena"
            placeholder="Contrasena"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {mode === "register" && allowPublicRegistration ? (
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

          {!allowPublicRegistration ? <p className="meta-text">El acceso se gestiona solo con cuentas creadas por el administrador.</p> : null}

          <button className="auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Procesando..." : mode === "login" ? "Entrar" : "Crear cuenta"}
          </button>
        </form>
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
