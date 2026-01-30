-- Add bill_payments and project_bills to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.bill_payments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_bills;