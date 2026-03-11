-- ============================================================
-- 002: RLS policies for users, families, screen_time, tasks
--
-- These 4 tables were created in the Supabase Dashboard
-- (before migration 001). RLS is enabled but NO policies
-- were defined in code — causing 403 on all client operations.
--
-- Uses DROP + CREATE pattern for idempotency.
-- Depends on: auth_user_role(), auth_family_id() from 001.
-- ============================================================

BEGIN;

-- ============================================================
-- Ensure RLS is enabled (idempotent)
-- ============================================================

ALTER TABLE users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE families    ENABLE ROW LEVEL SECURITY;
ALTER TABLE screen_time ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks       ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- USERS
-- ============================================================

-- Authenticated user can create their own record (id must = auth.uid)
DROP POLICY IF EXISTS "users: insert own" ON users;
CREATE POLICY "users: insert own"
  ON users FOR INSERT
  WITH CHECK (id = auth.uid());

-- User can read their own record
DROP POLICY IF EXISTS "users: read own" ON users;
CREATE POLICY "users: read own"
  ON users FOR SELECT
  USING (id = auth.uid());

-- Parent can read children in their family (dashboard, task list)
DROP POLICY IF EXISTS "users: parent read family" ON users;
CREATE POLICY "users: parent read family"
  ON users FOR SELECT
  USING (
    family_id IS NOT NULL
    AND family_id = auth_family_id()
    AND auth_user_role() = 'parent'
  );

-- User can update their own record (name, avatar, lang, family_id link)
DROP POLICY IF EXISTS "users: update own" ON users;
CREATE POLICY "users: update own"
  ON users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================================
-- FAMILIES
-- ============================================================

-- Parent can create a family (parent_id must = auth.uid)
DROP POLICY IF EXISTS "families: parent insert" ON families;
CREATE POLICY "families: parent insert"
  ON families FOR INSERT
  WITH CHECK (parent_id = auth.uid());

-- Any authenticated user can read families (needed for invite code lookup
-- in child join.tsx BEFORE child is linked to family).
-- invite_code is 6 chars from 32-char alphabet = ~1B combinations.
DROP POLICY IF EXISTS "families: authenticated read" ON families;
CREATE POLICY "families: authenticated read"
  ON families FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Parent can update their own family (set parent_pin, child_id, status)
DROP POLICY IF EXISTS "families: parent update" ON families;
CREATE POLICY "families: parent update"
  ON families FOR UPDATE
  USING (parent_id = auth.uid())
  WITH CHECK (parent_id = auth.uid());

-- Child can update their family (set child_id upon joining)
DROP POLICY IF EXISTS "families: child update" ON families;
CREATE POLICY "families: child update"
  ON families FOR UPDATE
  USING (
    id = auth_family_id()
    AND auth_user_role() = 'child'
  )
  WITH CHECK (
    id = auth_family_id()
    AND auth_user_role() = 'child'
  );

-- ============================================================
-- SCREEN_TIME
-- ============================================================

-- Child can create their own screen_time record (join.tsx)
DROP POLICY IF EXISTS "screen_time: child insert" ON screen_time;
CREATE POLICY "screen_time: child insert"
  ON screen_time FOR INSERT
  WITH CHECK (child_id = auth.uid());

-- Child can read their own screen_time
DROP POLICY IF EXISTS "screen_time: child read own" ON screen_time;
CREATE POLICY "screen_time: child read own"
  ON screen_time FOR SELECT
  USING (child_id = auth.uid());

-- Child can update their own screen_time (usage tracking)
DROP POLICY IF EXISTS "screen_time: child update own" ON screen_time;
CREATE POLICY "screen_time: child update own"
  ON screen_time FOR UPDATE
  USING (child_id = auth.uid())
  WITH CHECK (child_id = auth.uid());

-- Parent can read screen_time for children in their family
DROP POLICY IF EXISTS "screen_time: parent read family" ON screen_time;
CREATE POLICY "screen_time: parent read family"
  ON screen_time FOR SELECT
  USING (
    auth_user_role() = 'parent'
    AND EXISTS (
      SELECT 1 FROM users u
      WHERE u.id        = screen_time.child_id
        AND u.family_id = auth_family_id()
    )
  );

-- Parent can update screen_time (block/unblock child)
DROP POLICY IF EXISTS "screen_time: parent update family" ON screen_time;
CREATE POLICY "screen_time: parent update family"
  ON screen_time FOR UPDATE
  USING (
    auth_user_role() = 'parent'
    AND EXISTS (
      SELECT 1 FROM users u
      WHERE u.id        = screen_time.child_id
        AND u.family_id = auth_family_id()
    )
  )
  WITH CHECK (
    auth_user_role() = 'parent'
    AND EXISTS (
      SELECT 1 FROM users u
      WHERE u.id        = screen_time.child_id
        AND u.family_id = auth_family_id()
    )
  );

-- ============================================================
-- TASKS
-- ============================================================

-- Parent: full CRUD on their family's tasks
DROP POLICY IF EXISTS "tasks: parent full access" ON tasks;
CREATE POLICY "tasks: parent full access"
  ON tasks FOR ALL
  USING (
    family_id = auth_family_id()
    AND auth_user_role() = 'parent'
  )
  WITH CHECK (
    family_id = auth_family_id()
    AND auth_user_role() = 'parent'
  );

-- Child: read tasks assigned to them
DROP POLICY IF EXISTS "tasks: child read own" ON tasks;
CREATE POLICY "tasks: child read own"
  ON tasks FOR SELECT
  USING (
    child_id = auth.uid()
    AND auth_user_role() = 'child'
  );

-- Child: update tasks assigned to them (mark as done)
DROP POLICY IF EXISTS "tasks: child update own" ON tasks;
CREATE POLICY "tasks: child update own"
  ON tasks FOR UPDATE
  USING (
    child_id = auth.uid()
    AND auth_user_role() = 'child'
  )
  WITH CHECK (
    child_id = auth.uid()
    AND auth_user_role() = 'child'
  );

-- ============================================================
COMMIT;
