-- Create project_refunds table for tracking customer refunds
CREATE TABLE public.project_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id),
  refund_amount NUMERIC NOT NULL,
  refund_date DATE,
  refund_method TEXT,
  refund_reference TEXT,
  bank_id UUID REFERENCES banks(id),
  bank_name TEXT,
  reason TEXT,
  notes TEXT,
  refund_status TEXT DEFAULT 'Pending',
  exclude_from_qb BOOLEAN DEFAULT false,
  is_voided BOOLEAN DEFAULT false,
  voided_at TIMESTAMPTZ,
  voided_by UUID REFERENCES auth.users(id),
  void_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS (matching current pattern — will be fixed in Phase 3 security hardening)
ALTER TABLE project_refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for project_refunds" ON project_refunds FOR ALL USING (true) WITH CHECK (true);

-- Indexes for common query patterns
CREATE INDEX idx_project_refunds_project_id ON project_refunds(project_id);
CREATE INDEX idx_project_refunds_company_id ON project_refunds(company_id);

-- Updated_at trigger
CREATE TRIGGER set_updated_at BEFORE UPDATE ON project_refunds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
