-- Create a function to check if current user can modify a user's super_admin role
CREATE OR REPLACE FUNCTION public.can_modify_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_has_super_admin BOOLEAN;
  current_user_is_super_admin BOOLEAN;
BEGIN
  -- Check if the current user is a super_admin
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  ) INTO current_user_is_super_admin;

  -- For INSERT: Check if we're trying to add super_admin role
  IF TG_OP = 'INSERT' THEN
    IF NEW.role = 'super_admin' AND NOT current_user_is_super_admin THEN
      RAISE EXCEPTION 'Only super_admin users can grant the super_admin role';
    END IF;
    RETURN NEW;
  END IF;

  -- For DELETE: Check if target user has super_admin role
  IF TG_OP = 'DELETE' THEN
    IF OLD.role = 'super_admin' AND NOT current_user_is_super_admin THEN
      RAISE EXCEPTION 'Only super_admin users can remove the super_admin role';
    END IF;
    RETURN OLD;
  END IF;

  -- For UPDATE: Check both old and new role
  IF TG_OP = 'UPDATE' THEN
    IF (OLD.role = 'super_admin' OR NEW.role = 'super_admin') AND NOT current_user_is_super_admin THEN
      RAISE EXCEPTION 'Only super_admin users can modify super_admin roles';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

-- Create trigger to enforce super_admin protection
DROP TRIGGER IF EXISTS protect_super_admin_role ON public.user_roles;

CREATE TRIGGER protect_super_admin_role
  BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.can_modify_user_role();