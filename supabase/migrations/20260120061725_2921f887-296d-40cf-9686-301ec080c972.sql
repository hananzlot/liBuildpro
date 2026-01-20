-- Backfill ALL tables with CA Pro Builders company_id for existing records
-- Company ID: 00000000-0000-0000-0000-000000000002

-- Core data tables
UPDATE public.contacts SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.opportunities SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.appointments SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.projects SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.estimates SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;

-- Estimate related tables
UPDATE public.estimate_groups SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.estimate_line_items SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.estimate_payment_schedule SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.estimate_attachments SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.estimate_signatures SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.estimate_signers SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.estimate_portal_tokens SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;

-- Project related tables
UPDATE public.project_agreements SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.project_bills SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.project_cases SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.project_checklists SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.project_commissions SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.project_costs SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.project_documents SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.project_feedback SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.project_finance SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.project_invoices SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.project_messages SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.project_note_comments SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.project_notes SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.project_notification_log SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.project_payment_phases SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.project_payments SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;

-- Document/Signature tables
UPDATE public.signature_documents SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.signature_field_templates SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.signature_field_template_items SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.document_portal_tokens SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.document_signature_fields SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.document_signatures SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.document_signers SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;

-- Communication/Portal tables
UPDATE public.client_comments SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.client_portal_tokens SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.portal_chat_messages SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.portal_chat_messages_archived SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.portal_view_logs SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.conversations SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.call_logs SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.contact_notes SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;

-- Task/Activity tables
UPDATE public.tasks SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.ghl_tasks SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.task_edits SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.notifications SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;

-- Edit/Audit tables
UPDATE public.appointment_edits SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.opportunity_edits SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.note_edits SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.magazine_sales_edits SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.audit_logs SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;

-- Sales/Financial tables
UPDATE public.opportunity_sales SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.magazine_sales SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.salespeople SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.commission_payments SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.bill_payments SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.billing_history SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.banks SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;

-- GHL/Integration tables
UPDATE public.ghl_calendars SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.ghl_pipelines SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.ghl_users SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.ghl_field_mappings SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.imported_records SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;

-- Reminder tables
UPDATE public.appointment_reminders SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;

-- Reference/Config tables
UPDATE public.project_statuses SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.project_types SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.subcontractors SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;
UPDATE public.trades SET company_id = '00000000-0000-0000-0000-000000000002' WHERE company_id IS NULL;