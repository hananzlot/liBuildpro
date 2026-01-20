import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  AlertCircle, 
  MapPin, 
  Phone, 
  Globe, 
  Mail, 
  User, 
  Hash,
  FileText,
  Receipt,
  Camera,
  FolderOpen,
  MessageSquare,
  ClipboardList,
  CheckCircle2,
  Briefcase
} from 'lucide-react';
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
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('project');

  // Fetch company settings - will be populated after we get the project's company_id
  const [projectCompanyId, setProjectCompanyId] = useState<string | null>(null);

  const { data: companySettings } = useQuery({
    queryKey: ['portal-company-settings', projectCompanyId],
    queryFn: async () => {
      const settingKeys = ['company_name', 'company_address', 'company_phone', 'company_website', 'portal_upload_limit_mb', 'company_logo_url'];
      
      // Try company_settings first if we have projectCompanyId
      if (projectCompanyId) {
        const { data: companyData } = await supabase
          .from('company_settings')
          .select('setting_key, setting_value')
          .eq('company_id', projectCompanyId)
          .in('setting_key', settingKeys);
        
        if (companyData && companyData.length > 0) {
          const settings: Record<string, string> = {};
          companyData.forEach(s => {
            settings[s.setting_key] = s.setting_value || '';
          });
          return settings;
        }
      }
      
      // Fall back to app_settings
      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_key, setting_value')
        .in('setting_key', settingKeys);
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
      // Get the token using secure RPC function
      const { data: tokenData, error: tokenError } = await supabase
        .rpc('validate_portal_token', { p_token: token })
        .maybeSingle();

      if (tokenError) throw new Error('Invalid or expired link');
      if (!tokenData) throw new Error('Invalid or expired link');
      
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
        .maybeSingle();

      if (projError) throw projError;
      if (!project) throw new Error('Project not found');

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
        company_id: tokenData.company_id,
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

  // Update projectCompanyId when portal data loads
  useEffect(() => {
    if (portalData?.project?.company_id && !projectCompanyId) {
      setProjectCompanyId(portalData.project.company_id);
    }
  }, [portalData?.project?.company_id, projectCompanyId]);

  const uploadLimitMb = parseInt(companySettings?.portal_upload_limit_mb || '15', 10);

  // Premium Loading State
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="relative mx-auto w-20 h-20">
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-primary via-primary/50 to-transparent animate-spin" />
            <div className="absolute inset-2 rounded-full bg-slate-900" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Briefcase className="h-8 w-8 text-primary animate-pulse" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-white">Loading Your Portal</h2>
            <p className="text-slate-400 text-sm">Preparing your project details...</p>
          </div>
          <div className="w-48 mx-auto">
            <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-primary to-primary/50 rounded-full animate-[shimmer_1.5s_infinite]" 
                   style={{ width: '60%', animation: 'shimmer 1.5s infinite' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Premium Error State
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-2xl border-0 overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-destructive to-destructive/50" />
          <CardContent className="pt-10 pb-10 text-center space-y-6">
            <div className="w-20 h-20 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
              <AlertCircle className="h-10 w-10 text-destructive" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-slate-900">Access Error</h2>
              <p className="text-slate-500 max-w-sm mx-auto">{(error as Error).message}</p>
            </div>
            <div className="pt-4">
              <p className="text-xs text-slate-400">
                If you believe this is an error, please contact support.
              </p>
            </div>
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
  const customerInitials = `${project.customer_first_name?.charAt(0) || ''}${project.customer_last_name?.charAt(0) || ''}`.toUpperCase() || 'C';

  // Calculate project progress
  const getProjectProgress = () => {
    const status = project.project_status;
    const progressMap: Record<string, number> = {
      'Proposal': 10,
      'Pending': 20,
      'In Progress': 60,
      'Completed': 100,
      'Cancelled': 0,
    };
    return progressMap[status] || 15;
  };

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      'Proposal': 'bg-amber-500',
      'Pending': 'bg-blue-500',
      'In Progress': 'bg-primary',
      'Completed': 'bg-green-500',
      'Cancelled': 'bg-slate-400',
    };
    return colorMap[status] || 'bg-slate-400';
  };

  const tabs = [
    { value: 'project', label: 'Project', icon: ClipboardList },
    { value: 'proposals', label: 'Proposals', icon: FileText, badge: estimates.length },
    { value: 'agreement', label: 'Agreement', icon: CheckCircle2 },
    { value: 'invoices', label: 'Invoices', icon: Receipt },
    { value: 'photos', label: 'Photos', icon: Camera, badge: documents.filter(d => d.file_type?.startsWith('image/')).length },
    { value: 'documents', label: 'Docs', icon: FolderOpen },
    { value: 'chat', label: 'Chat', icon: MessageSquare },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex flex-col">
      {/* Premium Hero Header */}
      <header className="relative overflow-hidden">
        {/* Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-primary/90" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjAzIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-50" />
        
        <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Top Bar */}
          <div className="py-4 flex items-center justify-between border-b border-white/10">
            <div className="flex items-center gap-4">
              {companySettings?.company_logo_url && companySettings.company_logo_url.length > 0 ? (
                <div className="w-32 h-16 sm:w-40 sm:h-20 rounded-lg bg-white flex items-center justify-center shadow-xl overflow-hidden ring-2 ring-white/20">
                  <img 
                    src={companySettings.company_logo_url} 
                    alt={companySettings?.company_name || 'Company Logo'} 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              ) : (
                <div className="w-32 h-16 sm:w-40 sm:h-20 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center ring-2 ring-white/30 shadow-xl">
                  <span className="text-white font-bold text-2xl sm:text-3xl">
                    {companySettings?.company_name?.charAt(0) || 'C'}
                  </span>
                </div>
              )}
              <div>
                <h1 className="font-bold text-white text-xl sm:text-2xl tracking-tight">
                  {companySettings?.company_name || 'Customer Portal'}
                </h1>
                <p className="text-white/60 text-sm">Client Portal</p>
              </div>
            </div>
            
            {/* Customer Avatar */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right">
                <p className="text-white/60 text-xs">Welcome back</p>
                <p className="text-white font-medium text-sm">{customerName || 'Valued Customer'}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center ring-2 ring-white/20 shadow-lg">
                <span className="text-white font-bold text-sm">{customerInitials}</span>
              </div>
            </div>
          </div>
          
          {/* Project Hero Section - Compact with Status Card */}
          <div className="py-4 sm:py-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              {/* Left: Project Info */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className={`${getStatusColor(project.project_status || 'Proposal')} text-white border-0 px-2 py-0.5 text-xs`}>
                    {project.project_status || 'Proposal'}
                  </Badge>
                  <span className="text-white/60 text-sm font-mono">#{project.project_number}</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {estimates.length > 1 
                    ? `Multiple Proposals - ${[project.customer_first_name, project.customer_last_name].filter(Boolean).join(' ') || estimates[0]?.customer_name || 'Customer'}`
                    : (project.project_name || 'Your Project')
                  }
                </h2>
                {/* Show all estimate titles if multiple estimates exist */}
                {estimates.length > 1 && (
                  <div className="mt-1 space-y-0.5">
                    {estimates.map((est: any) => (
                      <p key={est.id} className="text-white/80 text-sm flex items-center gap-2">
                        <FileText className="h-3 w-3" />
                        {est.estimate_title}
                      </p>
                    ))}
                  </div>
                )}
                {project.project_address && (
                  <p className="text-white/70 flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4" />
                    {project.project_address}
                  </p>
                )}
              </div>
              
              {/* Right: Project Status Card - Compact */}
              <div className="bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-xl lg:max-w-[320px]">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    project.project_status === 'Completed' ? 'bg-green-100' :
                    project.project_status === 'In Progress' ? 'bg-primary/10' :
                    project.project_status === 'Pending' ? 'bg-blue-100' :
                    'bg-amber-100'
                  }`}>
                    {project.project_status === 'Completed' ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : project.project_status === 'In Progress' ? (
                      <Briefcase className="h-5 w-5 text-primary" />
                    ) : (
                      <FileText className="h-5 w-5 text-amber-600" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Project Status</h3>
                    <span className={`text-xs font-medium ${
                      project.project_status === 'Completed' ? 'text-green-600' :
                      project.project_status === 'In Progress' ? 'text-primary' :
                      project.project_status === 'Pending' ? 'text-blue-600' :
                      'text-amber-600'
                    }`}>
                      {project.project_status || 'Proposal'}
                    </span>
                  </div>
                </div>
                
                {/* Compact Timeline Stepper */}
                <div className="relative">
                  <div className="hidden sm:block absolute top-3 left-4 right-4 h-0.5 bg-slate-200" />
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { label: 'Proposal', step: 1, completed: true, date: project.created_at },
                      { label: 'Agreement Signed', step: 2, completed: agreements.length > 0 || !!project.agreement_signed_date, date: project.agreement_signed_date },
                      { label: 'In Progress', step: 3, completed: project.project_status === 'In Progress' || project.project_status === 'Completed' },
                      { label: 'Completed', step: 4, completed: project.project_status === 'Completed' },
                    ].map((item, index) => (
                      <div key={index} className="relative flex flex-col items-center text-center">
                        <div className={`
                          relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300
                          ${item.completed 
                            ? 'bg-gradient-to-br from-primary to-primary/80 text-white shadow-sm' 
                            : 'bg-slate-100 text-slate-400 border border-slate-200'}
                        `}>
                          {item.completed ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : (
                            <span>{item.step}</span>
                          )}
                        </div>
                        <p className={`mt-1 text-[9px] font-medium leading-tight ${item.completed ? 'text-slate-700' : 'text-slate-400'}`}>
                          {item.label}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Floating Tab Navigation */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm">
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full h-auto bg-transparent p-0 gap-0 justify-start overflow-x-auto scrollbar-hide">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="relative flex items-center gap-2 px-4 py-4 text-sm font-medium text-slate-500 border-b-2 border-transparent rounded-none data-[state=active]:text-primary data-[state=active]:border-primary data-[state=active]:bg-transparent transition-all duration-200 hover:text-slate-700"
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                    {tab.badge && tab.badge > 0 && (
                      <span className="ml-1 min-w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                        {tab.badge}
                      </span>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsContent value="project" className="mt-0 animate-fade-in">
            <PortalProjectInfo 
              project={project} 
              acceptedEstimate={acceptedEstimate}
              agreements={agreements}
            />
          </TabsContent>

          <TabsContent value="proposals" className="mt-0 animate-fade-in">
            <PortalProposals 
              estimates={estimates}
              projectId={project.id}
              token={token}
              portalTokenId={portalData.token.id}
              onRefresh={() => queryClient.invalidateQueries({ queryKey: ['project-portal', token] })}
            />
          </TabsContent>

          <TabsContent value="agreement" className="mt-0 animate-fade-in">
            <PortalAgreement 
              agreements={agreements}
              acceptedEstimate={acceptedEstimate}
            />
          </TabsContent>

          <TabsContent value="invoices" className="mt-0 animate-fade-in">
            <PortalInvoices 
              paymentSchedule={paymentSchedule}
              invoices={[]}
              projectId={project.id}
              project={project}
            />
          </TabsContent>

          <TabsContent value="photos" className="mt-0 animate-fade-in">
            <PortalPhotos 
              documents={documents}
              projectId={project.id}
              uploadLimitMb={uploadLimitMb}
            />
          </TabsContent>

          <TabsContent value="documents" className="mt-0 animate-fade-in">
            <PortalDocuments 
              documents={documents}
              agreements={agreements}
              projectId={project.id}
              uploadLimitMb={uploadLimitMb}
            />
          </TabsContent>

          <TabsContent value="chat" className="mt-0 animate-fade-in">
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
      <footer className="bg-slate-900 text-white mt-auto">
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Main Footer Content */}
          <div className="py-10 grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Company Info */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">
                    {companySettings?.company_name?.charAt(0) || 'C'}
                  </span>
                </div>
                <span className="font-bold text-lg">{companySettings?.company_name}</span>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed">
                Thank you for choosing us for your project. We're committed to delivering exceptional results.
              </p>
            </div>
            
            {/* Contact Info */}
            <div className="space-y-4">
              <h4 className="font-semibold text-white">Contact Us</h4>
              <div className="space-y-3">
                {companySettings?.company_address && (
                  <a 
                    href={`https://maps.google.com/?q=${encodeURIComponent(companySettings.company_address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-3 text-slate-400 hover:text-white transition-colors group"
                  >
                    <MapPin className="h-5 w-5 mt-0.5 text-primary group-hover:scale-110 transition-transform" />
                    <span className="text-sm">{companySettings.company_address}</span>
                  </a>
                )}
                {companySettings?.company_phone && (
                  <a 
                    href={`tel:${companySettings.company_phone.replace(/\D/g, '')}`}
                    className="flex items-center gap-3 text-slate-400 hover:text-white transition-colors group"
                  >
                    <Phone className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
                    <span className="text-sm">{companySettings.company_phone}</span>
                  </a>
                )}
              </div>
            </div>
            
            {/* Quick Links */}
            <div className="space-y-4">
              <h4 className="font-semibold text-white">Quick Links</h4>
              <div className="space-y-3">
                {companySettings?.company_website && (
                  <a 
                    href={companySettings.company_website.startsWith('http') ? companySettings.company_website : `https://${companySettings.company_website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 text-slate-400 hover:text-white transition-colors group"
                  >
                    <Globe className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
                    <span className="text-sm">Visit Our Website</span>
                  </a>
                )}
                <button 
                  onClick={() => setActiveTab('chat')}
                  className="flex items-center gap-3 text-slate-400 hover:text-white transition-colors group"
                >
                  <MessageSquare className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
                  <span className="text-sm">Send Us a Message</span>
                </button>
              </div>
            </div>
          </div>
          
          {/* Copyright Bar */}
          <div className="border-t border-slate-800 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-slate-500 text-sm">
              © {new Date().getFullYear()} {companySettings?.company_name || 'Company'}. All rights reserved.
            </p>
            <p className="text-slate-600 text-xs">
              Secure Customer Portal
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}