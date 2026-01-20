-- Fix bill_payments: remove public access policy
DROP POLICY IF EXISTS "Allow all access to bill_payments" ON bill_payments;

-- Fix commission_payments: remove public policies
DROP POLICY IF EXISTS "Authenticated users can delete commission payments" ON commission_payments;
DROP POLICY IF EXISTS "Authenticated users can insert commission payments" ON commission_payments;
DROP POLICY IF EXISTS "Authenticated users can update commission payments" ON commission_payments;
DROP POLICY IF EXISTS "Authenticated users can view commission payments" ON commission_payments;

-- The remaining policies are already proper:
-- - "Users manage bill payments in their company" (authenticated + has_company_access)
-- - "Users view bill payments in their company" (authenticated + has_company_access)
-- - "Users manage commission payments in their company" (authenticated + has_company_access)
-- - "Users view commission payments in their company" (authenticated + has_company_access)
-- - "Users manage project bills in their company" (authenticated + has_company_access)
-- - "Users view project bills in their company" (authenticated + has_company_access)
-- - "Users manage project payments in their company" (authenticated + has_company_access)
-- - "Users view project payments in their company" (authenticated + has_company_access)