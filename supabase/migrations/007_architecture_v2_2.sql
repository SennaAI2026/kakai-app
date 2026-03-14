-- ============================================================
-- Migration 007: Architecture v2.2
--
-- 1. CREATE 7 new tables (family_members, onboarding_progress,
--    user_goals, survey_answers, fun_facts, screen_time_limits,
--    screen_time_daily)
-- 2. ALTER existing tables (users, families, gps_locations,
--    app_rules, schedules, subscriptions)
-- 3. Data migration for existing schedules child_id
-- 4. CREATE 3 new helper functions (keep old ones)
-- 5. DROP old RLS policies (keep screen_time policies)
-- 6. CREATE new RLS policies via family_members
-- 7. Realtime publication
-- 8. Data migration (families → family_members, screen_time → screen_time_daily)
-- 9. COMMENT deprecated columns/tables
--
-- Derived from: kakai_architecture_v2.2_final.md
-- Depends on: migrations 001–006
-- ============================================================

BEGIN;

-- ============================================================
-- SECTION 1: CREATE 7 new tables
-- ============================================================

-- ── 1.1 family_members ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS family_members (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id      uuid        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_in_family text        NOT NULL,
  added_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fm_role_check
    CHECK (role_in_family IN ('owner', 'adult', 'child')),
  CONSTRAINT fm_family_user_unique
    UNIQUE (family_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_fm_family_id ON family_members (family_id);
CREATE INDEX IF NOT EXISTS idx_fm_user_id   ON family_members (user_id);

ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;

-- ── 1.2 onboarding_progress ────────────────────────────────

CREATE TABLE IF NOT EXISTS onboarding_progress (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state          text        NOT NULL DEFAULT 'entry',
  last_screen_id text,
  updated_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT op_user_unique UNIQUE (user_id),
  CONSTRAINT op_state_check
    CHECK (state IN ('entry', 'carousel', 'post_carousel', 'survey',
                     'child_setup', 'paywall', 'completed', 'skipped'))
);

ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;

-- ── 1.3 user_goals ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_goals (
  id      uuid   PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid   NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goals   text[] NOT NULL DEFAULT '{}',

  CONSTRAINT ug_user_unique UNIQUE (user_id)
);

ALTER TABLE user_goals ENABLE ROW LEVEL SECURITY;

-- ── 1.4 survey_answers ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS survey_answers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id text NOT NULL,
  answer      text NOT NULL,

  CONSTRAINT sa_question_check
    CHECK (question_id IN ('Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6')),
  CONSTRAINT sa_answer_check
    CHECK (answer IN ('yes', 'no', 'skipped')),
  CONSTRAINT sa_user_question_unique
    UNIQUE (user_id, question_id)
);

ALTER TABLE survey_answers ENABLE ROW LEVEL SECURITY;

-- ── 1.5 fun_facts ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fun_facts (
  id         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  text_kz    text    NOT NULL,
  text_ru    text    NOT NULL,
  text_en    text    NOT NULL,
  sort_order int     NOT NULL DEFAULT 0,
  active     boolean NOT NULL DEFAULT true
);

ALTER TABLE fun_facts ENABLE ROW LEVEL SECURITY;

-- ── 1.6 screen_time_limits ─────────────────────────────────

CREATE TABLE IF NOT EXISTS screen_time_limits (
  id            uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id     uuid    NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  child_id      uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week   int     NOT NULL,
  limit_minutes int     NOT NULL DEFAULT 120,
  enabled       boolean NOT NULL DEFAULT true,

  CONSTRAINT stl_dow_check CHECK (day_of_week >= 0 AND day_of_week <= 6),
  CONSTRAINT stl_child_dow_unique UNIQUE (child_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_stl_family_id ON screen_time_limits (family_id);
CREATE INDEX IF NOT EXISTS idx_stl_child_id  ON screen_time_limits (child_id);

ALTER TABLE screen_time_limits ENABLE ROW LEVEL SECURITY;

-- ── 1.7 screen_time_daily ──────────────────────────────────

CREATE TABLE IF NOT EXISTS screen_time_daily (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id       uuid        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  child_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  used_today      int         NOT NULL DEFAULT 0,
  balance_minutes int         NOT NULL DEFAULT 0,
  is_blocked      boolean     NOT NULL DEFAULT false,
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT std_child_unique UNIQUE (child_id)
);

CREATE INDEX IF NOT EXISTS idx_std_child_id ON screen_time_daily (child_id);

ALTER TABLE screen_time_daily ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- SECTION 2: ALTER existing tables
-- ============================================================

-- ── users ──────────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS name          text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS survey_source text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stars         int NOT NULL DEFAULT 0;

-- ── families ───────────────────────────────────────────────
ALTER TABLE families ADD COLUMN IF NOT EXISTS invite_code_expires_at timestamptz;
ALTER TABLE families ADD COLUMN IF NOT EXISTS invite_code_used       boolean NOT NULL DEFAULT false;

-- ── gps_locations ──────────────────────────────────────────
ALTER TABLE gps_locations ADD COLUMN IF NOT EXISTS battery_level int;
ALTER TABLE gps_locations ADD COLUMN IF NOT EXISTS sound_mode    text;

-- ── app_rules ──────────────────────────────────────────────
ALTER TABLE app_rules ADD COLUMN IF NOT EXISTS child_id             uuid REFERENCES auth.users(id);
ALTER TABLE app_rules ADD COLUMN IF NOT EXISTS per_app_limit_minutes int;

-- ── schedules ──────────────────────────────────────────────
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS child_id uuid REFERENCES auth.users(id);

-- ── subscriptions ──────────────────────────────────────────
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS google_play_token text;


-- ============================================================
-- SECTION 3: Data migration for existing schedules + constraints
-- ============================================================

-- Back-fill child_id on schedules from families.child_id
UPDATE schedules s
SET    child_id = f.child_id
FROM   families f
WHERE  s.family_id = f.id
  AND  s.child_id IS NULL
  AND  f.child_id IS NOT NULL;

-- Back-fill child_id on app_rules from families.child_id
UPDATE app_rules ar
SET    child_id = f.child_id
FROM   families f
WHERE  ar.family_id = f.id
  AND  ar.child_id IS NULL
  AND  f.child_id IS NOT NULL;

-- app_rules: Drop old UNIQUE(family_id, package_name) and create new one
-- Old constraint name from migration 001: app_rules_family_package_key
ALTER TABLE app_rules DROP CONSTRAINT IF EXISTS app_rules_family_package_key;
ALTER TABLE app_rules ADD CONSTRAINT app_rules_unique_child_pkg
  UNIQUE (family_id, child_id, package_name);

-- schedules: Drop old UNIQUE(family_id, type) and create new one
-- Old constraint name from migration 001: schedules_family_type_key
ALTER TABLE schedules DROP CONSTRAINT IF EXISTS schedules_family_type_key;
ALTER TABLE schedules ADD CONSTRAINT schedules_unique_child_type
  UNIQUE (child_id, type);


-- ============================================================
-- SECTION 4: CREATE 3 new helper functions
-- ============================================================
-- NOTE: auth_user_role() and auth_family_id() are kept for backward compat

-- Returns array of family_ids the current user belongs to
CREATE OR REPLACE FUNCTION user_family_ids()
RETURNS uuid[]
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(array_agg(family_id), '{}')
  FROM family_members
  WHERE user_id = auth.uid();
$$;

-- Returns true if current user is owner or adult in given family
CREATE OR REPLACE FUNCTION user_is_parent_in_family(fid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM family_members
    WHERE family_id      = fid
      AND user_id        = auth.uid()
      AND role_in_family IN ('owner', 'adult')
  );
$$;

-- Returns true if current user is any member of given family
CREATE OR REPLACE FUNCTION user_is_member_of_family(fid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM family_members
    WHERE family_id = fid
      AND user_id   = auth.uid()
  );
$$;


-- ============================================================
-- SECTION 5: DROP old RLS policies
-- ============================================================
-- Policy names derived from migrations 001-004.
-- screen_time policies are KEPT (existing code depends on them).

-- ── users ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "users: insert own"          ON users;
DROP POLICY IF EXISTS "users: read own"            ON users;
DROP POLICY IF EXISTS "users: parent read family"  ON users;
DROP POLICY IF EXISTS "users: update own"          ON users;
DROP POLICY IF EXISTS "child_read_parent_profile"  ON users;  -- Dashboard-created, kept by 004

-- ── families ───────────────────────────────────────────────
DROP POLICY IF EXISTS "families: parent insert"      ON families;
DROP POLICY IF EXISTS "families: authenticated read" ON families;
DROP POLICY IF EXISTS "families: parent update"      ON families;
DROP POLICY IF EXISTS "families: child update"       ON families;

-- ── app_rules ──────────────────────────────────────────────
DROP POLICY IF EXISTS "app_rules: parent full access" ON app_rules;
DROP POLICY IF EXISTS "app_rules: child read"         ON app_rules;

-- ── schedules ──────────────────────────────────────────────
DROP POLICY IF EXISTS "schedules: parent full access"      ON schedules;
DROP POLICY IF EXISTS "schedules: child read"              ON schedules;
DROP POLICY IF EXISTS "schedules: child insert own family" ON schedules;
DROP POLICY IF EXISTS "schedules: child update own family" ON schedules;

-- ── tasks ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "tasks: parent full access" ON tasks;
DROP POLICY IF EXISTS "tasks: child read own"     ON tasks;
DROP POLICY IF EXISTS "tasks: child update own"   ON tasks;

-- ── usage_logs ─────────────────────────────────────────────
DROP POLICY IF EXISTS "usage_logs: parent read family" ON usage_logs;
DROP POLICY IF EXISTS "usage_logs: child write own"    ON usage_logs;

-- ── gps_locations ──────────────────────────────────────────
DROP POLICY IF EXISTS "gps: parent read family" ON gps_locations;
DROP POLICY IF EXISTS "gps: child insert own"   ON gps_locations;

-- ── subscriptions ──────────────────────────────────────────
DROP POLICY IF EXISTS "subscriptions: parent full access" ON subscriptions;
DROP POLICY IF EXISTS "subscriptions: child read"         ON subscriptions;

-- NOTE: screen_time policies NOT dropped — existing code uses them:
--   "screen_time: child insert"
--   "screen_time: child read own"
--   "screen_time: child update own"
--   "screen_time: parent read family"
--   "screen_time: parent update family"


-- ============================================================
-- SECTION 6: CREATE new RLS policies
-- ============================================================

-- ── USERS ──────────────────────────────────────────────────

CREATE POLICY "users_select_own"
  ON users FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "users_insert_own"
  ON users FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "users_update_own"
  ON users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Parent can see children in same family via family_members
CREATE POLICY "users_select_family_children"
  ON users FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM   family_members fm1
      JOIN   family_members fm2 ON fm1.family_id = fm2.family_id
      WHERE  fm1.user_id        = auth.uid()
        AND  fm1.role_in_family IN ('owner', 'adult')
        AND  fm2.user_id        = users.id
        AND  fm2.role_in_family = 'child'
    )
  );

-- ── FAMILIES ───────────────────────────────────────────────

-- Any authenticated user can read families (invite code lookup)
CREATE POLICY "families_select_authenticated"
  ON families FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Any authenticated user can create a family
CREATE POLICY "families_insert_authenticated"
  ON families FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Parent (owner/adult via family_members) can update their family
CREATE POLICY "families_update_parent"
  ON families FOR UPDATE
  USING (user_is_parent_in_family(id))
  WITH CHECK (user_is_parent_in_family(id));

-- ── FAMILY_MEMBERS ─────────────────────────────────────────

-- Members can see other members of their families
CREATE POLICY "fm_select_member"
  ON family_members FOR SELECT
  USING (user_is_member_of_family(family_id));

-- Any authenticated user can insert (joining a family)
CREATE POLICY "fm_insert_authenticated"
  ON family_members FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Only owner can update members (change roles)
CREATE POLICY "fm_update_owner"
  ON family_members FOR UPDATE
  USING (user_is_parent_in_family(family_id))
  WITH CHECK (user_is_parent_in_family(family_id));

-- Only owner can remove members
CREATE POLICY "fm_delete_owner"
  ON family_members FOR DELETE
  USING (user_is_parent_in_family(family_id));

-- ── SCREEN_TIME_LIMITS ─────────────────────────────────────

CREATE POLICY "stl_select"
  ON screen_time_limits FOR SELECT
  USING (
    user_is_parent_in_family(family_id)
    OR child_id = auth.uid()
  );

CREATE POLICY "stl_insert_parent"
  ON screen_time_limits FOR INSERT
  WITH CHECK (user_is_parent_in_family(family_id));

CREATE POLICY "stl_update_parent"
  ON screen_time_limits FOR UPDATE
  USING (user_is_parent_in_family(family_id))
  WITH CHECK (user_is_parent_in_family(family_id));

-- ── SCREEN_TIME_DAILY ──────────────────────────────────────

CREATE POLICY "std_select"
  ON screen_time_daily FOR SELECT
  USING (
    user_is_parent_in_family(family_id)
    OR child_id = auth.uid()
  );

CREATE POLICY "std_insert"
  ON screen_time_daily FOR INSERT
  WITH CHECK (child_id = auth.uid());

CREATE POLICY "std_update"
  ON screen_time_daily FOR UPDATE
  USING (
    user_is_parent_in_family(family_id)
    OR child_id = auth.uid()
  )
  WITH CHECK (
    user_is_parent_in_family(family_id)
    OR child_id = auth.uid()
  );

-- ── APP_RULES ──────────────────────────────────────────────

CREATE POLICY "ar_select_member"
  ON app_rules FOR SELECT
  USING (user_is_member_of_family(family_id));

CREATE POLICY "ar_insert_parent"
  ON app_rules FOR INSERT
  WITH CHECK (user_is_parent_in_family(family_id));

CREATE POLICY "ar_update_parent"
  ON app_rules FOR UPDATE
  USING (user_is_parent_in_family(family_id))
  WITH CHECK (user_is_parent_in_family(family_id));

CREATE POLICY "ar_delete_parent"
  ON app_rules FOR DELETE
  USING (user_is_parent_in_family(family_id));

-- ── SCHEDULES ──────────────────────────────────────────────

CREATE POLICY "sched_select_member"
  ON schedules FOR SELECT
  USING (user_is_member_of_family(family_id));

CREATE POLICY "sched_insert_member"
  ON schedules FOR INSERT
  WITH CHECK (user_is_member_of_family(family_id));

CREATE POLICY "sched_update_member"
  ON schedules FOR UPDATE
  USING (user_is_member_of_family(family_id))
  WITH CHECK (user_is_member_of_family(family_id));

-- ── TASKS ──────────────────────────────────────────────────

CREATE POLICY "tasks_select_member"
  ON tasks FOR SELECT
  USING (user_is_member_of_family(family_id));

CREATE POLICY "tasks_insert_member"
  ON tasks FOR INSERT
  WITH CHECK (user_is_member_of_family(family_id));

CREATE POLICY "tasks_update_member"
  ON tasks FOR UPDATE
  USING (user_is_member_of_family(family_id))
  WITH CHECK (user_is_member_of_family(family_id));

-- ── USAGE_LOGS ─────────────────────────────────────────────

-- Parent can read logs for children in their families
CREATE POLICY "ul_select_parent"
  ON usage_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM   family_members fm1
      JOIN   family_members fm2 ON fm1.family_id = fm2.family_id
      WHERE  fm1.user_id        = auth.uid()
        AND  fm1.role_in_family IN ('owner', 'adult')
        AND  fm2.user_id        = usage_logs.child_id
        AND  fm2.role_in_family = 'child'
    )
  );

-- Child can insert their own usage logs
CREATE POLICY "ul_insert_child"
  ON usage_logs FOR INSERT
  WITH CHECK (child_id = auth.uid());

-- Child can update their own usage logs (upsert pattern)
CREATE POLICY "ul_update_child"
  ON usage_logs FOR UPDATE
  USING (child_id = auth.uid())
  WITH CHECK (child_id = auth.uid());

-- ── GPS_LOCATIONS ──────────────────────────────────────────

-- Parent can read GPS for children in their families
CREATE POLICY "gps_select_parent"
  ON gps_locations FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM   family_members fm1
      JOIN   family_members fm2 ON fm1.family_id = fm2.family_id
      WHERE  fm1.user_id        = auth.uid()
        AND  fm1.role_in_family IN ('owner', 'adult')
        AND  fm2.user_id        = gps_locations.child_id
        AND  fm2.role_in_family = 'child'
    )
  );

-- Child can insert their own GPS pings
CREATE POLICY "gps_insert_child"
  ON gps_locations FOR INSERT
  WITH CHECK (child_id = auth.uid());

-- ── SUBSCRIPTIONS ──────────────────────────────────────────

CREATE POLICY "sub_select_member"
  ON subscriptions FOR SELECT
  USING (user_is_member_of_family(family_id));

CREATE POLICY "sub_insert_parent"
  ON subscriptions FOR INSERT
  WITH CHECK (user_is_parent_in_family(family_id));

CREATE POLICY "sub_update_parent"
  ON subscriptions FOR UPDATE
  USING (user_is_parent_in_family(family_id))
  WITH CHECK (user_is_parent_in_family(family_id));

-- ── ONBOARDING_PROGRESS ────────────────────────────────────

CREATE POLICY "op_select_own"
  ON onboarding_progress FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "op_insert_own"
  ON onboarding_progress FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "op_update_own"
  ON onboarding_progress FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── USER_GOALS ─────────────────────────────────────────────

CREATE POLICY "ug_select_own"
  ON user_goals FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "ug_insert_own"
  ON user_goals FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "ug_update_own"
  ON user_goals FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── SURVEY_ANSWERS ─────────────────────────────────────────

CREATE POLICY "sa_select_own"
  ON survey_answers FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "sa_insert_own"
  ON survey_answers FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "sa_update_own"
  ON survey_answers FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── FUN_FACTS ──────────────────────────────────────────────

-- Any authenticated user can read fun facts
CREATE POLICY "ff_select_authenticated"
  ON fun_facts FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Anonymous users can also read fun facts (shown in onboarding carousel)
CREATE POLICY "ff_select_anon"
  ON fun_facts FOR SELECT
  USING (true);


-- ============================================================
-- SECTION 7: Realtime publication
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE family_members;
ALTER PUBLICATION supabase_realtime ADD TABLE screen_time_daily;
ALTER PUBLICATION supabase_realtime ADD TABLE screen_time_limits;
-- app_rules and schedules: add only if not already in publication
-- (they may have been added manually; ALTER ADD TABLE errors on duplicates)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'app_rules'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE app_rules;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'schedules'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE schedules;
  END IF;
END;
$$;


-- ============================================================
-- SECTION 8: Data migration
-- ============================================================

-- Migrate families.parent_id → family_members (role = owner)
INSERT INTO family_members (family_id, user_id, role_in_family)
SELECT id, parent_id, 'owner'
FROM   families
WHERE  parent_id IS NOT NULL
ON CONFLICT (family_id, user_id) DO NOTHING;

-- Migrate families.child_id → family_members (role = child)
INSERT INTO family_members (family_id, user_id, role_in_family)
SELECT id, child_id, 'child'
FROM   families
WHERE  child_id IS NOT NULL
ON CONFLICT (family_id, user_id) DO NOTHING;

-- Migrate screen_time → screen_time_daily
INSERT INTO screen_time_daily (family_id, child_id, used_today, is_blocked)
SELECT family_id, child_id, used_today, is_blocked
FROM   screen_time
WHERE  child_id IS NOT NULL
ON CONFLICT (child_id) DO NOTHING;


-- ============================================================
-- SECTION 9: COMMENT deprecated tables/columns
-- ============================================================

COMMENT ON TABLE  screen_time             IS 'DEPRECATED: replaced by screen_time_limits + screen_time_daily in migration 007';
COMMENT ON COLUMN users.family_id         IS 'DEPRECATED: replaced by family_members table in migration 007';
COMMENT ON COLUMN users.pin_hash          IS 'DEPRECATED: use families.parent_pin instead';
COMMENT ON COLUMN families.parent_id      IS 'DEPRECATED: replaced by family_members (role_in_family = owner)';
COMMENT ON COLUMN families.child_id       IS 'DEPRECATED: replaced by family_members (role_in_family = child)';

-- ============================================================
COMMIT;
