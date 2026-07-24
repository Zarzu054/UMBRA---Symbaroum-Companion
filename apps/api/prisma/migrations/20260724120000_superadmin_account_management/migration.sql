DO $$
BEGIN
  CREATE TYPE "UserAccountStatus" AS ENUM ('pending', 'active', 'deactivated');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "AdminDeactivationReason" AS ENUM (
    'access_no_longer_required',
    'policy_violation',
    'security_concern',
    'duplicate_or_error',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "AdminNotificationStatus" AS ENUM ('not_required', 'pending', 'sent', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "AdminAccountAction" AS ENUM (
    'created',
    'deactivated',
    'reactivated',
    'sessions_revoked',
    'credentials_resent'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "status" "UserAccountStatus" NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS "deactivated_at" TIMESTAMPTZ(6);

CREATE INDEX IF NOT EXISTS "users_status_idx" ON "users"("status");

CREATE TABLE IF NOT EXISTS "admin_account_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "actor_id" UUID NOT NULL,
  "target_user_id" UUID NOT NULL,
  "target_email" TEXT NOT NULL,
  "action" "AdminAccountAction" NOT NULL,
  "reason" "AdminDeactivationReason",
  "explanation" TEXT NOT NULL DEFAULT '',
  "notification_status" "AdminNotificationStatus" NOT NULL DEFAULT 'not_required',
  "notification_attempts" INTEGER NOT NULL DEFAULT 0,
  "notification_last_attempt_at" TIMESTAMPTZ(6),
  "notification_error" TEXT NOT NULL DEFAULT '',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_account_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admin_account_events_actor_id_fkey"
    FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "admin_account_events_target_user_id_fkey"
    FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "admin_account_events_target_user_id_created_at_idx"
  ON "admin_account_events"("target_user_id", "created_at");
CREATE INDEX IF NOT EXISTS "admin_account_events_actor_id_idx"
  ON "admin_account_events"("actor_id");
CREATE INDEX IF NOT EXISTS "admin_account_events_notification_status_idx"
  ON "admin_account_events"("notification_status");
