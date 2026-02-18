import React, { useState } from 'react';
import { formatUnit } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { 
  MapPin, 
  Phone, 
  Mail, 
  Calendar, 
  User, 
  ClipboardList,
  Building2,
  UserCircle,
  CheckCircle2,
  Clock,
  FileText,
  Sparkles,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { format } from 'date-fns';

interface PortalProjectInfoProps {
  project: any;
  acceptedEstimate?: any;
  agreements?: any[];
}

export function PortalProjectInfo({ project, acceptedEstimate, agreements = [] }: PortalProjectInfoProps) {
  // Fetch salespeople data to get phone numbers
  const { data: salespeople = [] } = useQuery({
    queryKey: ['portal-salespeople'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salespeople')
        .select('name, phone, email');
      if (error) throw error;
      return data || [];
    },
  });

  const getSalespersonPhone = (name: string | null) => {
    if (!name) return null;
    const person = salespeople.find(s => s.name.toLowerCase() === name.toLowerCase());
    return person?.phone || null;
  };

  const getStatusConfig = (status: string) => {
    const config: Record<string, { color: string; bgColor: string; icon: React.ReactNode }> = {
      'Proposal': { color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200', icon: <FileText className="h-4 w-4" /> },
      'Pending': { color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200', icon: <Clock className="h-4 w-4" /> },
      'In Progress': { color: 'text-primary', bgColor: 'bg-primary/5 border-primary/20', icon: <Sparkles className="h-4 w-4" /> },
      'Completed': { color: 'text-green-700', bgColor: 'bg-green-50 border-green-200', icon: <CheckCircle2 className="h-4 w-4" /> },
    };
    return config[status] || { color: 'text-slate-700', bgColor: 'bg-slate-50 border-slate-200', icon: null };
  };

  const statusConfig = getStatusConfig(project.project_status || 'Proposal');

  // Timeline steps
  const timelineSteps = [
    { 
      label: 'Proposal', 
      completed: true, 
      date: project.created_at ? format(new Date(project.created_at), 'MMM d, yyyy') : null,
      active: project.project_status === 'Proposal'
    },
    { 
      label: 'Agreement Signed', 
      completed: !!project.agreement_signed_date, 
      date: project.agreement_signed_date ? format(new Date(project.agreement_signed_date), 'MMM d, yyyy') : null,
      active: project.project_status === 'Pending'
    },
    { 
      label: 'In Progress', 
      completed: project.project_status === 'In Progress' || project.project_status === 'Completed',
      date: project.install_start_date ? format(new Date(project.install_start_date), 'MMM d, yyyy') : null,
      active: project.project_status === 'In Progress'
    },
    { 
      label: 'Completed', 
      completed: project.project_status === 'Completed',
      date: project.install_end_date ? format(new Date(project.install_end_date), 'MMM d, yyyy') : null,
      active: project.project_status === 'Completed'
    },
  ];

  return (
    <div className="space-y-6">

      {/* Customer & Project Details */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Customer Information */}
        <Card className="border-0 shadow-lg overflow-hidden group hover:shadow-xl transition-shadow duration-300">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                <User className="h-5 w-5 text-white" />
              </div>
              <h4 className="font-bold text-slate-900">Customer Information</h4>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14 ring-4 ring-slate-100">
                  <AvatarFallback className="bg-gradient-to-br from-slate-700 to-slate-800 text-white font-bold">
                    {project.customer_first_name?.charAt(0) || ''}{project.customer_last_name?.charAt(0) || ''}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-bold text-lg text-slate-900">
                    {project.customer_first_name} {project.customer_last_name}
                  </p>
                  <p className="text-sm text-slate-500">Project Owner</p>
                </div>
              </div>
              
              <div className="space-y-3 pt-2">
                {project.customer_email && (
                  <a href={`mailto:${project.customer_email}`} className="flex items-center gap-3 text-slate-600 hover:text-primary transition-colors group/link">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center group-hover/link:bg-primary/10 transition-colors">
                      <Mail className="h-4 w-4" />
                    </div>
                    <span className="text-sm">{project.customer_email}</span>
                  </a>
                )}
                {project.cell_phone && (
                  <a href={`tel:${project.cell_phone}`} className="flex items-center gap-3 text-slate-600 hover:text-primary transition-colors group/link">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center group-hover/link:bg-primary/10 transition-colors">
                      <Phone className="h-4 w-4" />
                    </div>
                    <span className="text-sm">{project.cell_phone}</span>
                  </a>
                )}
                {project.home_phone && (
                  <div className="flex items-center gap-3 text-slate-600">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                      <Phone className="h-4 w-4" />
                    </div>
                    <span className="text-sm">{project.home_phone} <span className="text-slate-400">(Home)</span></span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Project Details */}
        <Card className="border-0 shadow-lg overflow-hidden group hover:shadow-xl transition-shadow duration-300">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <h4 className="font-bold text-slate-900">Project Details</h4>
            </div>
            
            <div className="space-y-4">
              {project.project_address && (
                <a 
                  href={`https://maps.google.com/?q=${encodeURIComponent(project.project_address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 text-slate-600 hover:text-primary transition-colors group/link"
                >
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 group-hover/link:bg-primary/10 transition-colors">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <span className="text-sm pt-2">{project.project_address}</span>
                </a>
              )}
              
              <div className="grid grid-cols-2 gap-4 pt-2">
                {project.project_type && (
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Type</p>
                    <p className="font-semibold text-slate-900">{project.project_type}</p>
                  </div>
                )}
              </div>
              
              {/* Key Dates */}
              <div className="flex flex-wrap gap-3 pt-2">
                {project.agreement_signed_date && (
                  <div className="flex items-center gap-2 bg-green-50 text-green-700 px-3 py-2 rounded-lg">
                    <Calendar className="h-4 w-4" />
                    <span className="text-xs font-medium">Signed: {format(new Date(project.agreement_signed_date), 'MMM d, yyyy')}</span>
                  </div>
                )}
                {project.install_start_date && (
                  <div className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-2 rounded-lg">
                    <Calendar className="h-4 w-4" />
                    <span className="text-xs font-medium">Start: {format(new Date(project.install_start_date), 'MMM d, yyyy')}</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Your Team */}
      {(project.primary_salesperson || project.project_manager) && (
        <Card className="border-0 shadow-lg overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
                <UserCircle className="h-5 w-5 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900">Your Team</h4>
                <p className="text-sm text-slate-500">Your dedicated project contacts</p>
              </div>
            </div>
            
            <div className="grid sm:grid-cols-2 gap-4">
              {(() => {
                const salesperson = project.primary_salesperson;
                const manager = project.project_manager;
                const isSamePerson = salesperson && manager && salesperson.toLowerCase() === manager.toLowerCase();
                
                if (isSamePerson) {
                  const phone = getSalespersonPhone(salesperson);
                  return (
                    <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-5 border border-slate-200">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-14 w-14 ring-4 ring-white shadow-md">
                          <AvatarFallback className="bg-gradient-to-br from-purple-500 to-purple-600 text-white font-bold">
                            {salesperson.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-bold text-slate-900">{salesperson}</p>
                          <p className="text-sm text-slate-500">Salesperson & Project Manager</p>
                          {phone && (
                            <a href={`tel:${phone}`} className="inline-flex items-center gap-2 mt-2 text-primary hover:text-primary/80 transition-colors">
                              <Phone className="h-4 w-4" />
                              <span className="text-sm font-medium">{phone}</span>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }
                
                return (
                  <>
                    {salesperson && (
                      <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-5 border border-slate-200">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-14 w-14 ring-4 ring-white shadow-md">
                            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white font-bold">
                              {salesperson.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="font-bold text-slate-900">{salesperson}</p>
                            <p className="text-sm text-slate-500">Salesperson</p>
                            {getSalespersonPhone(salesperson) && (
                              <a href={`tel:${getSalespersonPhone(salesperson)}`} className="inline-flex items-center gap-2 mt-2 text-primary hover:text-primary/80 transition-colors">
                                <Phone className="h-4 w-4" />
                                <span className="text-sm font-medium">{getSalespersonPhone(salesperson)}</span>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    {manager && (
                      <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-5 border border-slate-200">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-14 w-14 ring-4 ring-white shadow-md">
                            <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white font-bold">
                              {manager.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="font-bold text-slate-900">{manager}</p>
                            <p className="text-sm text-slate-500">Project Manager</p>
                            {getSalespersonPhone(manager) && (
                              <a href={`tel:${getSalespersonPhone(manager)}`} className="inline-flex items-center gap-2 mt-2 text-primary hover:text-primary/80 transition-colors">
                                <Phone className="h-4 w-4" />
                                <span className="text-sm font-medium">{getSalespersonPhone(manager)}</span>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Description of Work from Agreements */}
      {agreements.length > 0 && agreements.some(a => a.description_of_work) && (
        <Card className="border-0 shadow-lg overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/25">
                <ClipboardList className="h-5 w-5 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900">Scope of Work</h4>
                <p className="text-sm text-slate-500">Details of the work being performed</p>
              </div>
            </div>
            
            <div className="space-y-4">
              {agreements
                .filter(a => a.description_of_work)
                .map((agreement: any) => (
                  <CollapsibleScopeBlock key={agreement.id} agreement={agreement} />
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Collapsible scope block for each agreement
function CollapsibleScopeBlock({ agreement }: { agreement: any }) {
  const [expanded, setExpanded] = useState(false);
  const text: string = agreement.description_of_work || '';
  // Estimate whether the text exceeds 4 lines (rough heuristic: > 300 chars or contains 4+ newlines)
  const lineCount = (text.match(/\n/g) || []).length;
  const needsCollapse = text.length > 300 || lineCount >= 4;

  return (
    <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
      {agreement.agreement_number && (
        <Badge variant="outline" className="mb-3">
          Agreement #{agreement.agreement_number}
        </Badge>
      )}
      <p
        className={`text-slate-700 whitespace-pre-wrap leading-relaxed transition-all${!expanded && needsCollapse ? ' line-clamp-4' : ''}`}
      >
        {text}
      </p>
      {needsCollapse && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(e => !e)}
          className="mt-2 h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
        >
          {expanded ? (
            <><ChevronUp className="h-3.5 w-3.5" /> Show less</>
          ) : (
            <><ChevronDown className="h-3.5 w-3.5" /> Show more</>
          )}
        </Button>
      )}
    </div>
  );
}

// Sub-component to fetch and display scope of work from estimate
function ScopeOfWorkDisplay({ estimateId }: { estimateId: string }) {
  const [groups, setGroups] = React.useState<any[]>([]);
  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchScope = async () => {
      const [groupsRes, itemsRes] = await Promise.all([
        import('@/integrations/supabase/client').then(({ supabase }) =>
          supabase.from('estimate_groups').select('*').eq('estimate_id', estimateId).order('sort_order')
        ),
        import('@/integrations/supabase/client').then(({ supabase }) =>
          supabase.from('estimate_line_items').select('*').eq('estimate_id', estimateId).order('sort_order')
        ),
      ]);
      setGroups(groupsRes.data || []);
      setItems(itemsRes.data || []);
      setLoading(false);
    };
    fetchScope();
  }, [estimateId]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading scope...</p>;
  }

  const groupedItems = groups.reduce((acc: Record<string, any[]>, group: any) => {
    acc[group.id] = items.filter((item: any) => item.group_id === group.id);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {groups.map((group: any) => (
        <div key={group.id} className="space-y-3">
          <h4 className="font-semibold text-lg">{group.group_name}</h4>
          {group.description && (
            <p className="text-sm text-muted-foreground">{group.description}</p>
          )}
          <div className="space-y-2">
            {groupedItems[group.id]?.map((item: any) => (
              <div
                key={item.id}
                className="flex justify-between items-start p-3 bg-muted/50 rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-medium">{item.description}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.quantity}{formatUnit(item.unit) ? ` ${formatUnit(item.unit)}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {groups.length === 0 && (
        <p className="text-sm text-muted-foreground">No scope details available.</p>
      )}
    </div>
  );
}