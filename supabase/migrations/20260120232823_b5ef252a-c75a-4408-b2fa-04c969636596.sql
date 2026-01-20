-- Backfill opportunity_edits from opportunities (using ghl_id)
UPDATE opportunity_edits oe
SET company_id = o.company_id
FROM opportunities o
WHERE oe.opportunity_ghl_id = o.ghl_id
  AND oe.company_id IS NULL
  AND o.company_id IS NOT NULL;

-- Backfill estimate_line_items from estimates
UPDATE estimate_line_items eli
SET company_id = e.company_id
FROM estimates e
WHERE eli.estimate_id = e.id
  AND eli.company_id IS NULL
  AND e.company_id IS NOT NULL;

-- Backfill ghl_tasks from contacts
UPDATE ghl_tasks gt
SET company_id = c.company_id
FROM contacts c
WHERE gt.contact_id = c.ghl_id
  AND gt.company_id IS NULL
  AND c.company_id IS NOT NULL;

-- Backfill notifications from profiles (user's company)
UPDATE notifications n
SET company_id = p.company_id
FROM profiles p
WHERE n.user_id = p.id
  AND n.company_id IS NULL
  AND p.company_id IS NOT NULL;

-- Backfill client_portal_tokens from projects
UPDATE client_portal_tokens cpt
SET company_id = proj.company_id
FROM projects proj
WHERE cpt.project_id = proj.id
  AND cpt.company_id IS NULL
  AND proj.company_id IS NOT NULL;

-- Backfill audit_logs from profiles (user's company)
UPDATE audit_logs al
SET company_id = p.company_id
FROM profiles p
WHERE al.user_id = p.id
  AND al.company_id IS NULL
  AND p.company_id IS NOT NULL