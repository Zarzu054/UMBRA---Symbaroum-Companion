CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'player',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO users (id, email, password_hash, role)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'dev-player@umbra.local',
  '$2a$10$replace_with_real_hash_when_auth_is_added',
  'player'
)
ON CONFLICT (email) DO NOTHING;

CREATE TABLE IF NOT EXISTS characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  archetype TEXT NOT NULL,
  race TEXT NOT NULL,
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);