-- Create enum for estimate status
CREATE TYPE estimate_status AS ENUM ('draft', 'sent', 'viewed', 'needs_changes', 'accepted', 'declined', 'expired');

-- Create enum for line item types
CREATE TYPE estimate_line_item_type AS ENUM ('labor', 'material', 'equipment', 'permit', 'assembly', 'note');

-- Create estimates table
CREATE TABLE public.estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_number serial NOT NULL,
  opportunity_id text REFERENCES opportunities(ghl_id),
  contact_id text,
  customer_name text NOT NULL,
  customer_email text,
  customer_phone text,
  job_address text,
  billing_address text,
  estimate_title text NOT NULL,
  estimate_date date NOT NULL DEFAULT CURRENT_DATE,
  expiration_date date,
  status estimate_status NOT NULL DEFAULT 'draft',
  deposit_required boolean DEFAULT false,
  deposit_amount numeric DEFAULT 0,
  deposit_percent numeric DEFAULT 0,
  deposit_due_rule text DEFAULT 'on_approval',
  tax_rate numeric DEFAULT 0,
  discount_type text DEFAULT 'percent',
  discount_value numeric DEFAULT 0,
  subtotal numeric DEFAULT 0,
  tax_amount numeric DEFAULT 0,
  discount_amount numeric DEFAULT 0,
  total numeric DEFAULT 0,
  notes text,
  terms_and_conditions text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create estimate_groups table (Areas)
CREATE TABLE public.estimate_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  group_name text NOT NULL,
  description text,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create estimate_line_items table
CREATE TABLE public.estimate_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  group_id uuid REFERENCES estimate_groups(id) ON DELETE SET NULL,
  item_type estimate_line_item_type NOT NULL DEFAULT 'material',
  description text NOT NULL,
  quantity numeric DEFAULT 1,
  unit text DEFAULT 'each',
  unit_price numeric DEFAULT 0,
  cost numeric DEFAULT 0,
  markup_percent numeric DEFAULT 0,
  line_total numeric DEFAULT 0,
  is_taxable boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create estimate_payment_schedule table
CREATE TABLE public.estimate_payment_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  phase_name text NOT NULL,
  amount numeric DEFAULT 0,
  percent numeric DEFAULT 0,
  due_type text DEFAULT 'milestone',
  due_date date,
  description text,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create estimate_attachments table
CREATE TABLE public.estimate_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  line_item_id uuid REFERENCES estimate_line_items(id) ON DELETE CASCADE,
  group_id uuid REFERENCES estimate_groups(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimate_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimate_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimate_payment_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimate_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for estimates
CREATE POLICY "Admin or contract_manager can read estimates"
  ON public.estimates FOR SELECT
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'contract_manager'::app_role));

CREATE POLICY "Admin or contract_manager can insert estimates"
  ON public.estimates FOR INSERT
  WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'contract_manager'::app_role));

CREATE POLICY "Admin or contract_manager can update estimates"
  ON public.estimates FOR UPDATE
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'contract_manager'::app_role));

CREATE POLICY "Admin can delete estimates"
  ON public.estimates FOR DELETE
  USING (is_admin(auth.uid()));

-- RLS Policies for estimate_groups
CREATE POLICY "Admin or contract_manager can read estimate_groups"
  ON public.estimate_groups FOR SELECT
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'contract_manager'::app_role));

CREATE POLICY "Admin or contract_manager can insert estimate_groups"
  ON public.estimate_groups FOR INSERT
  WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'contract_manager'::app_role));

CREATE POLICY "Admin or contract_manager can update estimate_groups"
  ON public.estimate_groups FOR UPDATE
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'contract_manager'::app_role));

CREATE POLICY "Admin or contract_manager can delete estimate_groups"
  ON public.estimate_groups FOR DELETE
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'contract_manager'::app_role));

-- RLS Policies for estimate_line_items
CREATE POLICY "Admin or contract_manager can read estimate_line_items"
  ON public.estimate_line_items FOR SELECT
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'contract_manager'::app_role));

CREATE POLICY "Admin or contract_manager can insert estimate_line_items"
  ON public.estimate_line_items FOR INSERT
  WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'contract_manager'::app_role));

CREATE POLICY "Admin or contract_manager can update estimate_line_items"
  ON public.estimate_line_items FOR UPDATE
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'contract_manager'::app_role));

CREATE POLICY "Admin or contract_manager can delete estimate_line_items"
  ON public.estimate_line_items FOR DELETE
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'contract_manager'::app_role));

-- RLS Policies for estimate_payment_schedule
CREATE POLICY "Admin or contract_manager can read estimate_payment_schedule"
  ON public.estimate_payment_schedule FOR SELECT
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'contract_manager'::app_role));

CREATE POLICY "Admin or contract_manager can insert estimate_payment_schedule"
  ON public.estimate_payment_schedule FOR INSERT
  WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'contract_manager'::app_role));

CREATE POLICY "Admin or contract_manager can update estimate_payment_schedule"
  ON public.estimate_payment_schedule FOR UPDATE
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'contract_manager'::app_role));

CREATE POLICY "Admin or contract_manager can delete estimate_payment_schedule"
  ON public.estimate_payment_schedule FOR DELETE
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'contract_manager'::app_role));

-- RLS Policies for estimate_attachments
CREATE POLICY "Admin or contract_manager can read estimate_attachments"
  ON public.estimate_attachments FOR SELECT
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'contract_manager'::app_role));

CREATE POLICY "Admin or contract_manager can insert estimate_attachments"
  ON public.estimate_attachments FOR INSERT
  WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'contract_manager'::app_role));

CREATE POLICY "Admin or contract_manager can update estimate_attachments"
  ON public.estimate_attachments FOR UPDATE
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'contract_manager'::app_role));

CREATE POLICY "Admin or contract_manager can delete estimate_attachments"
  ON public.estimate_attachments FOR DELETE
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'contract_manager'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_estimates_updated_at
  BEFORE UPDATE ON public.estimates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert test estimate record
INSERT INTO public.estimates (
  customer_name,
  customer_email,
  customer_phone,
  job_address,
  estimate_title,
  estimate_date,
  expiration_date,
  status,
  deposit_required,
  deposit_percent,
  tax_rate,
  subtotal,
  tax_amount,
  total,
  notes
) VALUES (
  'Test Customer - John Smith',
  'john.smith@example.com',
  '(555) 123-4567',
  '123 Test Street, Los Angeles, CA 90001',
  'Kitchen Remodel - Test Estimate',
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '30 days',
  'draft',
  true,
  30,
  9.5,
  25000,
  2375,
  27375,
  'This is a test estimate for functionality testing. Admins can delete this record.'
);

-- Get the test estimate ID and insert related records
DO $$
DECLARE
  test_estimate_id uuid;
  kitchen_group_id uuid;
  bathroom_group_id uuid;
BEGIN
  SELECT id INTO test_estimate_id FROM estimates WHERE customer_name = 'Test Customer - John Smith' LIMIT 1;
  
  -- Insert test groups
  INSERT INTO estimate_groups (estimate_id, group_name, description, sort_order)
  VALUES (test_estimate_id, 'Kitchen', 'Kitchen remodel scope', 1)
  RETURNING id INTO kitchen_group_id;
  
  INSERT INTO estimate_groups (estimate_id, group_name, description, sort_order)
  VALUES (test_estimate_id, 'Bathroom', 'Master bathroom updates', 2)
  RETURNING id INTO bathroom_group_id;
  
  -- Insert test line items for Kitchen
  INSERT INTO estimate_line_items (estimate_id, group_id, item_type, description, quantity, unit, unit_price, line_total, sort_order)
  VALUES 
    (test_estimate_id, kitchen_group_id, 'labor', 'Demo existing cabinets', 16, 'hours', 75, 1200, 1),
    (test_estimate_id, kitchen_group_id, 'material', 'Custom cabinets - shaker style', 1, 'set', 8500, 8500, 2),
    (test_estimate_id, kitchen_group_id, 'material', 'Granite countertops', 45, 'sqft', 85, 3825, 3),
    (test_estimate_id, kitchen_group_id, 'labor', 'Cabinet installation', 24, 'hours', 85, 2040, 4),
    (test_estimate_id, kitchen_group_id, 'labor', 'Countertop installation', 8, 'hours', 95, 760, 5);
  
  -- Insert test line items for Bathroom
  INSERT INTO estimate_line_items (estimate_id, group_id, item_type, description, quantity, unit, unit_price, line_total, sort_order)
  VALUES 
    (test_estimate_id, bathroom_group_id, 'material', 'Tile flooring - porcelain', 120, 'sqft', 12, 1440, 1),
    (test_estimate_id, bathroom_group_id, 'labor', 'Tile installation', 16, 'hours', 75, 1200, 2),
    (test_estimate_id, bathroom_group_id, 'material', 'Vanity with sink', 1, 'unit', 1200, 1200, 3),
    (test_estimate_id, bathroom_group_id, 'permit', 'Plumbing permit', 1, 'each', 350, 350, 4);
  
  -- Insert test payment schedule
  INSERT INTO estimate_payment_schedule (estimate_id, phase_name, percent, due_type, description, sort_order)
  VALUES 
    (test_estimate_id, 'Deposit', 30, 'on_approval', 'Due upon contract signing', 1),
    (test_estimate_id, 'Materials Ordered', 30, 'milestone', 'Due when materials are ordered', 2),
    (test_estimate_id, 'Rough Complete', 20, 'milestone', 'Due after rough-in completion', 3),
    (test_estimate_id, 'Final', 20, 'milestone', 'Due upon project completion', 4);
END $$;