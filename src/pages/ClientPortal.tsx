import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PortalEstimateView } from '@/components/portal/PortalEstimateView';
import { ProjectPortal } from '@/components/portal/ProjectPortal';
import { PortalPasscodeGate } from '@/components/portal/PortalPasscodeGate';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, Loader2 } from 'lucide-react';

// Set portal-specific browser tab title
const usePortalTitle = (companyName?: string) => {
  useEffect(() => {
    const originalTitle = document.title;
    document.title = companyName
      ? `${companyName} Customer Portal`
      : 'Customer Portal';
    return () => {
      document.title = originalTitle;
    };
  }, [companyName]);
};

export default function ClientPortal() {
  const [searchParams] = useSearchParams();
  const { token: pathToken } = useParams<{ token?: string }>();
  const [isPasscodeVerified, setIsPasscodeVerified] = useState(false);
  
  // Support both path-based (/portal/{token}) and query-based (/portal?token=xxx) URLs
  const token = pathToken || searchParams.get('token');
  const estimateToken = searchParams.get('estimate_token');

  // Derive company_id from whichever token resolves first (used below)
  const { data: estimateTokenData, isLoading: isLoadingEstimateToken, error: estimateTokenError } = useQuery({
    queryKey: ['estimate-portal-token', estimateToken],
    queryFn: async () => {
      if (!estimateToken) return null;
      const { data, error } = await supabase
        .from('estimate_portal_tokens')
        .select('*, estimate_signers(*)')
        .eq('token', estimateToken)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!estimateToken,
    staleTime: 10 * 60 * 1000, // 10 minutes - portal data is relatively static
    gcTime: 60 * 60 * 1000, // 1 hour
  });

  // Handle legacy client portal token using secure RPC function
  const { data: tokenData, isLoading: isLoadingToken, error: tokenError } = useQuery({
    queryKey: ['portal-token-type', token],
    queryFn: async () => {
      if (!token) return null;
      const { data, error } = await supabase
        .rpc('validate_portal_token', { p_token: token })
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!token && !estimateToken,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  });

  // Fetch project data for passcode verification (only for project portals)
  const { data: projectData, isLoading: isLoadingProject } = useQuery({
    queryKey: ['portal-project-passcode', tokenData?.project_id],
    queryFn: async () => {
      if (!tokenData?.project_id) return null;
      const { data: project } = await supabase
        .from('projects')
        .select('project_address, company_id')
        .eq('id', tokenData.project_id)
        .maybeSingle();
      
      if (!project) return null;

      // Fetch company branding for the gate
      const { data: companySettings } = await supabase
        .from('company_settings')
        .select('setting_key, setting_value')
        .eq('company_id', project.company_id)
        .in('setting_key', ['company_name', 'company_logo_url']);

      const settingsMap = (companySettings || []).reduce((acc: Record<string, string>, s: any) => {
        acc[s.setting_key] = s.setting_value;
        return acc;
      }, {});

      return {
        address: project.project_address,
        companyName: settingsMap.company_name,
        companyLogoUrl: settingsMap.company_logo_url,
      };
    },
    enabled: !!tokenData?.project_id && !isPasscodeVerified,
    staleTime: 10 * 60 * 1000,
  });

  // Resolve company_id from available token data
  const portalCompanyId = tokenData?.company_id || estimateTokenData?.company_id || null;

  // Fetch company name for browser tab title
  const { data: portalCompanyName } = useQuery({
    queryKey: ['portal-company-name', portalCompanyId],
    queryFn: async () => {
      if (!portalCompanyId) return null;
      // Try company_settings first
      const { data: settings } = await supabase
        .from('company_settings')
        .select('setting_value')
        .eq('company_id', portalCompanyId)
        .eq('setting_key', 'company_name')
        .maybeSingle();
      if (settings?.setting_value) return settings.setting_value;
      // Fallback to companies table
      const { data: company } = await supabase
        .from('companies')
        .select('name')
        .eq('id', portalCompanyId)
        .maybeSingle();
      return company?.name || null;
    },
    enabled: !!portalCompanyId,
    staleTime: 30 * 60 * 1000,
  });

  usePortalTitle(portalCompanyName || undefined);

  const handlePasscodeVerified = useCallback(() => {
    setIsPasscodeVerified(true);
  }, []);

  const isLoading = isLoadingEstimateToken || isLoadingToken || isLoadingProject;

  if (!token && !estimateToken) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-xl font-semibold">Invalid Link</h2>
            <p className="text-muted-foreground">
              This link is missing required information. Please check your email for the correct link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Handle multi-signer estimate token
  if (estimateToken) {
    if (estimateTokenError || !estimateTokenData) {
      return (
        <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
              <h2 className="text-xl font-semibold">Access Error</h2>
              <p className="text-muted-foreground">Invalid or expired link.</p>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Show estimate view with signer-specific token (no passcode for estimate signing)
    return (
      <PortalEstimateView 
        token={estimateToken} 
        isMultiSigner={true}
        signerId={estimateTokenData.signer_id}
        signerData={estimateTokenData.estimate_signers}
      />
    );
  }

  // Handle legacy token
  if (tokenError || !tokenData) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-xl font-semibold">Access Error</h2>
            <p className="text-muted-foreground">Invalid or expired link.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If project_id exists, show full project portal (with passcode gate)
  if (tokenData.project_id) {
    // Show passcode gate if not verified
    if (!isPasscodeVerified && projectData) {
      return (
        <PortalPasscodeGate
          projectAddress={projectData.address}
          token={token!}
          companyName={projectData.companyName}
          companyLogoUrl={projectData.companyLogoUrl}
          onVerified={handlePasscodeVerified}
        />
      );
    }
    
    return <ProjectPortal token={token!} />;
  }

  // Otherwise, show estimate-only view (legacy single signer - no passcode needed)
  return <PortalEstimateView token={token!} />;
}
