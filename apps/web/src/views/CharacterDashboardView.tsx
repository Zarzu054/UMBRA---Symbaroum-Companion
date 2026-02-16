import type { AuthUser } from "@umbra/shared";
import { CharacterCard } from "../components/CharacterCard";
import { useCharacterController } from "../controllers/characterController";
import { toCharacterCardViewModel } from "../models/characterModel";

type Props = {
  user: AuthUser;
  ensureAccessToken: () => Promise<string>;
  onLogout: () => Promise<void>;
};

export function CharacterDashboardView({ user, ensureAccessToken, onLogout }: Props) {
  const controller = useCharacterController(ensureAccessToken);

  return (
    <main className="page">
      <header className="top-bar">
        <div>
          <h1>UMBRA</h1>
          <p>{user.email} ({user.role})</p>
        </div>
        <button onClick={() => void onLogout()}>Logout</button>
      </header>

      <section className="panel">
        <h2>Create character</h2>
        <div className="form-grid">
          <input
            placeholder="Name"
            value={controller.form.name}
            onChange={(event) => controller.updateForm("name", event.target.value)}
          />
          <input
            placeholder="Archetype"
            value={controller.form.archetype}
            onChange={(event) => controller.updateForm("archetype", event.target.value)}
          />
          <input
            placeholder="Race"
            value={controller.form.race}
            onChange={(event) => controller.updateForm("race", event.target.value)}
          />
          <input
            placeholder="Level"
            type="number"
            min={1}
            max={20}
            value={controller.form.level}
            onChange={(event) => controller.updateForm("level", Number(event.target.value || 1))}
          />
        </div>
        <button onClick={() => void controller.submit()}>Create</button>
      </section>

      <section className="panel">
        <h2>Characters</h2>
        {controller.isLoading ? <p>Loading...</p> : null}
        {controller.error ? <p className="error">{controller.error}</p> : null}
        <div className="cards">
          {controller.characters.map((character) => (
            <CharacterCard key={character.id} item={toCharacterCardViewModel(character)} />
          ))}
        </div>
      </section>
    </main>
  );
}
