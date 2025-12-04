import { useState, useMemo } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, CalendarClock } from "lucide-react";
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

interface Opportunity {
  id: string;
  ghl_id: string;
  name: string | null;
  status: string | null;
  stage_name: string | null;
  pipeline_name: string | null;
  pipeline_stage_id: string | null;
  monetary_value: number | null;
  contact_id: string | null;
}

interface Contact {
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
}

// Common stages for appointment follow-up
const APPOINTMENT_OUTCOME_STAGES = [
  { value: 'Appointment Follow up', label: 'Appointment Follow up' },
  { value: 'Second Appointment', label: 'Second Appointment' },
  { value: 'Sold', label: 'Sold' },
  { value: 'Rehash', label: 'Rehash' },
  { value: 'Lost/DNC', label: 'Lost/DNC' },
  { value: 'PNS', label: 'PNS (Price Not Sold)' },
];

export function AdminCleanup({ opportunities, contacts, appointments, users, onDataUpdated }: AdminCleanupProps) {
  const [updatingOppIds, setUpdatingOppIds] = useState<Set<string>>(new Set());
  const [updatingApptIds, setUpdatingApptIds] = useState<Set<string>>(new Set());
  const [selectedStages, setSelectedStages] = useState<Record<string, string>>({});

  // Find opportunities with inconsistent status/stage
  const inconsistentOpportunities = useMemo(() => {
    const lostStages = ['lost', 'dnc', 'do not call', 'abandoned'];
    
    return opportunities.filter(opp => {
      const stageLower = (opp.stage_name || '').toLowerCase();
      const statusLower = (opp.status || '').toLowerCase();
      
      return lostStages.some(stage => stageLower.includes(stage)) && statusLower === 'open';
    });
  }, [opportunities]);

  // Find past appointments still marked as confirmed
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
    const contact = contacts.find(c => c.ghl_id === contactId);
    if (!contact) return 'Unknown';
    return contact.contact_name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unknown';
  };

  const getUserName = (userId: string | null) => {
    if (!userId) return 'Unassigned';
    const user = users.find(u => u.ghl_id === userId);
    if (!user) return 'Unknown';
    return user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unknown';
  };

  const getRelatedOpportunity = (contactId: string | null) => {
    if (!contactId) return null;
    // Find the most recent opportunity for this contact
    return opportunities.find(opp => opp.contact_id === contactId);
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
  };

  const handleUpdateOpportunityStatus = async (opportunity: Opportunity, newStatus: string) => {
    setUpdatingOppIds(prev => new Set(prev).add(opportunity.id));
    
    try {
      const { error } = await supabase.functions.invoke('update-ghl-opportunity', {
        body: { 
          ghl_id: opportunity.ghl_id,
          status: newStatus
        }
      });

      if (error) throw error;

      const { error: dbError } = await supabase
        .from('opportunities')
        .update({ status: newStatus })
        .eq('id', opportunity.id);

      if (dbError) throw dbError;

      toast.success(`Updated "${opportunity.name}" to ${newStatus}`);
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
    newApptStatus: string,
    newOppStage?: string
  ) => {
    setUpdatingApptIds(prev => new Set(prev).add(appointment.id));
    
    try {
      // Update appointment status in local database
      const { error: apptError } = await supabase
        .from('appointments')
        .update({ appointment_status: newApptStatus })
        .eq('id', appointment.id);

      if (apptError) throw apptError;

      // If a stage was selected, update the related opportunity
      if (newOppStage) {
        const relatedOpp = getRelatedOpportunity(appointment.contact_id);
        if (relatedOpp) {
          // Determine new status based on stage
          let newOppStatus = 'open';
          const stageLower = newOppStage.toLowerCase();
          if (stageLower.includes('sold')) {
            newOppStatus = 'won';
          } else if (stageLower.includes('lost') || stageLower.includes('dnc')) {
            newOppStatus = 'lost';
          }

          // Update opportunity in GHL
          const { error: ghlError } = await supabase.functions.invoke('update-ghl-opportunity', {
            body: { 
              ghl_id: relatedOpp.ghl_id,
              status: newOppStatus,
              stage_name: newOppStage
            }
          });

          if (ghlError) {
            console.error('GHL update error:', ghlError);
          }

          // Update opportunity in local database
          await supabase
            .from('opportunities')
            .update({ 
              stage_name: newOppStage,
              status: newOppStatus
            })
            .eq('id', relatedOpp.id);

          toast.success(`Updated appointment to "${newApptStatus}" and opportunity to "${newOppStage}"`);
        } else {
          toast.success(`Updated appointment to "${newApptStatus}" (no related opportunity found)`);
        }
      } else {
        toast.success(`Updated "${appointment.title}" to ${newApptStatus}`);
      }

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
    
    if (toUpdate.length === 0) {
      toast.info('No opportunities to update');
      return;
    }

    toast.info(`Updating ${toUpdate.length} opportunities...`);
    
    let successCount = 0;
    let failCount = 0;

    for (const opp of toUpdate) {
      const stageLower = (opp.stage_name || '').toLowerCase();
      const newStatus = stageLower.includes('lost') ? 'lost' : 'abandoned';
      
      setUpdatingOppIds(prev => new Set(prev).add(opp.id));
      
      try {
        const { error } = await supabase.functions.invoke('update-ghl-opportunity', {
          body: { 
            ghl_id: opp.ghl_id,
            status: newStatus
          }
        });

        if (!error) {
          await supabase
            .from('opportunities')
            .update({ status: newStatus })
            .eq('id', opp.id);
          successCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      } finally {
        setUpdatingOppIds(prev => {
          const next = new Set(prev);
          next.delete(opp.id);
          return next;
        });
      }
    }

    if (successCount > 0) {
      toast.success(`Updated ${successCount} opportunities`);
      onDataUpdated();
    }
    if (failCount > 0) {
      toast.error(`Failed to update ${failCount} opportunities`);
    }
  };

  const handleBulkUpdateAppointments = async () => {
    const toUpdate = pastConfirmedAppointments.filter(apt => !updatingApptIds.has(apt.id));
    
    if (toUpdate.length === 0) {
      toast.info('No appointments to update');
      return;
    }

    toast.info(`Updating ${toUpdate.length} appointments...`);
    
    let successCount = 0;
    let failCount = 0;

    for (const apt of toUpdate) {
      setUpdatingApptIds(prev => new Set(prev).add(apt.id));
      
      try {
        const { error: dbError } = await supabase
          .from('appointments')
          .update({ appointment_status: 'showed' })
          .eq('id', apt.id);

        if (!dbError) {
          successCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      } finally {
        setUpdatingApptIds(prev => {
          const next = new Set(prev);
          next.delete(apt.id);
          return next;
        });
      }
    }

    if (successCount > 0) {
      toast.success(`Updated ${successCount} appointments to "showed"`);
      onDataUpdated();
    }
    if (failCount > 0) {
      toast.error(`Failed to update ${failCount} appointments`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Inconsistent Status/Stage */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <div>
                <CardTitle className="text-lg">Inconsistent Status/Stage</CardTitle>
                <CardDescription>
                  Opportunities with "Lost", "DNC", or "Do Not Call" stage but "Open" status
                </CardDescription>
              </div>
            </div>
            {inconsistentOpportunities.length > 0 && (
              <Button 
                size="sm" 
                onClick={handleBulkUpdateOpportunities}
                disabled={updatingOppIds.size > 0}
              >
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
                    const suggestedStatus = stageLower.includes('lost') ? 'lost' : 'abandoned';
                    const isUpdating = updatingOppIds.has(opp.id);
                    
                    return (
                      <TableRow key={opp.id}>
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {opp.name || 'Unnamed'}
                        </TableCell>
                        <TableCell>{getContactName(opp.contact_id)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {opp.pipeline_name || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="destructive" className="text-xs">
                            {opp.stage_name}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {opp.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {opp.monetary_value 
                            ? `$${opp.monetary_value.toLocaleString()}` 
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleUpdateOpportunityStatus(opp, suggestedStatus)}
                            disabled={isUpdating}
                          >
                            {isUpdating ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              `Set ${suggestedStatus}`
                            )}
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CalendarClock className="h-5 w-5 text-amber-500" />
              <div>
                <CardTitle className="text-lg">Past Appointments Still Confirmed</CardTitle>
                <CardDescription>
                  Appointments that have passed but still show as "confirmed" or "new" - update both appointment and opportunity status
                </CardDescription>
              </div>
            </div>
            {pastConfirmedAppointments.length > 0 && (
              <Button 
                size="sm" 
                onClick={handleBulkUpdateAppointments}
                disabled={updatingApptIds.size > 0}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${updatingApptIds.size > 0 ? 'animate-spin' : ''}`} />
                Set All to "Showed" ({pastConfirmedAppointments.length})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {pastConfirmedAppointments.length === 0 ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span>No past appointments with incorrect status</span>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Appointment</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Current Opp Stage</TableHead>
                    <TableHead>Date/Time</TableHead>
                    <TableHead>New Opp Stage</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pastConfirmedAppointments.slice(0, 50).map((apt) => {
                    const isUpdating = updatingApptIds.has(apt.id);
                    const relatedOpp = getRelatedOpportunity(apt.contact_id);
                    const selectedStage = selectedStages[apt.id] || '';
                    
                    return (
                      <TableRow key={apt.id}>
                        <TableCell className="font-medium max-w-[180px]">
                          <div className="truncate">{apt.title || 'Untitled'}</div>
                          <div className="text-xs text-muted-foreground">
                            {getUserName(apt.assigned_user_id)}
                          </div>
                        </TableCell>
                        <TableCell>{getContactName(apt.contact_id)}</TableCell>
                        <TableCell>
                          {relatedOpp ? (
                            <Badge variant="outline" className="text-xs">
                              {relatedOpp.stage_name || 'No stage'}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">No opportunity</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDateTime(apt.start_time)}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={selectedStage}
                            onValueChange={(value) => setSelectedStages(prev => ({ ...prev, [apt.id]: value }))}
                          >
                            <SelectTrigger className="w-[160px] h-8 text-xs">
                              <SelectValue placeholder="Select stage..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none" className="text-xs">No change</SelectItem>
                              {APPOINTMENT_OUTCOME_STAGES.map(stage => (
                                <SelectItem key={stage.value} value={stage.value} className="text-xs">
                                  {stage.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleUpdateAppointmentWithOpportunity(
                              apt, 
                              'showed', 
                              selectedStage && selectedStage !== 'none' ? selectedStage : undefined
                            )}
                            disabled={isUpdating}
                          >
                            {isUpdating ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              'Showed'
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUpdateAppointmentWithOpportunity(
                              apt, 
                              'no_show',
                              selectedStage && selectedStage !== 'none' ? selectedStage : undefined
                            )}
                            disabled={isUpdating}
                          >
                            No Show
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {pastConfirmedAppointments.length > 50 && (
                <div className="p-3 text-center text-sm text-muted-foreground border-t">
                  Showing 50 of {pastConfirmedAppointments.length} appointments
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
