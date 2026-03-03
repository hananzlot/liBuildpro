
CREATE OR REPLACE FUNCTION public.auto_seed_email_domain_for_company()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.company_email_domains (
    company_id,
    domain,
    use_platform_domain,
    verified,
    from_name
  ) VALUES (
    NEW.id,
    'platform-default',
    true,
    false,
    NEW.name
  )
  ON CONFLICT (company_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_seed_email_domain
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_seed_email_domain_for_company();
