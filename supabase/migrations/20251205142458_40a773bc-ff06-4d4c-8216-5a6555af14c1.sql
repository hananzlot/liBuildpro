-- Add duration column to call_logs table to store call duration in seconds
ALTER TABLE call_logs ADD COLUMN duration integer DEFAULT 0;