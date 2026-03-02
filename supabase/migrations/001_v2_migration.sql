-- ============================================================
-- Kakai v1 → v2 Migration
-- File: 001_v2_migration.sql
-- ============================================================

BEGIN;

-- ============================================================
-- SECTION 1: ALTER TABLE users
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_id   int  NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS age         int,
  ADD COLUMN IF NOT EXISTS lang        text NOT NULL DEFAULT 'ru',
  ADD COLUMN IF NOT EXISTS push_token  text;

-- Add lang CHECK separately (no IF NOT EXISTS for constraints — migration runs once)
ALTER TABLE users
  ADD CONSTRAINT users_lang_check CHECK (lang IN ('ru', 'kz'));

-- ============================================================
-- SECTION 2: ALTER TABLE families
-- ============================================================

ALTER TABLE families
  ADD COLUMN IF NOT EXISTS parent_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS child_id   uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS parent_pin text,
  ADD COLUMN IF NOT EXISTS status     text NOT NULL DEFAULT 'pending';

ALTER TABLE families
  ADD CONSTRAINT families_status_check CHECK (status IN ('pending', 'active', 'paused'));

-- ============================================================
-- SECTION 3: ALTER TABLE screen_time
-- ============================================================

ALTER TABLE screen_time
  ADD COLUMN IF NOT EXISTS daily_limit  int     NOT NULL DEFAULT 120,
  ADD COLUMN IF NOT EXISTS used_today   int     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS streak_days  int     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_blocked   boolean NOT NULL DEFAULT false;

-- ============================================================
-- SECTION 4: ALTER TABLE tasks
-- ============================================================

-- Drop existing status CHECK constraint (name unknown, find dynamically)
DO $$
DECLARE
  v_constraint text;
BEGIN
  SELECT conname INTO v_constraint
  FROM   pg_constraint
  WHERE  conrelid = 'tasks'::regclass
    AND  contype  = 'c'
    AND  pg_get_constraintdef(oid) LIKE '%status%'
  LIMIT 1;

  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE tasks DROP CONSTRAINT %I', v_constraint);
    RAISE NOTICE 'Dropped constraint: %', v_constraint;
  ELSE
    RAISE NOTICE 'No existing status CHECK on tasks — skipping drop';
  END IF;
END;
$$;

-- Add new columns
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS requested_by_child boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS due_date           date,
  ADD COLUMN IF NOT EXISTS completed_at       timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at        timestamptz;

-- Recreate CHECK with 'rejected' included
ALTER TABLE tasks
  ADD CONSTRAINT tasks_status_check
    CHECK (status IN ('pending', 'done', 'rejected'));

-- ============================================================
-- SECTION 5: CREATE TABLE app_rules
-- ============================================================

CREATE TABLE IF NOT EXISTS app_rules (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id    uuid        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  package_name text        NOT NULL,
  app_name     text        NOT NULL,
  -- limited = time-capped, always = unrestricted, blocked = fully blocked
  category     text        NOT NULL DEFAULT 'limited',
  created_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT app_rules_category_check
    CHECK (category IN ('limited', 'always', 'blocked')),
  CONSTRAINT app_rules_family_package_key
    UNIQUE (family_id, package_name)
);

-- ============================================================
-- SECTION 6: CREATE TABLE schedules
-- ============================================================

CREATE TABLE IF NOT EXISTS schedules (
  id         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id  uuid    NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  type       text    NOT NULL,
  start_time time    NOT NULL,
  end_time   time    NOT NULL,
  -- 0=Sun 1=Mon … 6=Sat, default = every day
  days       int[]   NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  enabled    boolean NOT NULL DEFAULT true,

  CONSTRAINT schedules_type_check
    CHECK (type IN ('sleep', 'school')),
  CONSTRAINT schedules_family_type_key
    UNIQUE (family_id, type)
);

-- ============================================================
-- SECTION 7: CREATE TABLE usage_logs
-- ============================================================

CREATE TABLE IF NOT EXISTS usage_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package_name text NOT NULL,
  app_name     text,
  minutes      int  NOT NULL DEFAULT 0,
  date         date NOT NULL DEFAULT current_date,

  CONSTRAINT usage_logs_child_package_date_key
    UNIQUE (child_id, package_name, date)
);

-- ============================================================
-- SECTION 8: CREATE TABLE gps_locations
-- ============================================================

CREATE TABLE IF NOT EXISTS gps_locations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lat         float8      NOT NULL,
  lng         float8      NOT NULL,
  accuracy    float4,                          -- metres, nullable if unavailable
  recorded_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- SECTION 9: CREATE TABLE subscriptions
-- ============================================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id      uuid        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  -- free = trial / no payment, standard = basic, premium = all features
  plan           text        NOT NULL DEFAULT 'free',
  price_tenge    int         NOT NULL DEFAULT 0,
  started_at     timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz,
  kaspi_order_id text,                         -- Kaspi Pay order reference
  auto_renew     boolean     NOT NULL DEFAULT false,

  CONSTRAINT subscriptions_plan_check
    CHECK (plan IN ('free', 'standard', 'premium'))
);

-- ============================================================
-- SECTION 10: Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_usage_logs_child_date
  ON usage_logs (child_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_gps_child_time
  ON gps_locations (child_id, recorded_at DESC);

-- Supporting indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_app_rules_family
  ON app_rules (family_id);

CREATE INDEX IF NOT EXISTS idx_schedules_family
  ON schedules (family_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_family
  ON subscriptions (family_id);

-- ============================================================
-- SECTION 11: Helper functions for RLS policies
-- ============================================================

-- Returns the role of the current Supabase auth user
CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$;

-- Returns the family_id of the current Supabase auth user
CREATE OR REPLACE FUNCTION auth_family_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT family_id FROM users WHERE id = auth.uid();
$$;

-- ============================================================
-- SECTION 12: Enable RLS on all new tables
-- ============================================================

ALTER TABLE app_rules     ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules     ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- SECTION 13: RLS Policies
-- ============================================================

-- ── app_rules ────────────────────────────────────────────────

-- Parent: full CRUD on their family's rules
CREATE POLICY "app_rules: parent full access"
  ON app_rules
  FOR ALL
  USING (
    family_id = auth_family_id()
    AND auth_user_role() = 'parent'
  )
  WITH CHECK (
    family_id = auth_family_id()
    AND auth_user_role() = 'parent'
  );

-- Child: read-only for their family's rules (to enforce blocks on device)
CREATE POLICY "app_rules: child read"
  ON app_rules
  FOR SELECT
  USING (
    family_id = auth_family_id()
    AND auth_user_role() = 'child'
  );

-- ── schedules ────────────────────────────────────────────────

CREATE POLICY "schedules: parent full access"
  ON schedules
  FOR ALL
  USING (
    family_id = auth_family_id()
    AND auth_user_role() = 'parent'
  )
  WITH CHECK (
    family_id = auth_family_id()
    AND auth_user_role() = 'parent'
  );

CREATE POLICY "schedules: child read"
  ON schedules
  FOR SELECT
  USING (
    family_id = auth_family_id()
    AND auth_user_role() = 'child'
  );

-- ── usage_logs ────────────────────────────────────────────────

-- Parent: read all logs for children in their family
CREATE POLICY "usage_logs: parent read family"
  ON usage_logs
  FOR SELECT
  USING (
    auth_user_role() = 'parent'
    AND EXISTS (
      SELECT 1 FROM users u
      WHERE u.id        = usage_logs.child_id
        AND u.family_id = auth_family_id()
    )
  );

-- Child: insert and update their own logs (device syncs usage data)
CREATE POLICY "usage_logs: child write own"
  ON usage_logs
  FOR ALL
  USING (
    child_id = auth.uid()
    AND auth_user_role() = 'child'
  )
  WITH CHECK (
    child_id = auth.uid()
    AND auth_user_role() = 'child'
  );

-- ── gps_locations ────────────────────────────────────────────

-- Parent: read GPS pings for children in their family
CREATE POLICY "gps: parent read family"
  ON gps_locations
  FOR SELECT
  USING (
    auth_user_role() = 'parent'
    AND EXISTS (
      SELECT 1 FROM users u
      WHERE u.id        = gps_locations.child_id
        AND u.family_id = auth_family_id()
    )
  );

-- Child: insert-only (device uploads position, cannot read or modify)
CREATE POLICY "gps: child insert own"
  ON gps_locations
  FOR INSERT
  WITH CHECK (
    child_id = auth.uid()
    AND auth_user_role() = 'child'
  );

-- ── subscriptions ────────────────────────────────────────────

-- Parent: full CRUD (handles purchases / Kaspi webhooks)
CREATE POLICY "subscriptions: parent full access"
  ON subscriptions
  FOR ALL
  USING (
    family_id = auth_family_id()
    AND auth_user_role() = 'parent'
  )
  WITH CHECK (
    family_id = auth_family_id()
    AND auth_user_role() = 'parent'
  );

-- Child: read-only (so child app knows current plan limits)
CREATE POLICY "subscriptions: child read"
  ON subscriptions
  FOR SELECT
  USING (
    family_id = auth_family_id()
    AND auth_user_role() = 'child'
  );

-- ============================================================
COMMIT;
