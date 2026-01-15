import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, Loader2, MapPin, Phone, Globe, Mail, User, Hash } from 'lucide-react';
import { PortalProjectInfo } from './tabs/PortalProjectInfo';
import { PortalProposals } from './tabs/PortalProposals';
import { PortalAgreement } from './tabs/PortalAgreement';
import { PortalInvoices } from './tabs/PortalInvoices';
import { PortalPhotos } from './tabs/PortalPhotos';
import { PortalDocuments } from './tabs/PortalDocuments';
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
        .in('setting_key', ['company_name', 'company_address', 'company_phone', 'company_website', 'portal_upload_limit_mb']);
      if (error) throw error;
      const settings: Record<string, string> = {};
      data?.forEach(s => {
        settings[s.setting_key] = s.setting_value || '';
      });
      return settings;
    },
    staleTime: 1000 * 60 * 5,
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

  const uploadLimitMb = parseInt(companySettings?.portal_upload_limit_mb || '15', 10);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-primary/20 rounded-full"></div>
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
          </div>
          <p className="text-muted-foreground font-medium">Loading your project portal...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-xl border-0">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
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

  const customerName = `${project.customer_first_name || ''} ${project.customer_last_name || ''}`.trim();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex flex-col">
      {/* Premium Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-50 shadow-sm">
        <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4 sm:py-5 flex items-center justify-between">
            {/* Company Branding */}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/25">
                <span className="text-white font-bold text-lg">
                  {companySettings?.company_name?.charAt(0) || 'C'}
                </span>
              </div>
              <div>
                <h1 className="font-bold text-lg sm:text-xl text-slate-900 tracking-tight">
                  {companySettings?.company_name || 'Customer Portal'}
                </h1>
                <p className="text-sm text-slate-500">Project Portal</p>
              </div>
            </div>
            
            {/* Project Info Badge */}
            <div className="hidden sm:flex items-center gap-3 bg-slate-100 rounded-full px-4 py-2">
              <Hash className="h-4 w-4 text-slate-400" />
              <span className="font-mono text-sm font-medium text-slate-700">{project.project_number}</span>
            </div>
          </div>
          
          {/* Customer Welcome Bar */}
          <div className="pb-4 flex items-center gap-2 text-sm text-slate-600">
            <User className="h-4 w-4" />
            <span>Welcome, <span className="font-semibold text-slate-900">{customerName || 'Valued Customer'}</span></span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Premium Tab Navigation */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-1.5 mb-8">
            <TabsList className="w-full grid grid-cols-4 sm:grid-cols-7 bg-transparent gap-1 h-auto">
              {[
                { value: 'project', label: 'Project' },
                { value: 'proposals', label: 'Proposals' },
                { value: 'agreement', label: 'Agreement' },
                { value: 'invoices', label: 'Invoices' },
                { value: 'photos', label: 'Photos' },
                { value: 'documents', label: 'Docs' },
                { value: 'chat', label: 'Chat' },
              ].map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="text-xs sm:text-sm py-2.5 px-3 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-200 font-medium"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="project" className="mt-0">
            <PortalProjectInfo 
              project={project} 
              acceptedEstimate={acceptedEstimate}
              agreements={agreements}
            />
          </TabsContent>

          <TabsContent value="proposals" className="mt-0">
            <PortalProposals 
              estimates={estimates}
              projectId={project.id}
              token={token}
            />
          </TabsContent>

          <TabsContent value="agreement" className="mt-0">
            <PortalAgreement 
              agreements={agreements}
              acceptedEstimate={acceptedEstimate}
            />
          </TabsContent>

          <TabsContent value="invoices" className="mt-0">
            <PortalInvoices 
              paymentSchedule={paymentSchedule}
              invoices={[]}
              projectId={project.id}
              project={project}
            />
          </TabsContent>

          <TabsContent value="photos" className="mt-0">
            <PortalPhotos 
              documents={documents}
              projectId={project.id}
              uploadLimitMb={uploadLimitMb}
            />
          </TabsContent>

          <TabsContent value="documents" className="mt-0">
            <PortalDocuments 
              documents={documents}
              projectId={project.id}
              uploadLimitMb={uploadLimitMb}
            />
          </TabsContent>

          <TabsContent value="chat" className="mt-0">
            <PortalChat 
              projectId={project.id}
              tokenId={tokenData.id}
              customerName={customerName || 'Customer'}
              customerEmail={project.customer_email}
            />
          </TabsContent>
        </Tabs>
      </main>

      {/* Premium Footer */}
      <footer className="bg-white border-t border-slate-200/60 mt-auto">
        <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col items-center gap-4">
            {/* Company Name */}
            {companySettings?.company_name && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">
                    {companySettings.company_name.charAt(0)}
                  </span>
                </div>
                <span className="font-bold text-slate-900">{companySettings.company_name}</span>
              </div>
            )}
            
            {/* Contact Info */}
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-sm text-slate-600">
              {companySettings?.company_address && (
                <a 
                  href={`https://maps.google.com/?q=${encodeURIComponent(companySettings.company_address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 hover:text-primary transition-colors"
                >
                  <MapPin className="h-4 w-4" />
                  <span>{companySettings.company_address}</span>
                </a>
              )}
              {companySettings?.company_phone && (
                <a 
                  href={`tel:${companySettings.company_phone.replace(/\D/g, '')}`}
                  className="flex items-center gap-1.5 hover:text-primary transition-colors"
                >
                  <Phone className="h-4 w-4" />
                  <span>{companySettings.company_phone}</span>
                </a>
              )}
              {companySettings?.company_website && (
                <a 
                  href={companySettings.company_website.startsWith('http') ? companySettings.company_website : `https://${companySettings.company_website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 hover:text-primary transition-colors"
                >
                  <Globe className="h-4 w-4" />
                  <span>{companySettings.company_website.replace(/^https?:\/\//, '')}</span>
                </a>
              )}
            </div>
            
            {/* Copyright */}
            <p className="text-xs text-slate-400 mt-2">
              © {new Date().getFullYear()} {companySettings?.company_name || 'Company'}. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
