import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PortalEstimateView } from '@/components/portal/PortalEstimateView';
import { ProjectPortal } from '@/components/portal/ProjectPortal';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, Loader2 } from 'lucide-react';

// Set portal-specific browser tab title
const usePortalTitle = () => {
  useEffect(() => {
    const originalTitle = document.title;
    document.title = 'CA Pro Customer Portal';
    return () => {
      document.title = originalTitle;
    };
  }, []);
};

export default function ClientPortal() {
  usePortalTitle();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  // Check what type of portal this token is for
  const { data: tokenData, isLoading, error } = useQuery({
    queryKey: ['portal-token-type', token],
    queryFn: async () => {
      if (!token) return null;
      const { data, error } = await supabase
        .from('client_portal_tokens')
        .select('project_id, estimate_id')
        .eq('token', token)
        .eq('is_active', true)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!token,
  });

  if (!token) {
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

  if (error || !tokenData) {
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

  // If project_id exists, show full project portal
  if (tokenData.project_id) {
    return <ProjectPortal token={token} />;
  }

  // Otherwise, show estimate-only view
  return <PortalEstimateView token={token} />;
}
