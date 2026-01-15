-- Create a cron job to send daily portal update emails at 9 AM every day
SELECT cron.schedule(
  'send-daily-portal-updates',
  '0 9 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://mspujwrfhbobrxhofxzv.supabase.co/functions/v1/send-daily-portal-updates',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zcHVqd3JmaGJvYnJ4aG9meHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NjYxMzAsImV4cCI6MjA4MDM0MjEzMH0.a22E2qHWsds830359yu-MSmbj5a8fa3eBCAO0yVYLRs"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);