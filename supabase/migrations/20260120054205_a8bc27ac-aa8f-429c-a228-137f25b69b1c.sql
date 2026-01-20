-- Schedule the subscription expiration check to run daily at 6 AM UTC
SELECT cron.schedule(
  'process-subscription-expirations-daily',
  '0 6 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://mspujwrfhbobrxhofxzv.supabase.co/functions/v1/process-subscription-expirations',
        headers:=jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zcHVqd3JmaGJvYnJ4aG9meHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NjYxMzAsImV4cCI6MjA4MDM0MjEzMH0.a22E2qHWsds830359yu-MSmbj5a8fa3eBCAO0yVYLRs'
        ),
        body:=jsonb_build_object('time', now())
    ) as request_id;
  $$
);