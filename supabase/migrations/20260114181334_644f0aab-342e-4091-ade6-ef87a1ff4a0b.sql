-- Create client portal access tokens table
CREATE TABLE public.client_portal_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  estimate_id UUID REFERENCES estimates(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  client_email TEXT,
  client_name TEXT,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '30 days'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES profiles(id),
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  access_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  CONSTRAINT check_estimate_or_project CHECK (estimate_id IS NOT NULL OR project_id IS NOT NULL)
);

-- Create signatures table
CREATE TABLE public.estimate_signatures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  estimate_id UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  signer_name TEXT NOT NULL,
  signer_email TEXT,
  signature_type TEXT NOT NULL CHECK (signature_type IN ('typed', 'drawn')),
  signature_data TEXT NOT NULL, -- base64 for drawn, text for typed
  signature_font TEXT, -- font family for typed signatures
  ip_address TEXT,
  user_agent TEXT,
  signed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  portal_token_id UUID REFERENCES client_portal_tokens(id)
);

-- Create client comments table
CREATE TABLE public.client_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  estimate_id UUID REFERENCES estimates(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  portal_token_id UUID REFERENCES client_portal_tokens(id),
  commenter_name TEXT NOT NULL,
  commenter_email TEXT,
  comment_text TEXT NOT NULL,
  parent_comment_id UUID REFERENCES client_comments(id),
  is_internal BOOLEAN DEFAULT false, -- staff-only comments
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES profiles(id), -- null for client comments
  CONSTRAINT check_estimate_or_project_comment CHECK (estimate_id IS NOT NULL OR project_id IS NOT NULL)
);

-- Create portal view logs
CREATE TABLE public.portal_view_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  portal_token_id UUID NOT NULL REFERENCES client_portal_tokens(id) ON DELETE CASCADE,
  estimate_id UUID REFERENCES estimates(id),
  project_id UUID REFERENCES projects(id),
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  page_viewed TEXT -- 'estimate', 'project', 'payments', etc.
);

-- Add portal-related fields to estimates
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS signed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS declined_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS decline_reason TEXT;

-- Enable RLS
ALTER TABLE client_portal_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_view_logs ENABLE ROW LEVEL SECURITY;

-- RLS for client_portal_tokens
CREATE POLICY "Admin or contract_manager can manage tokens"
  ON client_portal_tokens FOR ALL
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'contract_manager'))
  WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'contract_manager'));

CREATE POLICY "Public can read tokens by token value"
  ON client_portal_tokens FOR SELECT
  USING (true); -- Token validation handled in application

-- RLS for estimate_signatures
CREATE POLICY "Admin or contract_manager can read signatures"
  ON estimate_signatures FOR SELECT
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'contract_manager'));

CREATE POLICY "Anyone can insert signatures"
  ON estimate_signatures FOR INSERT
  WITH CHECK (true); -- Client portal creates signatures

-- RLS for client_comments
CREATE POLICY "Admin or contract_manager can manage comments"
  ON client_comments FOR ALL
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'contract_manager'))
  WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'contract_manager'));

CREATE POLICY "Public can insert client comments"
  ON client_comments FOR INSERT
  WITH CHECK (is_internal = false);

CREATE POLICY "Public can read non-internal comments"
  ON client_comments FOR SELECT
  USING (is_internal = false OR is_admin(auth.uid()) OR has_role(auth.uid(), 'contract_manager'));

-- RLS for portal_view_logs
CREATE POLICY "Admin or contract_manager can read view logs"
  ON portal_view_logs FOR SELECT
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'contract_manager'));

CREATE POLICY "Public can insert view logs"
  ON portal_view_logs FOR INSERT
  WITH CHECK (true);

-- Create indexes
CREATE INDEX idx_portal_tokens_token ON client_portal_tokens(token);
CREATE INDEX idx_portal_tokens_estimate ON client_portal_tokens(estimate_id);
CREATE INDEX idx_portal_tokens_project ON client_portal_tokens(project_id);
CREATE INDEX idx_signatures_estimate ON estimate_signatures(estimate_id);
CREATE INDEX idx_comments_estimate ON client_comments(estimate_id);
CREATE INDEX idx_comments_project ON client_comments(project_id);

-- Update trigger for client_comments
CREATE TRIGGER update_client_comments_updated_at
  BEFORE UPDATE ON client_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();