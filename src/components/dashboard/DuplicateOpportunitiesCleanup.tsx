import { useState, useMemo } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, Trash2, Merge, ExternalLink, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { findContactByIdOrGhlId } from "@/lib/utils";

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

interface DuplicateGroup {
  contactId: string;
  contactName: string;
  pipelineId: string;
  pipelineName: string;
  opportunities: Opportunity[];
}

interface DuplicateOpportunitiesCleanupProps {
  opportunities: Opportunity[];
  contacts: Contact[];
  onDataUpdated: () => void;
  onOpenOpportunity: (opportunity: Opportunity) => void;
}

const DELETE_PASSWORD = "121867";

const STAGE_PRIORITY: Record<string, number> = {
  'sold': 100,
  'won': 100,
  'close to sale': 80,
  'important': 70,
  'second appointment': 60,
  'appointment follow up': 50,
  'contacted': 40,
  'new lead': 30,
  'new': 20,
  'quickbase': 10,
  'lost': 5,
  'abandoned': 5,
  'dnc': 5,
};

function getStagePriority(stageName: string | null): number {
  if (!stageName) return 0;
  const lower = stageName.toLowerCase();
  for (const [key, priority] of Object.entries(STAGE_PRIORITY)) {
    if (lower.includes(key)) return priority;
  }
  return 25; // default priority
}

export function DuplicateOpportunitiesCleanup({ 
  opportunities, 
  contacts, 
  onDataUpdated, 
  onOpenOpportunity 
}: DuplicateOpportunitiesCleanupProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedToKeep, setSelectedToKeep] = useState<Record<string, string>>({});
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingMerge, setPendingMerge] = useState<DuplicateGroup | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  
  // Bulk delete state
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [showBulkConfirmDialog, setShowBulkConfirmDialog] = useState(false);
  const [bulkPasswordInput, setBulkPasswordInput] = useState("");
  const [bulkPasswordError, setBulkPasswordError] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Find duplicate opportunities (same contact + same pipeline)
  const duplicateGroups = useMemo(() => {
    const groupMap = new Map<string, Opportunity[]>();
    
    opportunities.forEach(opp => {
      if (!opp.contact_id || !opp.pipeline_id) return;
      const key = `${opp.contact_id}|${opp.pipeline_id}`;
      const existing = groupMap.get(key) || [];
      existing.push(opp);
      groupMap.set(key, existing);
    });

    const groups: DuplicateGroup[] = [];
    groupMap.forEach((opps, key) => {
      if (opps.length > 1) {
        const [contactId, pipelineId] = key.split('|');
        const contact = findContactByIdOrGhlId(contacts, undefined, contactId);
        const contactName = contact?.contact_name || 
          `${contact?.first_name || ''} ${contact?.last_name || ''}`.trim() || 
          'Unknown';
        
        // Sort by stage priority (higher = more advanced) then by date (older first as tiebreaker)
        const sortedOpps = [...opps].sort((a, b) => {
          const priorityDiff = getStagePriority(b.stage_name) - getStagePriority(a.stage_name);
          if (priorityDiff !== 0) return priorityDiff;
          // If same priority, prefer the one with higher value
          const valueDiff = (b.monetary_value || 0) - (a.monetary_value || 0);
          if (valueDiff !== 0) return valueDiff;
          // If same value, prefer older (original)
          return new Date(a.ghl_date_added || 0).getTime() - new Date(b.ghl_date_added || 0).getTime();
        });

        groups.push({
          contactId,
          contactName,
          pipelineId,
          pipelineName: opps[0].pipeline_name || 'Unknown Pipeline',
          opportunities: sortedOpps,
        });
      }
    });

    // Sort groups by contact name
    return groups.sort((a, b) => a.contactName.localeCompare(b.contactName));
  }, [opportunities, contacts]);

  const getGroupKey = (group: DuplicateGroup) => `${group.contactId}|${group.pipelineId}`;

  const toggleGroup = (group: DuplicateGroup) => {
    const key = getGroupKey(group);
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        // Auto-select the recommended opportunity to keep (first one - highest priority)
        if (!selectedToKeep[key]) {
          setSelectedToKeep(prev => ({ ...prev, [key]: group.opportunities[0].id }));
        }
      }
      return next;
    });
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  };

  const formatValue = (value: number | null) => {
    if (!value) return '-';
    return `$${value.toLocaleString()}`;
  };

  const handleMergeClick = (group: DuplicateGroup) => {
    const key = getGroupKey(group);
    if (!selectedToKeep[key]) {
      toast.error("Please select which opportunity to keep");
      return;
    }
    setPendingMerge(group);
    setShowConfirmDialog(true);
    setPasswordInput("");
    setPasswordError(false);
  };

  const handleConfirmMerge = async () => {
    if (passwordInput !== DELETE_PASSWORD) {
      setPasswordError(true);
      return;
    }

    if (!pendingMerge) return;

    const key = getGroupKey(pendingMerge);
    const keepId = selectedToKeep[key];
    const keepOpp = pendingMerge.opportunities.find(o => o.id === keepId);
    const deleteOpps = pendingMerge.opportunities.filter(o => o.id !== keepId);

    if (!keepOpp) {
      toast.error("Could not find the opportunity to keep");
      return;
    }

    setShowConfirmDialog(false);
    
    // Mark all as deleting
    const allIds = deleteOpps.map(o => o.id);
    setDeletingIds(prev => new Set([...prev, ...allIds]));

    try {
      // Calculate merged values
      let mergedValue = keepOpp.monetary_value || 0;
      deleteOpps.forEach(opp => {
        if (opp.monetary_value && opp.monetary_value > mergedValue) {
          mergedValue = opp.monetary_value;
        }
      });

      // Update the kept opportunity if we need to merge higher value
      if (mergedValue > (keepOpp.monetary_value || 0)) {
        await supabase.functions.invoke('update-ghl-opportunity', {
          body: {
            ghl_id: keepOpp.ghl_id,
            monetary_value: mergedValue,
          }
        });
        await supabase
          .from('opportunities')
          .update({ monetary_value: mergedValue })
          .eq('id', keepOpp.id);
      }

      // Delete the other opportunities
      let deleteSuccess = 0;
      let deleteFail = 0;

      for (const opp of deleteOpps) {
        try {
          const { error } = await supabase.functions.invoke('delete-ghl-opportunity', {
            body: { opportunityId: opp.ghl_id }
          });
          
          if (error) {
            console.error('Delete error:', error);
            deleteFail++;
          } else {
            deleteSuccess++;
          }
        } catch (err) {
          console.error('Delete exception:', err);
          deleteFail++;
        }
      }

      if (deleteSuccess > 0) {
        toast.success(`Merged and deleted ${deleteSuccess} duplicate(s). Kept: "${keepOpp.name || 'Unnamed'}"`);
        // Clear selection for this group
        setSelectedToKeep(prev => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        setExpandedGroups(prev => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        onDataUpdated();
      }
      if (deleteFail > 0) {
        toast.error(`Failed to delete ${deleteFail} opportunity(ies)`);
      }
    } catch (err) {
      toast.error(`Merge failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        allIds.forEach(id => next.delete(id));
        return next;
      });
      setPendingMerge(null);
    }
  };

  const getDeleteSummary = () => {
    if (!pendingMerge) return { keepOpp: null, deleteOpps: [] };
    const key = getGroupKey(pendingMerge);
    const keepId = selectedToKeep[key];
    const keepOpp = pendingMerge.opportunities.find(o => o.id === keepId);
    const deleteOpps = pendingMerge.opportunities.filter(o => o.id !== keepId);
    return { keepOpp, deleteOpps };
  };

  const { keepOpp, deleteOpps } = getDeleteSummary();

  // Bulk selection helpers
  const toggleGroupSelection = (groupKey: string) => {
    setSelectedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  const selectAllGroups = () => {
    setSelectedGroups(new Set(duplicateGroups.map(g => getGroupKey(g))));
  };

  const deselectAllGroups = () => {
    setSelectedGroups(new Set());
  };

  const handleBulkDelete = () => {
    if (selectedGroups.size === 0) {
      toast.error("No duplicates selected");
      return;
    }
    setShowBulkConfirmDialog(true);
    setBulkPasswordInput("");
    setBulkPasswordError(false);
  };

  const handleConfirmBulkDelete = async () => {
    if (bulkPasswordInput !== DELETE_PASSWORD) {
      setBulkPasswordError(true);
      return;
    }

    setShowBulkConfirmDialog(false);
    setIsBulkDeleting(true);

    let totalDeleted = 0;
    let totalFailed = 0;

    try {
      for (const groupKey of selectedGroups) {
        const group = duplicateGroups.find(g => getGroupKey(g) === groupKey);
        if (!group) continue;

        // Use custom selection if available, otherwise use recommended (first)
        const keepId = selectedToKeep[groupKey] || group.opportunities[0].id;
        const keepOpp = group.opportunities.find(o => o.id === keepId);
        const deleteOpps = group.opportunities.filter(o => o.id !== keepId);

        if (!keepOpp) continue;

        // Mark as deleting
        const deleteIds = deleteOpps.map(o => o.id);
        setDeletingIds(prev => new Set([...prev, ...deleteIds]));

        // Calculate merged value
        let mergedValue = keepOpp.monetary_value || 0;
        deleteOpps.forEach(opp => {
          if (opp.monetary_value && opp.monetary_value > mergedValue) {
            mergedValue = opp.monetary_value;
          }
        });

        // Update kept opportunity if needed
        if (mergedValue > (keepOpp.monetary_value || 0)) {
          try {
            await supabase.functions.invoke('update-ghl-opportunity', {
              body: { ghl_id: keepOpp.ghl_id, monetary_value: mergedValue }
            });
            await supabase
              .from('opportunities')
              .update({ monetary_value: mergedValue })
              .eq('id', keepOpp.id);
          } catch (err) {
            console.error('Update error:', err);
          }
        }

        // Delete duplicates
        for (const opp of deleteOpps) {
          try {
            const { error } = await supabase.functions.invoke('delete-ghl-opportunity', {
              body: { opportunityId: opp.ghl_id }
            });
            if (error) {
              totalFailed++;
            } else {
              totalDeleted++;
            }
          } catch (err) {
            totalFailed++;
          }
        }

        // Clear selection state for this group
        setDeletingIds(prev => {
          const next = new Set(prev);
          deleteIds.forEach(id => next.delete(id));
          return next;
        });
      }

      if (totalDeleted > 0) {
        toast.success(`Deleted ${totalDeleted} duplicate opportunity(ies)`);
        setSelectedGroups(new Set());
        setSelectedToKeep({});
        setExpandedGroups(new Set());
        onDataUpdated();
      }
      if (totalFailed > 0) {
        toast.error(`Failed to delete ${totalFailed} opportunity(ies)`);
      }
    } catch (err) {
      toast.error(`Bulk delete failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const getBulkDeleteSummary = () => {
    let totalToDelete = 0;
    const summaryGroups: { contactName: string; keepName: string; deleteCount: number }[] = [];
    
    for (const groupKey of selectedGroups) {
      const group = duplicateGroups.find(g => getGroupKey(g) === groupKey);
      if (!group) continue;
      
      const keepId = selectedToKeep[groupKey] || group.opportunities[0].id;
      const keepOpp = group.opportunities.find(o => o.id === keepId);
      const deleteCount = group.opportunities.length - 1;
      
      totalToDelete += deleteCount;
      summaryGroups.push({
        contactName: group.contactName,
        keepName: keepOpp?.name || 'Unnamed',
        deleteCount
      });
    }
    
    return { totalToDelete, summaryGroups };
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Merge className="h-5 w-5 text-amber-500" />
            <div>
              <CardTitle className="text-lg">Duplicate Opportunities</CardTitle>
              <CardDescription>
                Contacts with multiple opportunities in the same pipeline
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {duplicateGroups.length === 0 ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span>No duplicate opportunities found</span>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Bulk actions bar */}
              <div className="flex items-center justify-between flex-wrap gap-2 mb-4 p-3 rounded-lg bg-muted/30 border">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="select-all"
                      checked={selectedGroups.size === duplicateGroups.length && duplicateGroups.length > 0}
                      onCheckedChange={(checked) => checked ? selectAllGroups() : deselectAllGroups()}
                    />
                    <Label htmlFor="select-all" className="text-sm cursor-pointer">
                      Select All
                    </Label>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {selectedGroups.size} of {duplicateGroups.length} selected
                  </span>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={selectedGroups.size === 0 || isBulkDeleting}
                >
                  {isBulkDeleting ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Delete Selected ({selectedGroups.size})
                </Button>
              </div>
              
              <div className="text-sm text-muted-foreground mb-2">
                Found {duplicateGroups.length} contact(s) with duplicate opportunities. 
                Select duplicates to delete in bulk, or expand to customize which to keep.
              </div>
              
              {duplicateGroups.map((group) => {
                const key = getGroupKey(group);
                const isExpanded = expandedGroups.has(key);
                const selectedId = selectedToKeep[key];
                const isAnyDeleting = group.opportunities.some(o => deletingIds.has(o.id));
                const isGroupSelected = selectedGroups.has(key);
                
                return (
                  <Collapsible key={key} open={isExpanded} onOpenChange={() => toggleGroup(group)}>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={isGroupSelected}
                        onCheckedChange={() => toggleGroupSelection(key)}
                        onClick={(e) => e.stopPropagation()}
                        disabled={isBulkDeleting || isAnyDeleting}
                      />
                      <CollapsibleTrigger asChild className="flex-1">
                        <div className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-3">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                            <div>
                              <div className="font-medium">{group.contactName}</div>
                              <div className="text-sm text-muted-foreground">{group.pipelineName}</div>
                            </div>
                          </div>
                          <Badge variant="destructive" className="text-xs">
                            {group.opportunities.length} duplicates
                          </Badge>
                        </div>
                      </CollapsibleTrigger>
                    </div>
                    
                    <CollapsibleContent>
                      <div className="mt-2 p-4 border rounded-lg bg-muted/20">
                        <div className="text-sm font-medium mb-3 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                          Select which opportunity to KEEP (others will be deleted):
                        </div>
                        
                        <RadioGroup 
                          value={selectedId || ''} 
                          onValueChange={(value) => setSelectedToKeep(prev => ({ ...prev, [key]: value }))}
                          className="space-y-0"
                        >
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[8%]">Keep</TableHead>
                                <TableHead className="w-[30%]">Opportunity Name</TableHead>
                                <TableHead className="w-[14%]">Stage</TableHead>
                                <TableHead className="w-[12%]">Status</TableHead>
                                <TableHead className="w-[12%]">Value</TableHead>
                                <TableHead className="w-[16%] whitespace-nowrap">Date Added</TableHead>
                                <TableHead className="w-[8%]"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {group.opportunities.map((opp, idx) => {
                                const isSelected = selectedId === opp.id;
                                const isDeleting = deletingIds.has(opp.id);
                                const isRecommended = idx === 0;
                                
                                return (
                                  <TableRow 
                                    key={opp.id} 
                                    className={`${isSelected ? 'bg-primary/10' : ''} ${isDeleting ? 'opacity-50' : ''}`}
                                  >
                                    <TableCell>
                                      <RadioGroupItem 
                                        value={opp.id} 
                                        id={opp.id}
                                        disabled={isDeleting}
                                      />
                                    </TableCell>
                                    <TableCell className="font-medium">
                                      <div className="flex items-center gap-2">
                                        <span className="truncate max-w-[200px]">{opp.name || 'Unnamed'}</span>
                                        {isRecommended && (
                                          <Badge variant="secondary" className="text-xs shrink-0">Recommended</Badge>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="outline" className="text-xs">
                                        {opp.stage_name || '-'}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      <Badge 
                                        variant={opp.status === 'won' ? 'default' : opp.status === 'lost' ? 'destructive' : 'secondary'}
                                        className="text-xs capitalize"
                                      >
                                        {opp.status || '-'}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>{formatValue(opp.monetary_value)}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                      {formatDate(opp.ghl_date_added)}
                                    </TableCell>
                                    <TableCell>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onOpenOpportunity(opp);
                                        }}
                                      >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </RadioGroup>
                        
                        <div className="mt-4 flex justify-end">
                          <Button 
                            variant="destructive"
                            size="sm"
                            onClick={() => handleMergeClick(group)}
                            disabled={!selectedId || isAnyDeleting}
                          >
                            {isAnyDeleting ? (
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4 mr-2" />
                            )}
                            Merge & Delete {group.opportunities.length - 1} Duplicate(s)
                          </Button>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirm Merge & Delete
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>You are about to permanently delete {deleteOpps.length} opportunity(ies) from both GHL and Supabase.</p>
                
                {keepOpp && (
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <div className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">✓ KEEP:</div>
                    <div className="text-sm">{keepOpp.name || 'Unnamed'}</div>
                    <div className="text-xs text-muted-foreground">
                      Stage: {keepOpp.stage_name || '-'} | Value: {formatValue(keepOpp.monetary_value)}
                    </div>
                  </div>
                )}
                
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <div className="text-sm font-medium text-destructive mb-1">✗ DELETE:</div>
                  {deleteOpps.map(opp => (
                    <div key={opp.id} className="text-sm">
                      {opp.name || 'Unnamed'} 
                      <span className="text-xs text-muted-foreground ml-2">
                        (Stage: {opp.stage_name || '-'} | Value: {formatValue(opp.monetary_value)})
                      </span>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Enter password to confirm:</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter password"
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      setPasswordError(false);
                    }}
                    className={passwordError ? 'border-destructive' : ''}
                  />
                  {passwordError && (
                    <p className="text-xs text-destructive">Incorrect password</p>
                  )}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingMerge(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmMerge}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Duplicates
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={showBulkConfirmDialog} onOpenChange={setShowBulkConfirmDialog}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirm Bulk Delete
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  You are about to delete <strong>{getBulkDeleteSummary().totalToDelete}</strong> duplicate 
                  opportunity(ies) across <strong>{selectedGroups.size}</strong> contact(s).
                </p>
                
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {getBulkDeleteSummary().summaryGroups.map((item, idx) => (
                    <div key={idx} className="p-2 rounded border bg-muted/20 text-sm">
                      <div className="font-medium">{item.contactName}</div>
                      <div className="text-xs text-muted-foreground">
                        Keep: "{item.keepName}" • Delete: {item.deleteCount} duplicate(s)
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bulk-password">Enter password to confirm:</Label>
                  <Input
                    id="bulk-password"
                    type="password"
                    placeholder="Enter password"
                    value={bulkPasswordInput}
                    onChange={(e) => {
                      setBulkPasswordInput(e.target.value);
                      setBulkPasswordError(false);
                    }}
                    className={bulkPasswordError ? 'border-destructive' : ''}
                  />
                  {bulkPasswordError && (
                    <p className="text-xs text-destructive">Incorrect password</p>
                  )}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete {getBulkDeleteSummary().totalToDelete} Duplicates
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
