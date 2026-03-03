ALTER TABLE public.short_links DROP CONSTRAINT short_links_created_by_type_check;

ALTER TABLE public.short_links ADD CONSTRAINT short_links_created_by_type_check CHECK (created_by_type = ANY (ARRAY['internal_user'::text, 'customer'::text, 'salesperson'::text, 'system'::text]));