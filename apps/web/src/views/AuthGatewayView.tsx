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

  return (
    <main className="page">
      <section className="panel auth-panel">
        <h1>UMBRA</h1>
        <p>Symbaroum Companion</p>

        <div className="auth-switch">
          <button className={mode === "login" ? "active" : ""} onClick={() => onModeChange("login")}>Login</button>
          <button className={mode === "register" ? "active" : ""} onClick={() => onModeChange("register")}>Register</button>
        </div>

        <div className="form-grid">
          <input placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {mode === "register" ? (
            <select value={role} onChange={(event) => setRole(event.target.value as "player" | "gm") }>
              <option value="player">Player</option>
              <option value="gm">GM</option>
            </select>
          ) : null}
        </div>

        {error ? <p className="error">{error}</p> : null}

        <button disabled={isSubmitting} onClick={() => void submit()}>
          {isSubmitting ? "Working..." : mode === "login" ? "Login" : "Create account"}
        </button>
      </section>
    </main>
  );
}
