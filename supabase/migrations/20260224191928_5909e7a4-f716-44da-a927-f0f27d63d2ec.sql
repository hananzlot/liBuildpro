-- Reassign opportunities from incorrect cross-company UUID to David F's correct GHL user ID
UPDATE public.opportunities 
SET assigned_to = '7SX3ZGZG7mDyNEPByDzm'
WHERE assigned_to = '652d0c5d-71a8-4e33-ae99-e2dcdd1c516b';
