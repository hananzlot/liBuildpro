
-- Safe-delete Demo Co projects #77 and #88 (database records only, no storage files)

-- 1. Delete project_documents for project #77
DELETE FROM project_documents WHERE project_id = '68369843-12a1-427b-b8d4-1443f3d8e80c';

-- 2. Delete project_agreements for project #77
DELETE FROM project_agreements WHERE project_id = '68369843-12a1-427b-b8d4-1443f3d8e80c';

-- 3. Delete client_portal_tokens for both projects
DELETE FROM client_portal_tokens WHERE project_id IN (
  '68369843-12a1-427b-b8d4-1443f3d8e80c',
  '0f397d38-6aed-4db2-aa41-468757423570'
);

-- 4. Delete portal_view_logs for both projects
DELETE FROM portal_view_logs WHERE project_id IN (
  '68369843-12a1-427b-b8d4-1443f3d8e80c',
  '0f397d38-6aed-4db2-aa41-468757423570'
);

-- 5. Nullify opportunity_uuid on both projects to avoid FK constraint
UPDATE projects SET opportunity_uuid = NULL WHERE id IN (
  '68369843-12a1-427b-b8d4-1443f3d8e80c',
  '0f397d38-6aed-4db2-aa41-468757423570'
);

-- 6. Delete both projects (hard delete)
DELETE FROM projects WHERE id IN (
  '68369843-12a1-427b-b8d4-1443f3d8e80c',
  '0f397d38-6aed-4db2-aa41-468757423570'
);

-- 7. Delete both opportunities
DELETE FROM opportunities WHERE id IN (
  'bf99f7c6-2aa0-45f8-8d17-df0c4745447c',
  '5501390f-736e-4ad1-9ea0-93288fce0778'
);
