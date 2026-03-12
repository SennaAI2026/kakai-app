-- ============================================================
-- 005: Allow 'approved' status in tasks table
--
-- The tasks_status_check constraint from migration 001 only
-- allows ('pending', 'done', 'rejected'). Dashboard and Tasks
-- screens write 'approved' when parent approves a task.
-- ============================================================

BEGIN;

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('pending', 'done', 'approved', 'rejected'));

COMMIT;
