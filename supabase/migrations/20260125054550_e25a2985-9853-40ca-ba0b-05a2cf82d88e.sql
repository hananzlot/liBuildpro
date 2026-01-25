
-- Link "Annabella " to Annabella Baluyut's GHL ID
UPDATE public.salespeople 
SET ghl_user_id = 'M2hb32kkpUriIHihdDnC', name = 'Annabella Baluyut'
WHERE id = 'edb837b1-61b4-4bd9-b507-9eb904889e5f';

-- Link Asher Peretz (using the GHL ID with more records)
UPDATE public.salespeople 
SET ghl_user_id = '7l0AZztGxaqM3yE2NkeZ'
WHERE id = '73f8587a-48e8-40ee-baae-539eaece8572';

-- Link David F
UPDATE public.salespeople 
SET ghl_user_id = '7SX3ZGZG7mDyNEPByDzm'
WHERE id = '652d0c5d-71a8-4e33-ae99-e2dcdd1c516b';

-- Link Ely Levi
UPDATE public.salespeople 
SET ghl_user_id = 'shvPXOa6ckaqVMSCgSJy'
WHERE id = '2b945387-36a3-4c9b-9e57-b4e4990f0870';

-- Link Ephi Zlotnitsky
UPDATE public.salespeople 
SET ghl_user_id = 'Fuv1DyMDbbSDOiIRKLNx'
WHERE id = 'dd0f90ed-a1aa-4ee1-95db-567ac80fdd08';

-- Link Eyal to Eyal Eyal
UPDATE public.salespeople 
SET ghl_user_id = 'HGpxnVy7N9ruA359ACXG', name = 'Eyal Eyal'
WHERE id = '72481701-e48a-4626-9fab-0b4a99937c80';

-- Link Tomer Jedda
UPDATE public.salespeople 
SET ghl_user_id = 'iXi5OGKuCpzdUzelAUjx'
WHERE id = '0acd158f-1dbc-4279-9aa6-e4717cf5978a';

-- Add missing salespeople: Vanessa Sandoval (using GHL ID with 45 opps)
INSERT INTO public.salespeople (name, ghl_user_id, company_id, is_active)
VALUES ('Vanessa Sandoval', '7xgXANv9seqscryAYw4D', '00000000-0000-0000-0000-000000000002', true);

-- Add missing salespeople: James Fitzgerald
INSERT INTO public.salespeople (name, ghl_user_id, company_id, is_active)
VALUES ('James Fitzgerald', 'if4Oy4aC6e2xSIhsxaCh', '00000000-0000-0000-0000-000000000002', true);