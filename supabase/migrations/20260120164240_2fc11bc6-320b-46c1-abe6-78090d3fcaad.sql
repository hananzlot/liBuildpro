-- Fix profiles RLS: require company membership for all access
DROP POLICY IF EXISTS "Users view profiles in their company" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users update own profile in their company" ON profiles;

-- Users can only view profiles in their company (must have company_id set)
CREATE POLICY "Users view profiles in their company"
ON profiles FOR SELECT
TO authenticated
USING (
  -- User can view their own profile always
  id = auth.uid()
  OR
  -- User can view profiles in their company
  (company_id IS NOT NULL AND has_company_access(company_id))
);

-- Users can only update their own profile
CREATE POLICY "Users update own profile"
ON profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Admins can update profiles in their company
CREATE POLICY "Admins update profiles in their company"
ON profiles FOR UPDATE
TO authenticated
USING (
  is_admin(auth.uid()) 
  AND company_id IS NOT NULL 
  AND has_company_access(company_id)
)
WITH CHECK (
  is_admin(auth.uid()) 
  AND company_id IS NOT NULL 
  AND has_company_access(company_id)
);

-- Fix encryption_keys table: enable RLS and deny all access (legacy table)
ALTER TABLE IF EXISTS encryption_keys ENABLE ROW LEVEL SECURITY;

-- Create restrictive policy - only super_admin can access (or drop if unused)
CREATE POLICY "Only super_admin access encryption_keys"
ON encryption_keys FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'))
WITH CHECK (has_role(auth.uid(), 'super_admin'));