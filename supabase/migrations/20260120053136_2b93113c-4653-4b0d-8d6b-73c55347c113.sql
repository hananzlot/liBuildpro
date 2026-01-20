-- Create subscription status enum
CREATE TYPE public.subscription_status AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'expired', 'paused');

-- Create billing cycle enum
CREATE TYPE public.billing_cycle AS ENUM ('monthly', 'yearly');

-- Create subscription_plans table
CREATE TABLE public.subscription_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  price_monthly DECIMAL(10,2) NOT NULL DEFAULT 0,
  price_yearly DECIMAL(10,2) NOT NULL DEFAULT 0,
  max_users INTEGER NOT NULL DEFAULT -1, -- -1 means unlimited
  features JSONB NOT NULL DEFAULT '{}',
  stripe_price_id_monthly TEXT,
  stripe_price_id_yearly TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create subscription_features table (master list of features)
CREATE TABLE public.subscription_features (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  feature_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create company_subscriptions table
CREATE TABLE public.company_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status public.subscription_status NOT NULL DEFAULT 'trialing',
  billing_cycle public.billing_cycle NOT NULL DEFAULT 'monthly',
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  canceled_at TIMESTAMP WITH TIME ZONE,
  grace_period_ends_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

-- Create billing_history table
CREATE TABLE public.billing_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.company_subscriptions(id) ON DELETE SET NULL,
  stripe_invoice_id TEXT,
  amount DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  invoice_url TEXT,
  description TEXT,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_history ENABLE ROW LEVEL SECURITY;

-- Subscription plans: Anyone can read active plans, only super admins can modify
CREATE POLICY "Anyone can view active subscription plans"
ON public.subscription_plans FOR SELECT
USING (is_active = true);

CREATE POLICY "Super admins can manage subscription plans"
ON public.subscription_plans FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'super_admin'
  )
);

-- Subscription features: Anyone can read
CREATE POLICY "Anyone can view subscription features"
ON public.subscription_features FOR SELECT
USING (true);

CREATE POLICY "Super admins can manage subscription features"
ON public.subscription_features FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'super_admin'
  )
);

-- Company subscriptions: Company members can view their subscription, super admins can manage all
CREATE POLICY "Company members can view their subscription"
ON public.company_subscriptions FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'super_admin'
  )
);

CREATE POLICY "Super admins can manage all subscriptions"
ON public.company_subscriptions FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'super_admin'
  )
);

-- Billing history: Company admins can view their billing, super admins can manage all
CREATE POLICY "Company admins can view their billing history"
ON public.billing_history FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'super_admin'
  )
);

CREATE POLICY "Super admins can manage all billing history"
ON public.billing_history FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'super_admin'
  )
);

-- Create updated_at triggers
CREATE TRIGGER update_subscription_plans_updated_at
BEFORE UPDATE ON public.subscription_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_company_subscriptions_updated_at
BEFORE UPDATE ON public.company_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default subscription features
INSERT INTO public.subscription_features (feature_key, name, description, category) VALUES
('dashboard', 'Dashboard', 'Access to main dashboard and metrics', 'Core'),
('sales_portal', 'Sales Portal', 'Access to sales and opportunities management', 'Sales'),
('ghl_integration', 'GHL Integration', 'GoHighLevel CRM integration', 'Integrations'),
('production', 'Production Management', 'Project and production tracking', 'Operations'),
('estimates', 'Estimates & Proposals', 'Create and send estimates/proposals', 'Sales'),
('documents', 'Document Signing', 'Document signature workflows', 'Documents'),
('magazine_sales', 'Magazine Sales', 'Magazine advertising sales module', 'Sales'),
('client_portal', 'Client Portal', 'Customer-facing project portal', 'Client'),
('analytics', 'Advanced Analytics', 'Financial analytics and reporting', 'Analytics'),
('multi_location', 'Multi-Location', 'Support for multiple GHL locations', 'Advanced');

-- Insert default subscription plans
INSERT INTO public.subscription_plans (name, slug, description, price_monthly, price_yearly, max_users, features, sort_order) VALUES
('Starter', 'starter', 'Perfect for small teams getting started', 99.00, 990.00, 3, 
 '{"dashboard": true, "sales_portal": true, "production": true, "estimates": true, "client_portal": true}', 1),
('Professional', 'professional', 'For growing businesses with advanced needs', 249.00, 2490.00, 10,
 '{"dashboard": true, "sales_portal": true, "production": true, "estimates": true, "client_portal": true, "ghl_integration": true, "documents": true, "magazine_sales": true, "analytics": true}', 2),
('Enterprise', 'enterprise', 'Full-featured solution for large organizations', 499.00, 4990.00, -1,
 '{"dashboard": true, "sales_portal": true, "production": true, "estimates": true, "client_portal": true, "ghl_integration": true, "documents": true, "magazine_sales": true, "analytics": true, "multi_location": true}', 3);