-- Schedule hourly GHL data sync
SELECT cron.schedule(
  'ghl-hourly-sync',
  '0 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://mspujwrfhbobrxhofxzv.supabase.co/functions/v1/fetch-ghl-contacts',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zcHVqd3JmaGJvYnJ4aG9meHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NjYxMzAsImV4cCI6MjA4MDM0MjEzMH0.a22E2qHWsds830359yu-MSmbj5a8fa3eBCAO0yVYLRs"}'::jsonb,
      body := '{"syncToDb": true}'::jsonb
    ) AS request_id;
  $$
);