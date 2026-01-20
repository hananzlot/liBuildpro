-- =============================================================================
-- STEP 1A: Add corporation-level roles to app_role enum
-- (Must be committed separately before use)
-- =============================================================================

ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'corp_admin';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'corp_viewer';