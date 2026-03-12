-- ============================================================
-- 003: Fix schedules RLS — allow child to INSERT/UPDATE
--
-- Bug 1 + 6: Child's schedule.tsx does .upsert() on schedules
--   but only parent full access + child read existed → 403.
-- Bug 7: Clean up any duplicate policies created manually
--   in Dashboard alongside migration-created ones.
--
-- Audit query (run manually in Supabase SQL Editor):
-- SELECT policyname, tablename FROM pg_policies
-- WHERE schemaname = 'public' ORDER BY tablename, policyname;
-- ============================================================

BEGIN;

-- ============================================================
-- Bug 7: Drop known duplicate policies (if they exist)
-- Dashboard may have created these alongside migration 001/002
-- ============================================================

-- schedules duplicates
DROP POLICY IF EXISTS "child_upsert_own_schedules" ON schedules;
DROP POLICY IF EXISTS "child_update_own_schedules" ON schedules;

-- ============================================================
-- Bug 1 + 6: Allow child to INSERT schedules for own family
-- ============================================================

CREATE POLICY "schedules: child insert own family"
  ON schedules
  FOR INSERT
  WITH CHECK (
    family_id = auth_family_id()
    AND auth_user_role() = 'child'
  );

-- Allow child to UPDATE schedules for own family (upsert needs both)
CREATE POLICY "schedules: child update own family"
  ON schedules
  FOR UPDATE
  USING (
    family_id = auth_family_id()
    AND auth_user_role() = 'child'
  )
  WITH CHECK (
    family_id = auth_family_id()
    AND auth_user_role() = 'child'
  );

-- ============================================================
COMMIT;
