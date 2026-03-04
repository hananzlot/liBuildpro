
-- Ghost Cleanup: Demo Co #1 (d95f6df1-ef3c-4e12-8743-69c6bfb280bc)
-- Complete child-first deletion with all FK dependencies resolved

-- Step 1: Delete from tables referencing client_portal_tokens on ghost projects
DELETE FROM estimate_signatures WHERE portal_token_id IN (
  SELECT cpt.id FROM client_portal_tokens cpt JOIN projects p ON cpt.project_id = p.id
  JOIN opportunities o ON p.opportunity_uuid = o.id
  WHERE o.company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' AND o.ghl_id IS NULL
);
DELETE FROM portal_view_logs WHERE portal_token_id IN (
  SELECT cpt.id FROM client_portal_tokens cpt JOIN projects p ON cpt.project_id = p.id
  JOIN opportunities o ON p.opportunity_uuid = o.id
  WHERE o.company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' AND o.ghl_id IS NULL
);
DELETE FROM portal_chat_messages WHERE portal_token_id IN (
  SELECT cpt.id FROM client_portal_tokens cpt JOIN projects p ON cpt.project_id = p.id
  JOIN opportunities o ON p.opportunity_uuid = o.id
  WHERE o.company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' AND o.ghl_id IS NULL
);

-- Step 2: Delete portal_view_logs referencing ghost projects directly
DELETE FROM portal_view_logs WHERE project_id IN (
  SELECT p.id FROM projects p JOIN opportunities o ON p.opportunity_uuid = o.id
  WHERE o.company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' AND o.ghl_id IS NULL
);

-- Step 3: Delete all tables referencing ghost projects
DELETE FROM portal_chat_messages WHERE project_id IN (
  SELECT p.id FROM projects p JOIN opportunities o ON p.opportunity_uuid = o.id
  WHERE o.company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' AND o.ghl_id IS NULL
);
DELETE FROM portal_chat_messages_archived WHERE project_id IN (
  SELECT p.id FROM projects p JOIN opportunities o ON p.opportunity_uuid = o.id
  WHERE o.company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' AND o.ghl_id IS NULL
);
DELETE FROM client_portal_tokens WHERE project_id IN (
  SELECT p.id FROM projects p JOIN opportunities o ON p.opportunity_uuid = o.id
  WHERE o.company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' AND o.ghl_id IS NULL
);
DELETE FROM client_comments WHERE project_id IN (
  SELECT p.id FROM projects p JOIN opportunities o ON p.opportunity_uuid = o.id
  WHERE o.company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' AND o.ghl_id IS NULL
);
DELETE FROM project_payments WHERE project_id IN (
  SELECT p.id FROM projects p JOIN opportunities o ON p.opportunity_uuid = o.id
  WHERE o.company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' AND o.ghl_id IS NULL
);
DELETE FROM project_invoices WHERE project_id IN (
  SELECT p.id FROM projects p JOIN opportunities o ON p.opportunity_uuid = o.id
  WHERE o.company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' AND o.ghl_id IS NULL
);
DELETE FROM bill_payments WHERE bill_id IN (
  SELECT pb.id FROM project_bills pb JOIN projects p ON pb.project_id = p.id
  JOIN opportunities o ON p.opportunity_uuid = o.id
  WHERE o.company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' AND o.ghl_id IS NULL
);
DELETE FROM project_bills WHERE project_id IN (
  SELECT p.id FROM projects p JOIN opportunities o ON p.opportunity_uuid = o.id
  WHERE o.company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' AND o.ghl_id IS NULL
);
DELETE FROM commission_payments WHERE project_id IN (
  SELECT p.id FROM projects p JOIN opportunities o ON p.opportunity_uuid = o.id
  WHERE o.company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' AND o.ghl_id IS NULL
);
DELETE FROM project_commissions WHERE project_id IN (
  SELECT p.id FROM projects p JOIN opportunities o ON p.opportunity_uuid = o.id
  WHERE o.company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' AND o.ghl_id IS NULL
);
DELETE FROM project_agreements WHERE project_id IN (
  SELECT p.id FROM projects p JOIN opportunities o ON p.opportunity_uuid = o.id
  WHERE o.company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' AND o.ghl_id IS NULL
);
DELETE FROM project_checklists WHERE project_id IN (
  SELECT p.id FROM projects p JOIN opportunities o ON p.opportunity_uuid = o.id
  WHERE o.company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' AND o.ghl_id IS NULL
);
DELETE FROM project_documents WHERE project_id IN (
  SELECT p.id FROM projects p JOIN opportunities o ON p.opportunity_uuid = o.id
  WHERE o.company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' AND o.ghl_id IS NULL
);
DELETE FROM project_feedback WHERE project_id IN (
  SELECT p.id FROM projects p JOIN opportunities o ON p.opportunity_uuid = o.id
  WHERE o.company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' AND o.ghl_id IS NULL
);
DELETE FROM project_finance WHERE project_id IN (
  SELECT p.id FROM projects p JOIN opportunities o ON p.opportunity_uuid = o.id
  WHERE o.company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' AND o.ghl_id IS NULL
);
DELETE FROM project_messages WHERE project_id IN (
  SELECT p.id FROM projects p JOIN opportunities o ON p.opportunity_uuid = o.id
  WHERE o.company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' AND o.ghl_id IS NULL
);
DELETE FROM project_notes WHERE project_id IN (
  SELECT p.id FROM projects p JOIN opportunities o ON p.opportunity_uuid = o.id
  WHERE o.company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' AND o.ghl_id IS NULL
);
DELETE FROM project_notification_log WHERE project_id IN (
  SELECT p.id FROM projects p JOIN opportunities o ON p.opportunity_uuid = o.id
  WHERE o.company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' AND o.ghl_id IS NULL
);
DELETE FROM project_payment_phases WHERE project_id IN (
  SELECT p.id FROM projects p JOIN opportunities o ON p.opportunity_uuid = o.id
  WHERE o.company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' AND o.ghl_id IS NULL
);
DELETE FROM signed_compliance_documents WHERE project_id IN (
  SELECT p.id FROM projects p JOIN opportunities o ON p.opportunity_uuid = o.id
  WHERE o.company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' AND o.ghl_id IS NULL
);

-- Step 4: Delete estimate children then estimates
DELETE FROM client_comments WHERE estimate_id IN (
  SELECT e.id FROM estimates e JOIN opportunities o ON e.opportunity_uuid = o.id
  WHERE o.company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' AND o.ghl_id IS NULL
);
DELETE FROM estimate_attachments WHERE estimate_id IN (
  SELECT e.id FROM estimates e JOIN opportunities o ON e.opportunity_uuid = o.id
  WHERE o.company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' AND o.ghl_id IS NULL
);
DELETE FROM estimate_line_items WHERE estimate_id IN (
  SELECT e.id FROM estimates e JOIN opportunities o ON e.opportunity_uuid = o.id
  WHERE o.company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' AND o.ghl_id IS NULL
);
DELETE FROM estimates WHERE opportunity_uuid IN (
  SELECT id FROM opportunities WHERE company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' AND ghl_id IS NULL
);

-- Step 5: Delete projects linked to ghost opportunities
DELETE FROM projects WHERE opportunity_uuid IN (
  SELECT id FROM opportunities WHERE company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' AND ghl_id IS NULL
);

-- Step 6: Delete other tables referencing ghost opportunities
DELETE FROM project_costs WHERE opportunity_uuid IN (
  SELECT id FROM opportunities WHERE company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' AND ghl_id IS NULL
);
DELETE FROM scope_submissions WHERE opportunity_id IN (
  SELECT id FROM opportunities WHERE company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' AND ghl_id IS NULL
);
DELETE FROM tasks WHERE opportunity_uuid IN (
  SELECT id FROM opportunities WHERE company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' AND ghl_id IS NULL
);

-- Step 7: Nullify contact_uuid on ALL ghost opportunities before deleting
UPDATE opportunities SET contact_uuid = NULL
WHERE company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' AND ghl_id IS NULL;

-- Step 8: Delete ghost opportunities
DELETE FROM opportunities WHERE company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' AND ghl_id IS NULL;

-- Step 9: Nullify contact_uuid on REAL opportunities/projects/estimates that reference ghost contacts
UPDATE opportunities SET contact_uuid = NULL
WHERE company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc'
AND contact_uuid IN (SELECT id FROM contacts WHERE company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' AND ghl_id IS NULL);

UPDATE projects SET contact_uuid = NULL
WHERE company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc'
AND contact_uuid IN (SELECT id FROM contacts WHERE company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' AND ghl_id IS NULL);

UPDATE estimates SET contact_uuid = NULL
WHERE company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc'
AND contact_uuid IN (SELECT id FROM contacts WHERE company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' AND ghl_id IS NULL);

-- Step 10: Delete tables referencing ghost contacts
DELETE FROM contact_notes WHERE contact_uuid IN (
  SELECT id FROM contacts WHERE company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' AND ghl_id IS NULL
);
DELETE FROM conversations WHERE contact_uuid IN (
  SELECT id FROM contacts WHERE company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' AND ghl_id IS NULL
);
DELETE FROM call_logs WHERE contact_uuid IN (
  SELECT id FROM contacts WHERE company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' AND ghl_id IS NULL
);
DELETE FROM appointments WHERE contact_uuid IN (
  SELECT id FROM contacts WHERE company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' AND ghl_id IS NULL
);
DELETE FROM ghl_tasks WHERE contact_uuid IN (
  SELECT id FROM contacts WHERE company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' AND ghl_id IS NULL
);
DELETE FROM tasks WHERE contact_uuid IN (
  SELECT id FROM contacts WHERE company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' AND ghl_id IS NULL
);
DELETE FROM dismissed_duplicate_contacts WHERE company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc'
AND (contact_id_a IN (SELECT id FROM contacts WHERE company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' AND ghl_id IS NULL)
  OR contact_id_b IN (SELECT id FROM contacts WHERE company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' AND ghl_id IS NULL));

-- Step 11: Delete ghost contacts
DELETE FROM contacts WHERE company_id = 'd95f6df1-ef3c-4e12-8743-69c6bfb280bc' AND ghl_id IS NULL;
