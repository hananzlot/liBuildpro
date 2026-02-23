-- Fix existing overdue_task notifications that point to /contacts?task= (which doesn't exist)
-- Set them to /follow-up so they at least land on the right page
UPDATE public.notifications 
SET reference_url = '/follow-up'
WHERE type = 'overdue_task' 
  AND reference_url LIKE '/contacts?task=%';