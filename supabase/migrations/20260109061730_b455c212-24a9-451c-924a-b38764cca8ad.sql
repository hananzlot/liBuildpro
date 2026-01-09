-- Create projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id TEXT,
  contact_id TEXT,
  location_id TEXT NOT NULL,
  project_number SERIAL,
  contract_number TEXT,
  project_name TEXT NOT NULL,
  project_status TEXT DEFAULT 'New Job',
  project_manager TEXT,
  lead_number TEXT,
  lead_source TEXT,
  branch TEXT,
  sold_under TEXT,
  estimated_cost NUMERIC DEFAULT 0,
  total_pl NUMERIC DEFAULT 0,
  permit_numbers TEXT,
  lock_box_code TEXT,
  due_date DATE,
  dropbox_link TEXT,
  customer_first_name TEXT,
  customer_last_name TEXT,
  customer_email TEXT,
  home_phone TEXT,
  cell_phone TEXT,
  alt_phone TEXT,
  project_address TEXT,
  has_hoa BOOLEAN DEFAULT FALSE,
  utility TEXT,
  date_of_birth DATE,
  contact_preferences TEXT,
  project_type TEXT,
  project_subcategory TEXT,
  agreement_signed_date DATE,
  contract_expiration_date DATE,
  primary_salesperson TEXT,
  primary_commission_pct NUMERIC DEFAULT 100,
  secondary_salesperson TEXT,
  secondary_commission_pct NUMERIC DEFAULT 0,
  tertiary_salesperson TEXT,
  tertiary_commission_pct NUMERIC DEFAULT 0,
  quaternary_salesperson TEXT,
  quaternary_commission_pct NUMERIC DEFAULT 0,
  install_status TEXT DEFAULT 'New Job',
  install_notes TEXT,
  install_start_date DATE,
  installers_on_site TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

CREATE TABLE public.project_finance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  bank_name TEXT,
  finance_type TEXT,
  approved_amount NUMERIC DEFAULT 0,
  account_number TEXT,
  used_amount NUMERIC DEFAULT 0,
  finance_balance NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.project_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  agreement_number TEXT,
  agreement_signed_date DATE,
  agreement_type TEXT,
  lead_cost_percent NUMERIC DEFAULT 15,
  total_price NUMERIC DEFAULT 0,
  average_lead_cost NUMERIC DEFAULT 0,
  description_of_work TEXT,
  attachment_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.project_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  agreement_id UUID REFERENCES project_agreements(id) ON DELETE SET NULL,
  invoice_number TEXT,
  invoice_date DATE,
  amount NUMERIC DEFAULT 0,
  total_expected NUMERIC DEFAULT 0,
  payments_received NUMERIC DEFAULT 0,
  open_balance NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.project_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES project_invoices(id) ON DELETE SET NULL,
  bank_name TEXT,
  projected_received_date DATE,
  payment_schedule TEXT,
  payment_status TEXT DEFAULT 'Pending',
  do_not_summarize BOOLEAN DEFAULT FALSE,
  deposit_verified BOOLEAN DEFAULT FALSE,
  payment_fee NUMERIC DEFAULT 0,
  payment_amount NUMERIC DEFAULT 0,
  check_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.project_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  installer_company TEXT,
  category TEXT,
  bill_ref TEXT,
  bill_amount NUMERIC DEFAULT 0,
  amount_paid NUMERIC DEFAULT 0,
  balance NUMERIC DEFAULT 0,
  memo TEXT,
  not_affecting_payment BOOLEAN DEFAULT FALSE,
  attachment_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.project_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  salesperson TEXT,
  total_commission NUMERIC DEFAULT 0,
  commission_paid NUMERIC DEFAULT 0,
  commission_balance NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.project_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  item TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.project_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  subject TEXT,
  message TEXT,
  attachment_url TEXT,
  is_alert BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.project_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  service_call_status TEXT,
  welcome_call_notes TEXT,
  progress_call_notes TEXT,
  completion_call_notes TEXT,
  satisfaction_rank INTEGER,
  customer_feedback TEXT,
  online_review_given BOOLEAN DEFAULT FALSE,
  review_location TEXT,
  use_as_reference BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.project_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  case_number TEXT,
  customer_status TEXT,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

-- Enable RLS on all tables
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_finance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_cases ENABLE ROW LEVEL SECURITY;

-- RLS Policies for projects table
CREATE POLICY "Production or admin can read projects" ON public.projects
FOR SELECT USING (has_role(auth.uid(), 'production') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Production or admin can insert projects" ON public.projects
FOR INSERT WITH CHECK (has_role(auth.uid(), 'production') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Production or admin can update projects" ON public.projects
FOR UPDATE USING (has_role(auth.uid(), 'production') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Production or admin can delete projects" ON public.projects
FOR DELETE USING (has_role(auth.uid(), 'production') OR has_role(auth.uid(), 'admin'));

-- RLS Policies for project_finance
CREATE POLICY "Production or admin can read project_finance" ON public.project_finance
FOR SELECT USING (has_role(auth.uid(), 'production') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Production or admin can insert project_finance" ON public.project_finance
FOR INSERT WITH CHECK (has_role(auth.uid(), 'production') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Production or admin can update project_finance" ON public.project_finance
FOR UPDATE USING (has_role(auth.uid(), 'production') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Production or admin can delete project_finance" ON public.project_finance
FOR DELETE USING (has_role(auth.uid(), 'production') OR has_role(auth.uid(), 'admin'));

-- RLS Policies for project_agreements
CREATE POLICY "Production or admin can read project_agreements" ON public.project_agreements
FOR SELECT USING (has_role(auth.uid(), 'production') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Production or admin can insert project_agreements" ON public.project_agreements
FOR INSERT WITH CHECK (has_role(auth.uid(), 'production') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Production or admin can update project_agreements" ON public.project_agreements
FOR UPDATE USING (has_role(auth.uid(), 'production') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Production or admin can delete project_agreements" ON public.project_agreements
FOR DELETE USING (has_role(auth.uid(), 'production') OR has_role(auth.uid(), 'admin'));

-- RLS Policies for project_invoices
CREATE POLICY "Production or admin can read project_invoices" ON public.project_invoices
FOR SELECT USING (has_role(auth.uid(), 'production') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Production or admin can insert project_invoices" ON public.project_invoices
FOR INSERT WITH CHECK (has_role(auth.uid(), 'production') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Production or admin can update project_invoices" ON public.project_invoices
FOR UPDATE USING (has_role(auth.uid(), 'production') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Production or admin can delete project_invoices" ON public.project_invoices
FOR DELETE USING (has_role(auth.uid(), 'production') OR has_role(auth.uid(), 'admin'));

-- RLS Policies for project_payments
CREATE POLICY "Production or admin can read project_payments" ON public.project_payments
FOR SELECT USING (has_role(auth.uid(), 'production') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Production or admin can insert project_payments" ON public.project_payments
FOR INSERT WITH CHECK (has_role(auth.uid(), 'production') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Production or admin can update project_payments" ON public.project_payments
FOR UPDATE USING (has_role(auth.uid(), 'production') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Production or admin can delete project_payments" ON public.project_payments
FOR DELETE USING (has_role(auth.uid(), 'production') OR has_role(auth.uid(), 'admin'));

-- RLS Policies for project_bills
CREATE POLICY "Production or admin can read project_bills" ON public.project_bills
FOR SELECT USING (has_role(auth.uid(), 'production') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Production or admin can insert project_bills" ON public.project_bills
FOR INSERT WITH CHECK (has_role(auth.uid(), 'production') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Production or admin can update project_bills" ON public.project_bills
FOR UPDATE USING (has_role(auth.uid(), 'production') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Production or admin can delete project_bills" ON public.project_bills
FOR DELETE USING (has_role(auth.uid(), 'production') OR has_role(auth.uid(), 'admin'));

-- RLS Policies for project_commissions
CREATE POLICY "Production or admin can read project_commissions" ON public.project_commissions
FOR SELECT USING (has_role(auth.uid(), 'production') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Production or admin can insert project_commissions" ON public.project_commissions
FOR INSERT WITH CHECK (has_role(auth.uid(), 'production') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Production or admin can update project_commissions" ON public.project_commissions
FOR UPDATE USING (has_role(auth.uid(), 'production') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Production or admin can delete project_commissions" ON public.project_commissions
FOR DELETE USING (has_role(auth.uid(), 'production') OR has_role(auth.uid(), 'admin'));

-- RLS Policies for project_checklists
CREATE POLICY "Production or admin can read project_checklists" ON public.project_checklists
FOR SELECT USING (has_role(auth.uid(), 'production') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Production or admin can insert project_checklists" ON public.project_checklists
FOR INSERT WITH CHECK (has_role(auth.uid(), 'production') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Production or admin can update project_checklists" ON public.project_checklists
FOR UPDATE USING (has_role(auth.uid(), 'production') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Production or admin can delete project_checklists" ON public.project_checklists
FOR DELETE USING (has_role(auth.uid(), 'production') OR has_role(auth.uid(), 'admin'));

-- RLS Policies for project_messages
CREATE POLICY "Production or admin can read project_messages" ON public.project_messages
FOR SELECT USING (has_role(auth.uid(), 'production') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Production or admin can insert project_messages" ON public.project_messages
FOR INSERT WITH CHECK (has_role(auth.uid(), 'production') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Production or admin can update project_messages" ON public.project_messages
FOR UPDATE USING (has_role(auth.uid(), 'production') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Production or admin can delete project_messages" ON public.project_messages
FOR DELETE USING (has_role(auth.uid(), 'production') OR has_role(auth.uid(), 'admin'));

-- RLS Policies for project_feedback
CREATE POLICY "Production or admin can read project_feedback" ON public.project_feedback
FOR SELECT USING (has_role(auth.uid(), 'production') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Production or admin can insert project_feedback" ON public.project_feedback
FOR INSERT WITH CHECK (has_role(auth.uid(), 'production') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Production or admin can update project_feedback" ON public.project_feedback
FOR UPDATE USING (has_role(auth.uid(), 'production') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Production or admin can delete project_feedback" ON public.project_feedback
FOR DELETE USING (has_role(auth.uid(), 'production') OR has_role(auth.uid(), 'admin'));

-- RLS Policies for project_cases
CREATE POLICY "Production or admin can read project_cases" ON public.project_cases
FOR SELECT USING (has_role(auth.uid(), 'production') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Production or admin can insert project_cases" ON public.project_cases
FOR INSERT WITH CHECK (has_role(auth.uid(), 'production') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Production or admin can update project_cases" ON public.project_cases
FOR UPDATE USING (has_role(auth.uid(), 'production') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Production or admin can delete project_cases" ON public.project_cases
FOR DELETE USING (has_role(auth.uid(), 'production') OR has_role(auth.uid(), 'admin'));

-- Service role policies for edge functions
CREATE POLICY "Service role projects" ON public.projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role project_finance" ON public.project_finance FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role project_agreements" ON public.project_agreements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role project_invoices" ON public.project_invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role project_payments" ON public.project_payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role project_bills" ON public.project_bills FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role project_commissions" ON public.project_commissions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role project_checklists" ON public.project_checklists FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role project_messages" ON public.project_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role project_feedback" ON public.project_feedback FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role project_cases" ON public.project_cases FOR ALL USING (true) WITH CHECK (true);

-- Create updated_at triggers
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_finance_updated_at BEFORE UPDATE ON public.project_finance
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_agreements_updated_at BEFORE UPDATE ON public.project_agreements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_invoices_updated_at BEFORE UPDATE ON public.project_invoices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_payments_updated_at BEFORE UPDATE ON public.project_payments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_bills_updated_at BEFORE UPDATE ON public.project_bills
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_commissions_updated_at BEFORE UPDATE ON public.project_commissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_feedback_updated_at BEFORE UPDATE ON public.project_feedback
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();