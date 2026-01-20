import { useState, useMemo } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, CalendarClock, ArrowUpDown, ArrowUp, ArrowDown, ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { DuplicateOpportunitiesCleanup } from "./DuplicateOpportunitiesCleanup";
import { findContactByIdOrGhlId, findUserByIdOrGhlId } from "@/lib/utils";

interface Opportunity {
  id: string;
  ghl_id: string;
  name: string | null;
  status: string | null;
  stage_name: string | null;
  pipeline_id: string | null;
  pipeline_name: string | null;
  pipeline_stage_id: string | null;
  monetary_value: number | null;
  contact_id: string | null;
  ghl_date_added?: string | null;
}

interface Contact {
  id: string;
  ghl_id: string;
  contact_name: string | null;
  first_name: string | null;
  last_name: string | null;
}

interface Appointment {
  id: string;
  ghl_id: string;
  title: string | null;
  contact_id: string | null;
  start_time: string | null;
  end_time: string | null;
  appointment_status: string | null;
  assigned_user_id: string | null;
}

interface GHLUser {
  id?: string;
  ghl_id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
}

interface AdminCleanupProps {
  opportunities: Opportunity[];
  contacts: Contact[];
  appointments: Appointment[];
  users: GHLUser[];
  onDataUpdated: () => void;
  onOpenOpportunity: (opportunity: Opportunity) => void;
}

type SortColumn = 'appointment' | 'contact' | 'stage' | 'date';
type SortDirection = 'asc' | 'desc';

const APPOINTMENT_OUTCOME_STAGES = [
  { value: 'Appointment Follow up', label: 'Appointment Follow up' },
  { value: 'Second Appointment', label: 'Second Appointment' },
  { value: 'Sold', label: 'Sold' },
  { value: 'Rehash', label: 'Rehash' },
  { value: 'Lost/DNC', label: 'Lost/DNC' },
  { value: 'PNS', label: 'PNS (Price Not Sold)' },
];

const OPP_STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
  { value: 'abandoned', label: 'Abandoned' },
];

export function AdminCleanup({ opportunities, contacts, appointments, users, onDataUpdated, onOpenOpportunity }: AdminCleanupProps) {
  const { user } = useAuth();
  const [updatingOppIds, setUpdatingOppIds] = useState<Set<string>>(new Set());
  const [updatingApptIds, setUpdatingApptIds] = useState<Set<string>>(new Set());
  const [selectedStages, setSelectedStages] = useState<Record<string, string>>({});
  const [selectedApptStatuses, setSelectedApptStatuses] = useState<Record<string, 'showed' | 'no_show'>>({});
  const [sortColumn, setSortColumn] = useState<SortColumn>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [inconsistentOppStages, setInconsistentOppStages] = useState<Record<string, string>>({});
  const [inconsistentOppStatuses, setInconsistentOppStatuses] = useState<Record<string, string>>({});

  const inconsistentOpportunities = useMemo(() => {
    const lostStages = ['lost', 'dnc', 'do not call', 'abandoned'];
    
    return opportunities.filter(opp => {
      const stageLower = (opp.stage_name || '').toLowerCase();
      const statusLower = (opp.status || '').toLowerCase();
      
      // Case 1: Stage is lost/dnc but status is still open
      const stageIsLostButStatusOpen = lostStages.some(stage => stageLower.includes(stage)) && statusLower === 'open';
      
      // Case 2: Status is lost but stage is NOT lost/dnc
      const statusIsLostButStageNot = statusLower === 'lost' && !lostStages.some(stage => stageLower.includes(stage));
      
      return stageIsLostButStatusOpen || statusIsLostButStageNot;
    });
  }, [opportunities]);

  const pastConfirmedAppointments = useMemo(() => {
    const now = new Date();
    return appointments.filter(apt => {
      const endTime = apt.end_time ? new Date(apt.end_time) : null;
      const statusLower = (apt.appointment_status || '').toLowerCase();
      return endTime && endTime < now && (statusLower === 'confirmed' || statusLower === 'new');
    });
  }, [appointments]);

  const getContactName = (contactId: string | null) => {
    if (!contactId) return 'Unknown';
    const contact = findContactByIdOrGhlId(contacts, undefined, contactId);
    if (!contact) return 'Unknown';
    return contact.contact_name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unknown';
  };

  const getUserName = (userId: string | null) => {
    if (!userId) return 'Unassigned';
    const user = findUserByIdOrGhlId(users, undefined, userId);
    if (!user) return 'Unknown';
    return user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unknown';
  };

  const getRelatedOpportunity = (contactId: string | null) => {
    if (!contactId) return null;
    return opportunities.find(opp => opp.contact_id === contactId);
  };

  const uniqueStages = useMemo(() => {
    const stages = new Set<string>();
    pastConfirmedAppointments.forEach(apt => {
      const opp = opportunities.find(o => o.contact_id === apt.contact_id);
      if (opp?.stage_name) stages.add(opp.stage_name);
    });
    return Array.from(stages).sort();
  }, [pastConfirmedAppointments, opportunities]);

  const filteredSortedAppointments = useMemo(() => {
    let filtered = [...pastConfirmedAppointments];
    
    if (stageFilter !== 'all') {
      filtered = filtered.filter(apt => {
        const opp = opportunities.find(o => o.contact_id === apt.contact_id);
        return opp?.stage_name === stageFilter;
      });
    }
    
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortColumn) {
        case 'appointment':
          comparison = (a.title || '').localeCompare(b.title || '');
          break;
        case 'contact':
          comparison = getContactName(a.contact_id).localeCompare(getContactName(b.contact_id));
          break;
        case 'stage':
          const stageA = opportunities.find(o => o.contact_id === a.contact_id)?.stage_name || '';
          const stageB = opportunities.find(o => o.contact_id === b.contact_id)?.stage_name || '';
          comparison = stageA.localeCompare(stageB);
          break;
        case 'date':
          comparison = new Date(a.start_time || 0).getTime() - new Date(b.start_time || 0).getTime();
          break;
      }
      return sortDirection === 'desc' ? -comparison : comparison;
    });
    
    return filtered;
  }, [pastConfirmedAppointments, stageFilter, sortColumn, sortDirection, opportunities]);

  const getStageIdForPipeline = (pipelineId: string | null, stageName: string): string | null => {
    if (!pipelineId) return null;
    const matchingOpp = opportunities.find(
      opp => opp.pipeline_id === pipelineId && opp.stage_name === stageName
    );
    return matchingOpp?.pipeline_stage_id || null;
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-3 w-3 ml-1" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-3 w-3 ml-1" /> 
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const handleRowClick = (apt: Appointment, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, select, [role="combobox"]')) return;
    const relatedOpp = getRelatedOpportunity(apt.contact_id);
    if (relatedOpp) {
      onOpenOpportunity(relatedOpp);
    } else {
      toast.error("No opportunity found for this contact");
    }
  };

  const handleUpdateOpportunityStatus = async (opportunity: Opportunity, newStatus: string, newStage?: string) => {
    setUpdatingOppIds(prev => new Set(prev).add(opportunity.id));
    try {
      const updatePayload: any = { ghl_id: opportunity.ghl_id, status: newStatus };
      const dbUpdate: any = { status: newStatus };
      
      if (newStage) {
        const pipelineStageId = getStageIdForPipeline(opportunity.pipeline_id, newStage);
        updatePayload.stage_name = newStage;
        updatePayload.pipeline_stage_id = pipelineStageId;
        dbUpdate.stage_name = newStage;
        dbUpdate.pipeline_stage_id = pipelineStageId;
      }
      updatePayload.edited_by = user?.id || null;
      
      const { error } = await supabase.functions.invoke('update-ghl-opportunity', { body: updatePayload });
      if (error) throw error;
      
      const { error: dbError } = await supabase
        .from('opportunities')
        .update(dbUpdate)
        .eq('id', opportunity.id);
      if (dbError) throw dbError;
      
      toast.success(`Updated "${opportunity.name}"`);
      
      // Clear selections
      setInconsistentOppStages(prev => { const next = { ...prev }; delete next[opportunity.id]; return next; });
      setInconsistentOppStatuses(prev => { const next = { ...prev }; delete next[opportunity.id]; return next; });
      
      onDataUpdated();
    } catch (err) {
      toast.error(`Failed to update: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setUpdatingOppIds(prev => {
        const next = new Set(prev);
        next.delete(opportunity.id);
        return next;
      });
    }
  };

  const handleUpdateAppointmentWithOpportunity = async (
    appointment: Appointment, 
    newApptStatus: 'showed' | 'no_show',
    newOppStage?: string
  ) => {
    setUpdatingApptIds(prev => new Set(prev).add(appointment.id));
    try {
      await supabase.functions.invoke('update-ghl-appointment', {
        body: { ghl_id: appointment.ghl_id, appointment_status: newApptStatus }
      });

      const { error: apptError } = await supabase
        .from('appointments')
        .update({ appointment_status: newApptStatus })
        .eq('id', appointment.id);
      if (apptError) throw apptError;

      if (newOppStage) {
        const relatedOpp = getRelatedOpportunity(appointment.contact_id);
        if (relatedOpp) {
          let newOppStatus = 'open';
          const stageLower = newOppStage.toLowerCase();
          if (stageLower.includes('sold')) newOppStatus = 'won';
          else if (stageLower.includes('lost') || stageLower.includes('dnc')) newOppStatus = 'lost';

          const pipelineStageId = getStageIdForPipeline(relatedOpp.pipeline_id, newOppStage);

          await supabase.functions.invoke('update-ghl-opportunity', {
            body: { 
              ghl_id: relatedOpp.ghl_id,
              status: newOppStatus,
              stage_name: newOppStage,
              pipeline_stage_id: pipelineStageId,
              edited_by: user?.id || null,
            }
          });

          await supabase
            .from('opportunities')
            .update({ stage_name: newOppStage, status: newOppStatus, pipeline_stage_id: pipelineStageId })
            .eq('id', relatedOpp.id);

          toast.success(`Updated appointment to "${newApptStatus}" and opportunity stage to "${newOppStage}"`);
        } else {
          toast.success(`Updated appointment to "${newApptStatus}" (no related opportunity)`);
        }
      } else {
        toast.success(`Updated "${appointment.title}" to ${newApptStatus}`);
      }

      setSelectedStages(prev => { const next = { ...prev }; delete next[appointment.id]; return next; });
      setSelectedApptStatuses(prev => { const next = { ...prev }; delete next[appointment.id]; return next; });
      onDataUpdated();
    } catch (err) {
      toast.error(`Failed to update: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setUpdatingApptIds(prev => {
        const next = new Set(prev);
        next.delete(appointment.id);
        return next;
      });
    }
  };

  const handleBulkUpdateOpportunities = async () => {
    const toUpdate = inconsistentOpportunities.filter(opp => !updatingOppIds.has(opp.id));
    if (toUpdate.length === 0) { toast.info('No opportunities to update'); return; }
    toast.info(`Updating ${toUpdate.length} opportunities...`);
    let successCount = 0, failCount = 0;

    for (const opp of toUpdate) {
      const stageLower = (opp.stage_name || '').toLowerCase();
      const newStatus = stageLower.includes('lost') ? 'lost' : 'abandoned';
      setUpdatingOppIds(prev => new Set(prev).add(opp.id));
      try {
        const { error } = await supabase.functions.invoke('update-ghl-opportunity', {
          body: { ghl_id: opp.ghl_id, status: newStatus, edited_by: user?.id || null }
        });
        if (!error) {
          await supabase.from('opportunities').update({ status: newStatus }).eq('id', opp.id);
          successCount++;
        } else { failCount++; }
      } catch { failCount++; }
      finally {
        setUpdatingOppIds(prev => { const next = new Set(prev); next.delete(opp.id); return next; });
      }
    }
    if (successCount > 0) { toast.success(`Updated ${successCount} opportunities`); onDataUpdated(); }
    if (failCount > 0) toast.error(`Failed to update ${failCount} opportunities`);
  };

  const handleBulkUpdateAppointments = async () => {
    const toUpdate = filteredSortedAppointments.filter(apt => !updatingApptIds.has(apt.id));
    if (toUpdate.length === 0) { toast.info('No appointments to update'); return; }
    toast.info(`Updating ${toUpdate.length} appointments...`);
    let successCount = 0, failCount = 0;

    for (const apt of toUpdate) {
      setUpdatingApptIds(prev => new Set(prev).add(apt.id));
      try {
        await supabase.functions.invoke('update-ghl-appointment', {
          body: { ghl_id: apt.ghl_id, appointment_status: 'showed' }
        });
        const { error: dbError } = await supabase
          .from('appointments')
          .update({ appointment_status: 'showed' })
          .eq('id', apt.id);
        if (!dbError) successCount++; else failCount++;
      } catch { failCount++; }
      finally {
        setUpdatingApptIds(prev => { const next = new Set(prev); next.delete(apt.id); return next; });
      }
    }
    if (successCount > 0) { toast.success(`Updated ${successCount} appointments to "showed"`); onDataUpdated(); }
    if (failCount > 0) toast.error(`Failed to update ${failCount} appointments`);
  };

  const handleConfirmUpdate = (appointment: Appointment) => {
    const selectedStatus = selectedApptStatuses[appointment.id];
    const selectedStage = selectedStages[appointment.id];
    if (!selectedStatus) { toast.error('Please select an appointment outcome'); return; }
    handleUpdateAppointmentWithOpportunity(
      appointment,
      selectedStatus,
      selectedStage && selectedStage !== 'none' ? selectedStage : undefined
    );
  };

  return (
    <div className="space-y-6">
      {/* Duplicate Opportunities */}
      <DuplicateOpportunitiesCleanup
        opportunities={opportunities}
        contacts={contacts}
        onDataUpdated={onDataUpdated}
        onOpenOpportunity={onOpenOpportunity}
      />

      {/* Inconsistent Status/Stage */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <div>
                <CardTitle className="text-lg">Inconsistent Status/Stage</CardTitle>
                <CardDescription>
                  Opportunities where status and stage don't match (e.g., Lost stage with Open status, or Lost status without Lost stage)
                </CardDescription>
              </div>
            </div>
            {inconsistentOpportunities.length > 0 && (
              <Button size="sm" onClick={handleBulkUpdateOpportunities} disabled={updatingOppIds.size > 0}>
                <RefreshCw className={`h-4 w-4 mr-2 ${updatingOppIds.size > 0 ? 'animate-spin' : ''}`} />
                Fix All ({inconsistentOpportunities.length})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {inconsistentOpportunities.length === 0 ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span>No inconsistent opportunities found</span>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Opportunity</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Pipeline</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inconsistentOpportunities.map((opp) => {
                    const stageLower = (opp.stage_name || '').toLowerCase();
                    const statusLower = (opp.status || '').toLowerCase();
                    const lostStages = ['lost', 'dnc', 'do not call', 'abandoned'];
                    const stageIsLost = lostStages.some(stage => stageLower.includes(stage));
                    const isUpdating = updatingOppIds.has(opp.id);
                    
                    const selectedStage = inconsistentOppStages[opp.id] || opp.stage_name || '';
                    const selectedStatus = inconsistentOppStatuses[opp.id] || opp.status || '';
                    const hasChanges = selectedStage !== (opp.stage_name || '') || selectedStatus !== (opp.status || '');
                    
                    return (
                      <TableRow 
                        key={opp.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest('button, select, [role="combobox"]')) return;
                          onOpenOpportunity(opp);
                        }}
                      >
                        <TableCell className="font-medium max-w-[200px]">
                          <div className="flex items-center gap-2">
                            <span className="truncate">{opp.name || 'Unnamed'}</span>
                            <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                          </div>
                        </TableCell>
                        <TableCell>{getContactName(opp.contact_id)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{opp.pipeline_name || '-'}</TableCell>
                        <TableCell>
                          <Select 
                            value={selectedStage} 
                            onValueChange={(value) => setInconsistentOppStages(prev => ({ ...prev, [opp.id]: value }))}
                          >
                            <SelectTrigger className={`w-[140px] h-8 text-xs ${stageIsLost ? 'border-destructive' : ''}`}>
                              <SelectValue placeholder="Select stage..." />
                            </SelectTrigger>
                            <SelectContent>
                              {APPOINTMENT_OUTCOME_STAGES.map(stage => (
                                <SelectItem key={stage.value} value={stage.value} className="text-xs">{stage.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select 
                            value={selectedStatus} 
                            onValueChange={(value) => setInconsistentOppStatuses(prev => ({ ...prev, [opp.id]: value }))}
                          >
                            <SelectTrigger className={`w-[110px] h-8 text-xs ${statusLower === 'lost' && !stageIsLost ? 'border-destructive' : ''}`}>
                              <SelectValue placeholder="Status..." />
                            </SelectTrigger>
                            <SelectContent>
                              {OPP_STATUS_OPTIONS.map(status => (
                                <SelectItem key={status.value} value={status.value} className="text-xs">{status.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>{opp.monetary_value ? `$${opp.monetary_value.toLocaleString()}` : '-'}</TableCell>
                        <TableCell className="text-right">
                          <Button 
                            size="sm" 
                            variant={hasChanges ? "default" : "secondary"}
                            onClick={() => handleUpdateOpportunityStatus(
                              opp, 
                              selectedStatus,
                              selectedStage !== opp.stage_name ? selectedStage : undefined
                            )} 
                            disabled={isUpdating || !hasChanges}
                          >
                            {isUpdating ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'Update'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Past Appointments Still Confirmed */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <CalendarClock className="h-5 w-5 text-amber-500" />
              <div>
                <CardTitle className="text-lg">Past Appointments Still Confirmed</CardTitle>
                <CardDescription>Click row to view opportunity details</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger className="w-[180px] h-8 text-xs">
                  <SelectValue placeholder="Filter by stage..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Stages</SelectItem>
                  {uniqueStages.map(stage => (
                    <SelectItem key={stage} value={stage} className="text-xs">{stage}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {filteredSortedAppointments.length > 0 && (
                <Button size="sm" onClick={handleBulkUpdateAppointments} disabled={updatingApptIds.size > 0}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${updatingApptIds.size > 0 ? 'animate-spin' : ''}`} />
                  Set All to "Showed" ({filteredSortedAppointments.length})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredSortedAppointments.length === 0 ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span>{stageFilter === 'all' ? 'No past appointments with incorrect status' : 'No appointments match the filter'}</span>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('appointment')}>
                      <div className="flex items-center">Appointment<SortIcon column="appointment" /></div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('contact')}>
                      <div className="flex items-center">Contact<SortIcon column="contact" /></div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('stage')}>
                      <div className="flex items-center">Current Opp Stage<SortIcon column="stage" /></div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('date')}>
                      <div className="flex items-center">Date/Time<SortIcon column="date" /></div>
                    </TableHead>
                    <TableHead>Appt Outcome</TableHead>
                    <TableHead>New Opp Stage</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSortedAppointments.slice(0, 50).map((apt) => {
                    const isUpdating = updatingApptIds.has(apt.id);
                    const relatedOpp = getRelatedOpportunity(apt.contact_id);
                    const selectedStage = selectedStages[apt.id] || '';
                    const selectedStatus = selectedApptStatuses[apt.id] || '';
                    return (
                      <TableRow key={apt.id} className="cursor-pointer hover:bg-muted/50" onClick={(e) => handleRowClick(apt, e)}>
                        <TableCell className="font-medium max-w-[180px] min-w-[120px]">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <div className="overflow-hidden flex-1 min-w-0">
                              <div className="truncate">{apt.title || 'Untitled'}</div>
                              <div className="text-xs text-muted-foreground truncate">{getUserName(apt.assigned_user_id)}</div>
                            </div>
                            <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                          </div>
                        </TableCell>
                        <TableCell>{getContactName(apt.contact_id)}</TableCell>
                        <TableCell>
                          {relatedOpp ? (
                            <Badge variant="outline" className="text-xs">{relatedOpp.stage_name || 'No stage'}</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">No opportunity</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{formatDateTime(apt.start_time)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant={selectedStatus === 'showed' ? 'default' : 'outline'} className="h-7 text-xs px-2"
                              onClick={() => setSelectedApptStatuses(prev => ({ ...prev, [apt.id]: 'showed' }))}>Showed</Button>
                            <Button size="sm" variant={selectedStatus === 'no_show' ? 'default' : 'outline'} className="h-7 text-xs px-2"
                              onClick={() => setSelectedApptStatuses(prev => ({ ...prev, [apt.id]: 'no_show' }))}>No Show</Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select value={selectedStage} onValueChange={(value) => setSelectedStages(prev => ({ ...prev, [apt.id]: value }))}>
                            <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue placeholder="Select stage..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none" className="text-xs">No change</SelectItem>
                              {APPOINTMENT_OUTCOME_STAGES.map(stage => (
                                <SelectItem key={stage.value} value={stage.value} className="text-xs">{stage.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="secondary" onClick={() => handleConfirmUpdate(apt)} disabled={isUpdating || !selectedStatus}>
                            {isUpdating ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'Update'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {filteredSortedAppointments.length > 50 && (
                <div className="p-3 text-center text-sm text-muted-foreground border-t">
                  Showing 50 of {filteredSortedAppointments.length} appointments
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}