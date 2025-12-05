-- Insert a test appointment 2 hours from now for reminder system testing
INSERT INTO public.appointments (
  ghl_id, 
  title, 
  start_time, 
  end_time, 
  contact_id, 
  assigned_user_id, 
  location_id, 
  appointment_status,
  notes
) VALUES (
  'test-reminder-' || gen_random_uuid()::text,
  'TEST: Reminder System Verification',
  NOW() + INTERVAL '2 hours',
  NOW() + INTERVAL '3 hours',
  'Bukoy2c1BOZgMGhh8m03',
  'eRzLLPUOx3VZFTdTWpum',
  'pVeFrqvtYWNIPRIi0Fmr',
  'confirmed',
  'This is a test appointment to verify the reminder notification system'
);