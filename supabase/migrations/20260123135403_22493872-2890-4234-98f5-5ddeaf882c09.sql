-- Remove cron jobs for deleted edge functions
SELECT cron.unschedule('sync-ghl-contacts-every-15-min');
SELECT cron.unschedule('ghl-hourly-sync');
SELECT cron.unschedule('import-ghl-location2-every-10-min');