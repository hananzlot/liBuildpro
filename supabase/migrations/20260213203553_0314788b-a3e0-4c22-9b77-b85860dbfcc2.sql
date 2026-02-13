-- Fix unique constraints to be company-scoped for multi-tenant support

-- salespeople: name should be unique per company
ALTER TABLE public.salespeople DROP CONSTRAINT salespeople_name_key;
ALTER TABLE public.salespeople ADD CONSTRAINT salespeople_name_company_key UNIQUE (name, company_id);

-- trades: name should be unique per company  
ALTER TABLE public.trades DROP CONSTRAINT trades_name_key;
ALTER TABLE public.trades ADD CONSTRAINT trades_name_company_key UNIQUE (name, company_id);

-- banks: name should be unique per company
ALTER TABLE public.banks DROP CONSTRAINT banks_name_key;
ALTER TABLE public.banks ADD CONSTRAINT banks_name_company_key UNIQUE (name, company_id);
