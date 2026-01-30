-- Enable Realtime for project_invoices and project_payments tables
ALTER PUBLICATION supabase_realtime ADD TABLE project_invoices;
ALTER PUBLICATION supabase_realtime ADD TABLE project_payments;