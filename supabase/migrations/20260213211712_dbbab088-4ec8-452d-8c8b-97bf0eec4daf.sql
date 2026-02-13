
ALTER TABLE public.project_statuses DROP CONSTRAINT project_statuses_name_key;
ALTER TABLE public.project_statuses ADD CONSTRAINT project_statuses_name_company_key UNIQUE (name, company_id);

ALTER TABLE public.project_types DROP CONSTRAINT project_types_name_key;
ALTER TABLE public.project_types ADD CONSTRAINT project_types_name_company_key UNIQUE (name, company_id);
