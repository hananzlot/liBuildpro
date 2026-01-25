-- Add foreign key constraints for contact_uuid across all tables
-- This ensures referential integrity and enables cascading deletes

-- opportunities.contact_uuid -> contacts.id
ALTER TABLE opportunities
ADD CONSTRAINT fk_opportunities_contact_uuid
FOREIGN KEY (contact_uuid) REFERENCES contacts(id)
ON DELETE SET NULL;

-- appointments.contact_uuid -> contacts.id
ALTER TABLE appointments
ADD CONSTRAINT fk_appointments_contact_uuid
FOREIGN KEY (contact_uuid) REFERENCES contacts(id)
ON DELETE SET NULL;

-- projects.contact_uuid -> contacts.id
ALTER TABLE projects
ADD CONSTRAINT fk_projects_contact_uuid
FOREIGN KEY (contact_uuid) REFERENCES contacts(id)
ON DELETE SET NULL;

-- projects.opportunity_uuid -> opportunities.id
ALTER TABLE projects
ADD CONSTRAINT fk_projects_opportunity_uuid
FOREIGN KEY (opportunity_uuid) REFERENCES opportunities(id)
ON DELETE SET NULL;

-- estimates.contact_uuid -> contacts.id
ALTER TABLE estimates
ADD CONSTRAINT fk_estimates_contact_uuid
FOREIGN KEY (contact_uuid) REFERENCES contacts(id)
ON DELETE SET NULL;

-- ghl_tasks.contact_uuid -> contacts.id
ALTER TABLE ghl_tasks
ADD CONSTRAINT fk_ghl_tasks_contact_uuid
FOREIGN KEY (contact_uuid) REFERENCES contacts(id)
ON DELETE SET NULL;

-- contact_notes.contact_uuid -> contacts.id
ALTER TABLE contact_notes
ADD CONSTRAINT fk_contact_notes_contact_uuid
FOREIGN KEY (contact_uuid) REFERENCES contacts(id)
ON DELETE CASCADE;