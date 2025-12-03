-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule the sync to run every 15 minutes
SELECT cron.schedule(
  'sync-ghl-contacts-every-15-min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://mspujwrfhbobrxhofxzv.supabase.co/functions/v1/fetch-ghl-contacts',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zcHVqd3JmaGJvYnJ4aG9meHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NjYxMzAsImV4cCI6MjA4MDM0MjEzMH0.a22E2qHWsds830359yu-MSmbj5a8fa3eBCAO0yVYLRs"}'::jsonb,
    body := '{"syncToDb": true}'::jsonb
  ) AS request_id;
  $$
);