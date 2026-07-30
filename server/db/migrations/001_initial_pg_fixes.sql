-- edward:labs PostgreSQL Migration Script
-- Run against: edlab database on 13.140.162.178:5432
-- Date: 2026-07-30
-- Idempotent — uses IF NOT EXISTS / IF EXISTS guards

BEGIN;

-- ============================================================
-- Migration 1: Add folder_id to library_components
-- The SQLite runtime migration added this column; the PG DDL
-- did not include it initially.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'library_components' AND column_name = 'folder_id'
  ) THEN
    ALTER TABLE library_components
      ADD COLUMN folder_id VARCHAR(50) REFERENCES library_folders(id) ON DELETE SET NULL;
    RAISE NOTICE 'Migration 1: Added folder_id to library_components';
  ELSE
    RAISE NOTICE 'Migration 1: folder_id already exists — skipped';
  END IF;
END $$;

-- Index for folder lookups
CREATE INDEX IF NOT EXISTS idx_lc_folder ON library_components(folder_id);

-- ============================================================
-- Migration 2: Ensure skema_projects default is 'canvas'
-- (was 'website', renamed in application code)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skema_projects' AND column_default LIKE '%website%'
  ) THEN
    ALTER TABLE skema_projects ALTER COLUMN project_type SET DEFAULT 'canvas';
    UPDATE skema_projects SET project_type = 'canvas' WHERE project_type = 'website';
    RAISE NOTICE 'Migration 2: Updated skema_projects default to canvas';
  ELSE
    RAISE NOTICE 'Migration 2: skema_projects default already canvas — skipped';
  END IF;
END $$;

-- ============================================================
-- Migration 3: Create migration tracking table
-- ============================================================

CREATE TABLE IF NOT EXISTS _migrations (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL UNIQUE,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Record applied migrations
INSERT INTO _migrations (name) VALUES
  ('001_add_folder_id_to_library_components'),
  ('002_rename_website_to_canvas')
ON CONFLICT (name) DO NOTHING;

COMMIT;

-- Verify
SELECT 'Migrations applied:' AS status;
SELECT name, applied_at FROM _migrations ORDER BY id;
