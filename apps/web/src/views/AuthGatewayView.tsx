import { useState } from "react";
import type { LoginInput, RegisterInput } from "@umbra/shared";

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

        <div className="auth-switch">
          <button className={mode === "login" ? "active" : ""} onClick={() => onModeChange("login")}>Entrar</button>
          <button className={mode === "register" ? "active" : ""} onClick={() => onModeChange("register")}>Registro</button>
        </div>

        <form className="form-grid auth-form-grid" onSubmit={handleSubmit} autoComplete="on">
          <input
            id="auth-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete={mode === "login" ? "username" : "email"}
            aria-label="Correo"
            data-bwignore="true"
            data-1p-ignore="true"
            data-lpignore="true"
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
            data-bwignore="true"
            data-1p-ignore="true"
            data-lpignore="true"
            placeholder="Contrasena"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {mode === "register" ? (
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
            {isSubmitting ? "Procesando..." : mode === "login" ? "Entrar" : "Crear cuenta"}
          </button>
        </form>
      </section>
    </main>
  );
}
