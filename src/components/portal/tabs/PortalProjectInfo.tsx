import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  MapPin, 
  Phone, 
  Mail, 
  Calendar, 
  User, 
  FileText,
  ClipboardList,
  Building2,
  UserCircle
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
  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      Proposal: { label: 'Proposal Stage', variant: 'secondary' },
      Pending: { label: 'Pending', variant: 'outline' },
      'In Progress': { label: 'In Progress', variant: 'default' },
      Completed: { label: 'Completed', variant: 'default' },
      Cancelled: { label: 'Cancelled', variant: 'destructive' },
    };
    const config = statusConfig[status] || { label: status, variant: 'outline' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Project Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Project #{project.project_number}</p>
              <CardTitle className="text-2xl mt-1">{project.project_name}</CardTitle>
            </div>
            {getStatusBadge(project.project_status || 'Proposal')}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Customer & Location Info */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
                <User className="h-4 w-4" />
                CUSTOMER INFORMATION
              </h4>
              <p className="font-medium text-lg">
                {project.customer_first_name} {project.customer_last_name}
              </p>
              {project.customer_email && (
                <p className="text-sm flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  {project.customer_email}
                </p>
              )}
              {project.cell_phone && (
                <p className="text-sm flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  {project.cell_phone}
                </p>
              )}
              {project.home_phone && (
                <p className="text-sm flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  {project.home_phone} (Home)
                </p>
              )}
            </div>
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                PROJECT DETAILS
              </h4>
              {project.project_address && (
                <p className="text-sm flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  {project.project_address}
                </p>
              )}
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                {project.project_type && (
                  <span className="text-muted-foreground">
                    <span className="font-medium text-foreground">Type:</span> {project.project_type}
                  </span>
                )}
                {project.lead_source && (
                  <span className="text-muted-foreground">
                    <span className="font-medium text-foreground">Source:</span> {project.lead_source}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                {project.agreement_signed_date && (
                  <span className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    Signed: {format(new Date(project.agreement_signed_date), 'MMM d, yyyy')}
                  </span>
                )}
                {project.install_start_date && (
                  <span className="flex items-center gap-2 text-primary">
                    <Calendar className="h-4 w-4" />
                    Install: {format(new Date(project.install_start_date), 'MMM d, yyyy')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Your Team - Salesperson & Project Manager */}
          {(project.primary_salesperson || project.project_manager) && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
                  <UserCircle className="h-4 w-4" />
                  YOUR TEAM
                </h4>
                <div className="grid sm:grid-cols-2 gap-4">
                  {(() => {
                    const salesperson = project.primary_salesperson;
                    const manager = project.project_manager;
                    const isSamePerson = salesperson && manager && salesperson.toLowerCase() === manager.toLowerCase();
                    
                    if (isSamePerson) {
                      // Same person - show once with combined role
                      const phone = getSalespersonPhone(salesperson);
                      return (
                        <div className="space-y-1">
                          <p className="font-medium">{salesperson}</p>
                          <p className="text-xs text-muted-foreground">Salesperson & Project Manager</p>
                          {phone && (
                            <p className="text-sm flex items-center gap-2 text-primary">
                              <Phone className="h-4 w-4" />
                              {phone}
                            </p>
                          )}
                        </div>
                      );
                    }
                    
                    // Different people - show both
                    return (
                      <>
                        {salesperson && (
                          <div className="space-y-1">
                            <p className="font-medium">{salesperson}</p>
                            <p className="text-xs text-muted-foreground">Salesperson</p>
                            {getSalespersonPhone(salesperson) && (
                              <p className="text-sm flex items-center gap-2 text-primary">
                                <Phone className="h-4 w-4" />
                                {getSalespersonPhone(salesperson)}
                              </p>
                            )}
                          </div>
                        )}
                        {manager && (
                          <div className="space-y-1">
                            <p className="font-medium">{manager}</p>
                            <p className="text-xs text-muted-foreground">Project Manager</p>
                            {getSalespersonPhone(manager) && (
                              <p className="text-sm flex items-center gap-2 text-primary">
                                <Phone className="h-4 w-4" />
                                {getSalespersonPhone(manager)}
                              </p>
                            )}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

    {/* Description of Work from Agreements */}
    {agreements.length > 0 && agreements.some(a => a.description_of_work) && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Description of Work
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {agreements
            .filter(a => a.description_of_work)
            .map((agreement: any) => (
              <div key={agreement.id} className="space-y-2">
                {agreement.agreement_number && (
                  <p className="text-sm font-medium text-muted-foreground">
                    Agreement #{agreement.agreement_number}
                  </p>
                )}
                <p className="text-sm whitespace-pre-wrap">{agreement.description_of_work}</p>
              </div>
            ))}
        </CardContent>
      </Card>
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
                    {item.quantity} {item.unit}
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
