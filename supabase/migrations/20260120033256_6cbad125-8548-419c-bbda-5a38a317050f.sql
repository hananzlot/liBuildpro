-- =============================================================================
-- STEP 1B + 2: Create Core Tenant Tables and Add company_id to All Data Tables
-- =============================================================================

-- 1. Create corporations table (top-level entity)
CREATE TABLE corporations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_corporations_slug ON corporations(slug);
CREATE INDEX idx_corporations_is_active ON corporations(is_active);

-- 2. Create companies table (tenant-level entity)
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    corporation_id UUID REFERENCES corporations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    logo_url TEXT,
    primary_color TEXT DEFAULT '#000000',
    secondary_color TEXT DEFAULT '#ffffff',
    address TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_companies_corporation_id ON companies(corporation_id);
CREATE INDEX idx_companies_slug ON companies(slug);
CREATE INDEX idx_companies_is_active ON companies(is_active);

-- 3. Create company_settings table (per-company configuration)
CREATE TABLE company_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    setting_key TEXT NOT NULL,
    setting_value TEXT,
    setting_type TEXT DEFAULT 'text',
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id),
    UNIQUE(company_id, setting_key)
);

CREATE INDEX idx_company_settings_company_id ON company_settings(company_id);

-- 4. Create company_integrations table (per-company external credentials)
CREATE TABLE company_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    name TEXT,
    location_id TEXT,
    api_key_encrypted TEXT,
    refresh_token_encrypted TEXT,
    config JSONB DEFAULT '{}',
    is_primary BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_company_integrations_company_id ON company_integrations(company_id);
CREATE INDEX idx_company_integrations_provider ON company_integrations(provider);
CREATE INDEX idx_company_integrations_location_id ON company_integrations(location_id);

-- 5. Create default corporation
INSERT INTO corporations (id, name, slug, settings)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'CA Pro Builders Holdings',
    'capro-holdings',
    '{"industry": "construction", "timezone": "America/Los_Angeles"}'
);

-- 6. Create default company
INSERT INTO companies (id, corporation_id, name, slug, email)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'CA Pro Builders',
    'ca-pro-builders',
    'info@caprobuilders.com'
);

-- =============================================================================
-- 7. Add company_id Column to All Existing Tables (69 tables)
-- =============================================================================

-- User & Settings Tables
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE salespeople ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE subcontractors ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE banks ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

-- CRM Tables
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE ghl_tasks ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE contact_notes ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE ghl_users ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE ghl_calendars ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE ghl_pipelines ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE imported_records ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

-- Sales & Estimates Tables
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE estimate_line_items ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE estimate_groups ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE estimate_signers ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE estimate_signatures ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE estimate_attachments ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE estimate_payment_schedule ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE estimate_portal_tokens ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE opportunity_sales ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE magazine_sales ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE magazine_sales_edits ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE client_comments ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE client_portal_tokens ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

-- Project Tables
ALTER TABLE projects ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE project_invoices ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE project_bills ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE project_payments ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE project_payment_phases ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE project_documents ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE project_notes ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE project_note_comments ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE project_agreements ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE project_costs ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE project_commissions ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE project_checklists ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE project_statuses ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE project_types ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE project_feedback ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE project_messages ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE project_cases ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE project_finance ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

-- Document Tables
ALTER TABLE signature_documents ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE signature_field_templates ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE signature_field_template_items ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE document_signatures ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE document_signers ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE document_signature_fields ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE document_portal_tokens ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

-- Logging & Edit History Tables
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE portal_chat_messages ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE portal_chat_messages_archived ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE portal_view_logs ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE opportunity_edits ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE appointment_edits ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE task_edits ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE note_edits ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE appointment_reminders ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE project_notification_log ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

-- Financial Tables
ALTER TABLE bill_payments ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE commission_payments ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

-- =============================================================================
-- 8. Populate company_id with Default Company for All Existing Records
-- =============================================================================

UPDATE profiles SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE user_roles SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE salespeople SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE subcontractors SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE banks SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE trades SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;

UPDATE contacts SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE opportunities SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE appointments SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE conversations SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE ghl_tasks SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE contact_notes SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE call_logs SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE ghl_users SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE ghl_calendars SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE ghl_pipelines SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE tasks SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE imported_records SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;

UPDATE estimates SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE estimate_line_items SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE estimate_groups SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE estimate_signers SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE estimate_signatures SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE estimate_attachments SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE estimate_payment_schedule SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE estimate_portal_tokens SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE opportunity_sales SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE magazine_sales SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE magazine_sales_edits SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE client_comments SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE client_portal_tokens SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;

UPDATE projects SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE project_invoices SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE project_bills SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE project_payments SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE project_payment_phases SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE project_documents SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE project_notes SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE project_note_comments SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE project_agreements SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE project_costs SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE project_commissions SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE project_checklists SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE project_statuses SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE project_types SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE project_feedback SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE project_messages SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE project_cases SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE project_finance SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;

UPDATE signature_documents SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE signature_field_templates SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE signature_field_template_items SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE document_signatures SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE document_signers SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE document_signature_fields SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE document_portal_tokens SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;

UPDATE audit_logs SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE notifications SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE portal_chat_messages SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE portal_chat_messages_archived SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE portal_view_logs SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE opportunity_edits SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE appointment_edits SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE task_edits SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE note_edits SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE appointment_reminders SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE project_notification_log SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;

UPDATE bill_payments SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE commission_payments SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;

-- =============================================================================
-- 9. Create Indexes for company_id Columns
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_company_id ON user_roles(company_id);
CREATE INDEX IF NOT EXISTS idx_salespeople_company_id ON salespeople(company_id);
CREATE INDEX IF NOT EXISTS idx_subcontractors_company_id ON subcontractors(company_id);
CREATE INDEX IF NOT EXISTS idx_banks_company_id ON banks(company_id);
CREATE INDEX IF NOT EXISTS idx_trades_company_id ON trades(company_id);

CREATE INDEX IF NOT EXISTS idx_contacts_company_id ON contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_company_id ON opportunities(company_id);
CREATE INDEX IF NOT EXISTS idx_appointments_company_id ON appointments(company_id);
CREATE INDEX IF NOT EXISTS idx_conversations_company_id ON conversations(company_id);
CREATE INDEX IF NOT EXISTS idx_ghl_tasks_company_id ON ghl_tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_contact_notes_company_id ON contact_notes(company_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_company_id ON call_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_ghl_users_company_id ON ghl_users(company_id);
CREATE INDEX IF NOT EXISTS idx_ghl_calendars_company_id ON ghl_calendars(company_id);
CREATE INDEX IF NOT EXISTS idx_ghl_pipelines_company_id ON ghl_pipelines(company_id);
CREATE INDEX IF NOT EXISTS idx_tasks_company_id ON tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_imported_records_company_id ON imported_records(company_id);

CREATE INDEX IF NOT EXISTS idx_estimates_company_id ON estimates(company_id);
CREATE INDEX IF NOT EXISTS idx_estimate_line_items_company_id ON estimate_line_items(company_id);
CREATE INDEX IF NOT EXISTS idx_estimate_groups_company_id ON estimate_groups(company_id);
CREATE INDEX IF NOT EXISTS idx_estimate_signers_company_id ON estimate_signers(company_id);
CREATE INDEX IF NOT EXISTS idx_estimate_signatures_company_id ON estimate_signatures(company_id);
CREATE INDEX IF NOT EXISTS idx_estimate_attachments_company_id ON estimate_attachments(company_id);
CREATE INDEX IF NOT EXISTS idx_estimate_payment_schedule_company_id ON estimate_payment_schedule(company_id);
CREATE INDEX IF NOT EXISTS idx_estimate_portal_tokens_company_id ON estimate_portal_tokens(company_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_sales_company_id ON opportunity_sales(company_id);
CREATE INDEX IF NOT EXISTS idx_magazine_sales_company_id ON magazine_sales(company_id);
CREATE INDEX IF NOT EXISTS idx_magazine_sales_edits_company_id ON magazine_sales_edits(company_id);
CREATE INDEX IF NOT EXISTS idx_client_comments_company_id ON client_comments(company_id);
CREATE INDEX IF NOT EXISTS idx_client_portal_tokens_company_id ON client_portal_tokens(company_id);

CREATE INDEX IF NOT EXISTS idx_projects_company_id ON projects(company_id);
CREATE INDEX IF NOT EXISTS idx_project_invoices_company_id ON project_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_project_bills_company_id ON project_bills(company_id);
CREATE INDEX IF NOT EXISTS idx_project_payments_company_id ON project_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_project_payment_phases_company_id ON project_payment_phases(company_id);
CREATE INDEX IF NOT EXISTS idx_project_documents_company_id ON project_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_project_notes_company_id ON project_notes(company_id);
CREATE INDEX IF NOT EXISTS idx_project_note_comments_company_id ON project_note_comments(company_id);
CREATE INDEX IF NOT EXISTS idx_project_agreements_company_id ON project_agreements(company_id);
CREATE INDEX IF NOT EXISTS idx_project_costs_company_id ON project_costs(company_id);
CREATE INDEX IF NOT EXISTS idx_project_commissions_company_id ON project_commissions(company_id);
CREATE INDEX IF NOT EXISTS idx_project_checklists_company_id ON project_checklists(company_id);
CREATE INDEX IF NOT EXISTS idx_project_statuses_company_id ON project_statuses(company_id);
CREATE INDEX IF NOT EXISTS idx_project_types_company_id ON project_types(company_id);
CREATE INDEX IF NOT EXISTS idx_project_feedback_company_id ON project_feedback(company_id);
CREATE INDEX IF NOT EXISTS idx_project_messages_company_id ON project_messages(company_id);
CREATE INDEX IF NOT EXISTS idx_project_cases_company_id ON project_cases(company_id);
CREATE INDEX IF NOT EXISTS idx_project_finance_company_id ON project_finance(company_id);

CREATE INDEX IF NOT EXISTS idx_signature_documents_company_id ON signature_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_signature_field_templates_company_id ON signature_field_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_signature_field_template_items_company_id ON signature_field_template_items(company_id);
CREATE INDEX IF NOT EXISTS idx_document_signatures_company_id ON document_signatures(company_id);
CREATE INDEX IF NOT EXISTS idx_document_signers_company_id ON document_signers(company_id);
CREATE INDEX IF NOT EXISTS idx_document_signature_fields_company_id ON document_signature_fields(company_id);
CREATE INDEX IF NOT EXISTS idx_document_portal_tokens_company_id ON document_portal_tokens(company_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id ON audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_notifications_company_id ON notifications(company_id);
CREATE INDEX IF NOT EXISTS idx_portal_chat_messages_company_id ON portal_chat_messages(company_id);
CREATE INDEX IF NOT EXISTS idx_portal_chat_messages_archived_company_id ON portal_chat_messages_archived(company_id);
CREATE INDEX IF NOT EXISTS idx_portal_view_logs_company_id ON portal_view_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_edits_company_id ON opportunity_edits(company_id);
CREATE INDEX IF NOT EXISTS idx_appointment_edits_company_id ON appointment_edits(company_id);
CREATE INDEX IF NOT EXISTS idx_task_edits_company_id ON task_edits(company_id);
CREATE INDEX IF NOT EXISTS idx_note_edits_company_id ON note_edits(company_id);
CREATE INDEX IF NOT EXISTS idx_appointment_reminders_company_id ON appointment_reminders(company_id);
CREATE INDEX IF NOT EXISTS idx_project_notification_log_company_id ON project_notification_log(company_id);

CREATE INDEX IF NOT EXISTS idx_bill_payments_company_id ON bill_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_commission_payments_company_id ON commission_payments(company_id);

-- =============================================================================
-- 10. Enable RLS on Tenant Tables with Temporary Permissive Policies
-- =============================================================================

ALTER TABLE corporations ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_integrations ENABLE ROW LEVEL SECURITY;

-- Read policies for all authenticated users
CREATE POLICY "Allow authenticated read corporations"
ON corporations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read companies"
ON companies FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read company_settings"
ON company_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read company_integrations"
ON company_integrations FOR SELECT TO authenticated USING (true);

-- Admin write policies
CREATE POLICY "Allow admins manage corporations"
ON corporations FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'corp_admin')))
WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'corp_admin')));

CREATE POLICY "Allow admins manage companies"
ON companies FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'corp_admin', 'admin')))
WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'corp_admin', 'admin')));

CREATE POLICY "Allow admins manage company_settings"
ON company_settings FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'corp_admin', 'admin')))
WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'corp_admin', 'admin')));

CREATE POLICY "Allow admins manage company_integrations"
ON company_integrations FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'corp_admin', 'admin')))
WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'corp_admin', 'admin')));