-- ============================================================
-- 004: Drop duplicate RLS policies
--
-- Dashboard-created policies (snake_case names) that duplicate
-- migration-created policies (colon-separated names from 001/002).
-- Keeps the migration versions as canonical.
--
-- Before: 44 policies. After: ~27 policies.
-- ============================================================

BEGIN;

-- ── gps_locations (4 → 2) ──────────────────────────────────
DROP POLICY IF EXISTS "child_insert_gps"        ON gps_locations;
DROP POLICY IF EXISTS "parent_read_child_gps"   ON gps_locations;

-- ── schedules (4 → 4, just old Dashboard ones) ─────────────
DROP POLICY IF EXISTS "child_read_schedules"    ON schedules;
DROP POLICY IF EXISTS "parent_manage_schedules" ON schedules;

-- ── screen_time (7 → 5) ────────────────────────────────────
-- child insert stays (needed by join.tsx)
DROP POLICY IF EXISTS "child_read_own_screen_time" ON screen_time;
DROP POLICY IF EXISTS "parent_manage_screen_time"  ON screen_time;

-- ── tasks (6 → 3) ──────────────────────────────────────────
DROP POLICY IF EXISTS "child_read_tasks"    ON tasks;
DROP POLICY IF EXISTS "parent_all_tasks"    ON tasks;
DROP POLICY IF EXISTS "child_complete_task" ON tasks;

-- ── usage_logs (6 → 2) ─────────────────────────────────────
DROP POLICY IF EXISTS "child_insert_usage"       ON usage_logs;
DROP POLICY IF EXISTS "child_read_usage"         ON usage_logs;
DROP POLICY IF EXISTS "child_update_usage"       ON usage_logs;
DROP POLICY IF EXISTS "parent_read_child_usage"  ON usage_logs;

-- ── users (5 → 4) ──────────────────────────────────────────
-- Keep child_read_parent_profile (different scope from users: parent read family)
DROP POLICY IF EXISTS "users_own_profile" ON users;

-- ============================================================
COMMIT;
