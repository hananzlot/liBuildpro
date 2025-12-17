-- Add magazine_editor role to the enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'magazine_editor';