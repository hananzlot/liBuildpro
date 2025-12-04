import { useState, useMemo } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Opportunity {
  id: string;
  ghl_id: string;
  name: string | null;
  status: string | null;
  stage_name: string | null;
  pipeline_name: string | null;
  monetary_value: number | null;
  contact_id: string | null;
}

interface Contact {
  ghl_id: string;
  contact_name: string | null;
  first_name: string | null;
  last_name: string | null;
}

interface AdminCleanupProps {
  opportunities: Opportunity[];
  contacts: Contact[];
  onDataUpdated: () => void;
}

export function AdminCleanup({ opportunities, contacts, onDataUpdated }: AdminCleanupProps) {
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

  // Find opportunities with inconsistent status/stage
  const inconsistentOpportunities = useMemo(() => {
    const lostStages = ['lost', 'dnc', 'do not call', 'abandoned'];
    
    return opportunities.filter(opp => {
      const stageLower = (opp.stage_name || '').toLowerCase();
      const statusLower = (opp.status || '').toLowerCase();
      
      // Stage indicates lost/dnc but status is still open
      return lostStages.some(stage => stageLower.includes(stage)) && statusLower === 'open';
    });
  }, [opportunities]);

  const getContactName = (contactId: string | null) => {
    if (!contactId) return 'Unknown';
    const contact = contacts.find(c => c.ghl_id === contactId);
    if (!contact) return 'Unknown';
    return contact.contact_name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unknown';
  };

  const handleUpdateStatus = async (opportunity: Opportunity, newStatus: string) => {
    setUpdatingIds(prev => new Set(prev).add(opportunity.id));
    
    try {
      // Call edge function to update in GHL
      const { error } = await supabase.functions.invoke('update-ghl-opportunity', {
        body: { 
          ghl_id: opportunity.ghl_id,
          status: newStatus
        }
      });

      if (error) throw error;

      // Update local database
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
      setUpdatingIds(prev => {
        const next = new Set(prev);
        next.delete(opportunity.id);
        return next;
      });
    }
  };

  const handleBulkUpdate = async () => {
    const toUpdate = inconsistentOpportunities.filter(opp => !updatingIds.has(opp.id));
    
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
      
      setUpdatingIds(prev => new Set(prev).add(opp.id));
      
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
        setUpdatingIds(prev => {
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
                onClick={handleBulkUpdate}
                disabled={updatingIds.size > 0}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${updatingIds.size > 0 ? 'animate-spin' : ''}`} />
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
                    const isUpdating = updatingIds.has(opp.id);
                    
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
                            onClick={() => handleUpdateStatus(opp, suggestedStatus)}
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
    </div>
  );
}
