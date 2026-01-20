-- Create a trigger function that automatically sets company_id based on the authenticated user
CREATE OR REPLACE FUNCTION public.set_company_id_from_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_company_id uuid;
BEGIN
  -- Only set company_id if it's NULL and user is authenticated
  IF NEW.company_id IS NULL AND auth.uid() IS NOT NULL THEN
    SELECT company_id INTO user_company_id
    FROM public.profiles
    WHERE id = auth.uid();
    
    NEW.company_id := user_company_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Apply trigger to all tables with company_id (excluding system/config tables)
-- User-created content tables
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.appointment_edits FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.appointment_reminders FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.banks FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.bill_payments FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.call_logs FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.client_comments FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.client_portal_tokens FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.commission_payments FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.contact_notes FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.document_portal_tokens FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.document_signature_fields FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.document_signatures FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.document_signers FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.estimate_attachments FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.estimate_groups FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.estimate_line_items FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.estimate_payment_schedule FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.estimate_portal_tokens FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.estimate_signatures FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.estimate_signers FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.estimates FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.ghl_calendars FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.ghl_field_mappings FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.ghl_pipelines FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.ghl_tasks FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.ghl_users FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.imported_records FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.magazine_sales FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.magazine_sales_edits FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.note_edits FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.opportunity_edits FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.opportunity_sales FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.portal_chat_messages FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.portal_view_logs FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.project_agreements FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.project_bills FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.project_cases FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.project_checklists FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.project_commissions FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.project_costs FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.project_documents FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.project_feedback FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.project_finance FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.project_invoices FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.project_messages FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.project_note_comments FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.project_notes FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.project_notification_log FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.project_payment_phases FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.project_payments FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.project_statuses FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.project_types FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.projects FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.salespeople FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.signature_documents FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.signature_field_template_items FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.signature_field_templates FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.subcontractors FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.task_edits FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();
CREATE TRIGGER set_company_id_on_insert BEFORE INSERT ON public.trades FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_user();