import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Building, AlertCircle, Loader2, MapPin, Phone } from 'lucide-react';
import { PortalProjectInfo } from './tabs/PortalProjectInfo';
import { PortalProposals } from './tabs/PortalProposals';
import { PortalAgreement } from './tabs/PortalAgreement';
import { PortalInvoices } from './tabs/PortalInvoices';
import { PortalPhotos } from './tabs/PortalPhotos';
import { PortalChat } from './tabs/PortalChat';

interface ProjectPortalProps {
  token: string;
}

export function ProjectPortal({ token }: ProjectPortalProps) {
  const [activeTab, setActiveTab] = useState('project');

  // Fetch company settings
  const { data: companySettings } = useQuery({
    queryKey: ['portal-company-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['company_name', 'company_address', 'company_phone']);
      if (error) throw error;
      const settings: Record<string, string> = {};
      data?.forEach(s => {
        settings[s.setting_key] = s.setting_value || '';
      });
      return settings;
    },
  });

  // Fetch portal token and project data
  const { data: portalData, isLoading, error } = useQuery({
    queryKey: ['project-portal', token],
    queryFn: async () => {
      // Get the token
      const { data: tokenData, error: tokenError } = await supabase
        .from('client_portal_tokens')
        .select('*')
        .eq('token', token)
        .eq('is_active', true)
        .single();

      if (tokenError) throw new Error('Invalid or expired link');
      
      // Check if token has project_id
      if (!tokenData.project_id) {
        throw new Error('No project linked to this portal');
      }

      // Check expiration
      if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
        throw new Error('This link has expired');
      }

      // Get project
      const { data: project, error: projError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', tokenData.project_id)
        .single();

      if (projError) throw projError;

      // Get all estimates linked to this project
      const { data: estimates } = await supabase
        .from('estimates')
        .select(`
          *,
          estimate_signatures (*)
        `)
        .eq('project_id', tokenData.project_id)
        .order('created_at', { ascending: false });

      // Get project agreements
      const { data: agreements } = await supabase
        .from('project_agreements')
        .select('*')
        .eq('project_id', tokenData.project_id)
        .order('created_at', { ascending: false });

      // Get project documents (photos)
      const { data: documents } = await supabase
        .from('project_documents')
        .select('*')
        .eq('project_id', tokenData.project_id)
        .order('created_at', { ascending: false });

      // Get payment phases from accepted estimates
      const acceptedEstimate = estimates?.find(e => e.status === 'accepted');
      let paymentSchedule: any[] = [];
      if (acceptedEstimate) {
        const { data: schedule } = await supabase
          .from('estimate_payment_schedule')
          .select('*')
          .eq('estimate_id', acceptedEstimate.id)
          .order('sort_order');
        paymentSchedule = schedule || [];
      }

      // Log view
      await supabase.from('portal_view_logs').insert({
        portal_token_id: tokenData.id,
        project_id: project.id,
        page_viewed: 'project_portal',
      });

      // Update access count
      await supabase
        .from('client_portal_tokens')
        .update({
          last_accessed_at: new Date().toISOString(),
          access_count: (tokenData.access_count || 0) + 1,
        })
        .eq('id', tokenData.id);

      return {
        token: tokenData,
        project,
        estimates: estimates || [],
        agreements: agreements || [],
        documents: documents || [],
        paymentSchedule,
      };
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading your project portal...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-xl font-semibold">Access Error</h2>
            <p className="text-muted-foreground">{(error as Error).message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!portalData) return null;

  const { project, estimates, agreements, documents, paymentSchedule, token: tokenData } = portalData;

  // Find the accepted estimate for scope of work
  const acceptedEstimate = estimates.find(e => e.status === 'accepted');

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      {/* Header */}
      <div className="bg-background border-b sticky top-0 z-10">
        <div className="w-full max-w-4xl mx-auto px-3 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building className="h-6 w-6 text-primary" />
            <div>
              <span className="font-semibold text-lg">Project Portal</span>
              <p className="text-sm text-muted-foreground">
                {project.customer_first_name} {project.customer_last_name}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-mono text-sm text-muted-foreground">#{project.project_number}</p>
          </div>
        </div>
      </div>

      <div className="w-full max-w-4xl mx-auto px-3 sm:px-6 pt-6 pb-24 flex-1">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-3 sm:grid-cols-6 mb-6 h-auto">
            <TabsTrigger value="project" className="text-xs sm:text-sm py-2">Project</TabsTrigger>
            <TabsTrigger value="proposals" className="text-xs sm:text-sm py-2">Proposals</TabsTrigger>
            <TabsTrigger value="agreement" className="text-xs sm:text-sm py-2">Agreement</TabsTrigger>
            <TabsTrigger value="invoices" className="text-xs sm:text-sm py-2">Invoices</TabsTrigger>
            <TabsTrigger value="photos" className="text-xs sm:text-sm py-2">Photos</TabsTrigger>
            <TabsTrigger value="chat" className="text-xs sm:text-sm py-2">Chat</TabsTrigger>
          </TabsList>

          <TabsContent value="project">
            <PortalProjectInfo 
              project={project} 
              acceptedEstimate={acceptedEstimate}
              agreements={agreements}
            />
          </TabsContent>

          <TabsContent value="proposals">
            <PortalProposals 
              estimates={estimates}
              projectId={project.id}
              token={token}
            />
          </TabsContent>

          <TabsContent value="agreement">
            <PortalAgreement 
              agreements={agreements}
              acceptedEstimate={acceptedEstimate}
            />
          </TabsContent>

          <TabsContent value="invoices">
            <PortalInvoices 
              paymentSchedule={paymentSchedule}
              invoices={[]}
              projectId={project.id}
              project={project}
            />
          </TabsContent>

          <TabsContent value="photos">
            <PortalPhotos 
              documents={documents}
            />
          </TabsContent>

          <TabsContent value="chat">
            <PortalChat 
              projectId={project.id}
              tokenId={tokenData.id}
              customerName={`${project.customer_first_name || ''} ${project.customer_last_name || ''}`.trim() || 'Customer'}
              customerEmail={project.customer_email}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Footer with company info */}
      {companySettings?.company_name && (
        <footer className="border-t bg-background mt-auto">
          <div className="w-full max-w-4xl mx-auto px-3 sm:px-6 py-4">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{companySettings.company_name}</span>
              {companySettings.company_address && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {companySettings.company_address}
                </span>
              )}
              {companySettings.company_phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-4 w-4" />
                  {companySettings.company_phone}
                </span>
              )}
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
