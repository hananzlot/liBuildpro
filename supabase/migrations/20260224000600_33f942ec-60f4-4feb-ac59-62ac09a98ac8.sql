-- Temporarily unlink the Soto Ready Mix bill so user can test the unlinked bill workflow
UPDATE project_bills SET project_id = NULL WHERE id = '8b3339ab-5ee4-43ac-bdf2-53754f7cf2a2';