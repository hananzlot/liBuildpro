-- First fix the 2 orphaned appointments by setting their company_id from the user who entered them
UPDATE appointments 
SET company_id = (SELECT company_id FROM profiles WHERE id = appointments.entered_by)
WHERE company_id IS NULL AND entered_by IS NOT NULL;

-- Create triggers for key tables to auto-set company_id
CREATE OR REPLACE TRIGGER set_appointments_company_id
  BEFORE INSERT ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION set_company_id_from_user();

CREATE OR REPLACE TRIGGER set_opportunities_company_id
  BEFORE INSERT ON opportunities
  FOR EACH ROW
  EXECUTE FUNCTION set_company_id_from_user();

CREATE OR REPLACE TRIGGER set_contacts_company_id
  BEFORE INSERT ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION set_company_id_from_user();

CREATE OR REPLACE TRIGGER set_estimates_company_id
  BEFORE INSERT ON estimates
  FOR EACH ROW
  EXECUTE FUNCTION set_company_id_from_user();

CREATE OR REPLACE TRIGGER set_projects_company_id
  BEFORE INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION set_company_id_from_user();

CREATE OR REPLACE TRIGGER set_project_invoices_company_id
  BEFORE INSERT ON project_invoices
  FOR EACH ROW
  EXECUTE FUNCTION set_company_id_from_user();

CREATE OR REPLACE TRIGGER set_project_bills_company_id
  BEFORE INSERT ON project_bills
  FOR EACH ROW
  EXECUTE FUNCTION set_company_id_from_user();

CREATE OR REPLACE TRIGGER set_project_payments_company_id
  BEFORE INSERT ON project_payments
  FOR EACH ROW
  EXECUTE FUNCTION set_company_id_from_user();