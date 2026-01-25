import { useState, useMemo } from "react";
import { CheckCircle2, Merge, ExternalLink, ChevronDown, ChevronRight, MapPin, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
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
  contact_uuid: string | null;
  address: string | null;
  scope_of_work: string | null;
  ghl_date_added?: string | null;
}

interface FieldTransfer {
  field: string;
  value: string;
  source: string;
}

interface NameDuplicateGroup {
  key: string;
  normalizedName: string;
  normalizedAddress: string | null; // null when grouping by name only
  opportunities: Opportunity[];
}

interface AddressNameDuplicatesCleanupProps {
  opportunities: Opportunity[];
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
  return 25;
}

// Normalize strings for comparison (lowercase, trim, remove extra spaces)
function normalizeString(str: string | null): string {
  if (!str) return '';
  return str.toLowerCase().trim().replace(/\s+/g, ' ');
}

// Normalize address for comparison (remove common variations)
function normalizeAddress(address: string | null): string {
  if (!address) return '';
  return address
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/,/g, '')
    .replace(/\./g, '')
    .replace(/\bst\b/g, 'street')
    .replace(/\bave\b/g, 'avenue')
    .replace(/\bdr\b/g, 'drive')
    .replace(/\brd\b/g, 'road')
    .replace(/\bln\b/g, 'lane')
    .replace(/\bblvd\b/g, 'boulevard')
    .replace(/\bct\b/g, 'court')
    .replace(/\bpl\b/g, 'place');
}

export function AddressNameDuplicatesCleanup({ 
  opportunities, 
  onDataUpdated, 
  onOpenOpportunity 
}: AddressNameDuplicatesCleanupProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedToKeep, setSelectedToKeep] = useState<Record<string, string>>({});
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingMerge, setPendingMerge] = useState<NameDuplicateGroup | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  
  // Filter options
  const [requireAddressMatch, setRequireAddressMatch] = useState(false);
  
  // Merge options state
  const [mergeOptions, setMergeOptions] = useState<{
    scopeOfWork: string;
    monetaryValue: string;
  }>({ scopeOfWork: 'keep', monetaryValue: 'highest' });

  // Fields that will be transferred from duplicates
  const [fieldsToTransfer, setFieldsToTransfer] = useState<FieldTransfer[]>([]);
  const [notesToTransferCount, setNotesToTransferCount] = useState(0);

  // Find duplicate opportunities by name (and optionally address)
  const duplicateGroups = useMemo(() => {
    const groupMap = new Map<string, Opportunity[]>();
    
    opportunities.forEach(opp => {
      const normalizedName = normalizeString(opp.name);
      
      // Skip if name is empty
      if (!normalizedName) return;
      
      let key: string;
      if (requireAddressMatch) {
        const normalizedAddress = normalizeAddress(opp.address);
        // Skip if address is required but empty
        if (!normalizedAddress) return;
        key = `${normalizedName}|${normalizedAddress}`;
      } else {
        key = normalizedName;
      }
      
      const existing = groupMap.get(key) || [];
      existing.push(opp);
      groupMap.set(key, existing);
    });

    const groups: NameDuplicateGroup[] = [];
    groupMap.forEach((opps, key) => {
      if (opps.length > 1) {
        let normalizedName: string;
        let normalizedAddress: string | null = null;
        
        if (requireAddressMatch && key.includes('|')) {
          [normalizedName, normalizedAddress] = key.split('|');
        } else {
          normalizedName = key;
        }
        
        // Sort by stage priority, then value, then date
        const sortedOpps = [...opps].sort((a, b) => {
          const priorityDiff = getStagePriority(b.stage_name) - getStagePriority(a.stage_name);
          if (priorityDiff !== 0) return priorityDiff;
          const valueDiff = (b.monetary_value || 0) - (a.monetary_value || 0);
          if (valueDiff !== 0) return valueDiff;
          return new Date(a.ghl_date_added || 0).getTime() - new Date(b.ghl_date_added || 0).getTime();
        });

        groups.push({
          key,
          normalizedName,
          normalizedAddress,
          opportunities: sortedOpps,
        });
      }
    });

    return groups.sort((a, b) => a.normalizedName.localeCompare(b.normalizedName));
  }, [opportunities, requireAddressMatch]);

  const toggleGroup = (group: NameDuplicateGroup) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group.key)) {
        next.delete(group.key);
      } else {
        next.add(group.key);
        if (!selectedToKeep[group.key]) {
          setSelectedToKeep(prev => ({ ...prev, [group.key]: group.opportunities[0].id }));
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

  const handleMergeClick = async (group: NameDuplicateGroup) => {
    if (!selectedToKeep[group.key]) {
      toast.error("Please select which opportunity to keep");
      return;
    }
    
    const keepId = selectedToKeep[group.key];
    const keepOpp = group.opportunities.find(o => o.id === keepId);
    const deleteOpps = group.opportunities.filter(o => o.id !== keepId);
    
    if (!keepOpp) return;
    
    // Calculate fields that will be transferred
    const transfers: FieldTransfer[] = [];
    
    // Check address
    if (!keepOpp.address) {
      const addressFromDup = deleteOpps.find(o => o.address);
      if (addressFromDup?.address) {
        transfers.push({ field: 'Address', value: addressFromDup.address, source: addressFromDup.name || 'Duplicate' });
      }
    }
    
    // Check scope_of_work (only if keep option is 'keep' and keep is missing)
    if (!keepOpp.scope_of_work) {
      const scopeFromDup = deleteOpps.find(o => o.scope_of_work);
      if (scopeFromDup?.scope_of_work) {
        transfers.push({ field: 'Scope of Work', value: scopeFromDup.scope_of_work.substring(0, 50) + (scopeFromDup.scope_of_work.length > 50 ? '...' : ''), source: scopeFromDup.name || 'Duplicate' });
      }
    }
    
    // Check phone and email from contacts
    if (keepOpp.contact_uuid) {
      const { data: keepContact } = await supabase
        .from('contacts')
        .select('phone, email')
        .eq('id', keepOpp.contact_uuid)
        .maybeSingle();
      
      if (keepContact) {
        // Check phone
        if (!keepContact.phone) {
          for (const dup of deleteOpps) {
            if (dup.contact_uuid && dup.contact_uuid !== keepOpp.contact_uuid) {
              const { data: dupContact } = await supabase
                .from('contacts')
                .select('phone')
                .eq('id', dup.contact_uuid)
                .maybeSingle();
              if (dupContact?.phone) {
                transfers.push({ field: 'Phone', value: dupContact.phone, source: dup.name || 'Duplicate' });
                break;
              }
            }
          }
        }
        
        // Check email
        if (!keepContact.email) {
          for (const dup of deleteOpps) {
            if (dup.contact_uuid && dup.contact_uuid !== keepOpp.contact_uuid) {
              const { data: dupContact } = await supabase
                .from('contacts')
                .select('email')
                .eq('id', dup.contact_uuid)
                .maybeSingle();
              if (dupContact?.email) {
                transfers.push({ field: 'Email', value: dupContact.email, source: dup.name || 'Duplicate' });
                break;
              }
            }
          }
        }
      }
    }
    
    // Check notes to transfer
    const dupContactUuids = deleteOpps
      .map(o => o.contact_uuid)
      .filter((uuid): uuid is string => Boolean(uuid) && uuid !== keepOpp.contact_uuid);
    
    if (dupContactUuids.length > 0) {
      const { count } = await supabase
        .from('contact_notes')
        .select('*', { count: 'exact', head: true })
        .in('contact_uuid', dupContactUuids);
      
      setNotesToTransferCount(count || 0);
    } else {
      setNotesToTransferCount(0);
    }
    
    setFieldsToTransfer(transfers);
    setPendingMerge(group);
    setShowConfirmDialog(true);
    setPasswordInput("");
    setPasswordError(false);
    setMergeOptions({ scopeOfWork: 'keep', monetaryValue: 'highest' });
  };

  const handleConfirmMerge = async () => {
    if (passwordInput !== DELETE_PASSWORD) {
      setPasswordError(true);
      return;
    }

    if (!pendingMerge) return;

    const keepId = selectedToKeep[pendingMerge.key];
    const keepOpp = pendingMerge.opportunities.find(o => o.id === keepId);
    const deleteOpps = pendingMerge.opportunities.filter(o => o.id !== keepId);

    if (!keepOpp) {
      toast.error("Could not find the opportunity to keep");
      return;
    }

    setShowConfirmDialog(false);
    
    const allIds = deleteOpps.map(o => o.id);
    setDeletingIds(prev => new Set([...prev, ...allIds]));

    try {
      // Calculate merged values based on options
      let mergedValue = keepOpp.monetary_value || 0;
      let mergedScopeOfWork = keepOpp.scope_of_work || '';

      if (mergeOptions.monetaryValue === 'highest') {
        deleteOpps.forEach(opp => {
          if (opp.monetary_value && opp.monetary_value > mergedValue) {
            mergedValue = opp.monetary_value;
          }
        });
      } else if (mergeOptions.monetaryValue === 'sum') {
        deleteOpps.forEach(opp => {
          if (opp.monetary_value) {
            mergedValue += opp.monetary_value;
          }
        });
      }

      if (mergeOptions.scopeOfWork === 'combine') {
        const allScopes = [keepOpp.scope_of_work, ...deleteOpps.map(o => o.scope_of_work)]
          .filter(Boolean)
          .filter((v, i, a) => a.indexOf(v) === i); // unique values
        mergedScopeOfWork = allScopes.join('\n\n---\n\n');
      }

      // Build update data for the opportunity
      const updateData: Record<string, unknown> = {};
      if (mergedValue !== (keepOpp.monetary_value || 0)) {
        updateData.monetary_value = mergedValue;
      }
      if (mergedScopeOfWork !== (keepOpp.scope_of_work || '')) {
        updateData.scope_of_work = mergedScopeOfWork;
      }

      // Transfer address from duplicate if keep opportunity is missing it
      if (!keepOpp.address) {
        const addressFromDup = deleteOpps.find(o => o.address);
        if (addressFromDup?.address) {
          updateData.address = addressFromDup.address;
        }
      }

      // Transfer scope_of_work from duplicate if keep option is 'keep' and keep is missing
      if (mergeOptions.scopeOfWork === 'keep' && !keepOpp.scope_of_work) {
        const scopeFromDup = deleteOpps.find(o => o.scope_of_work);
        if (scopeFromDup?.scope_of_work) {
          updateData.scope_of_work = scopeFromDup.scope_of_work;
        }
      }

      // Update opportunity in GHL and Supabase
      if (Object.keys(updateData).length > 0) {
        // Only call GHL API if the opportunity has a ghl_id
        if (keepOpp.ghl_id) {
          await supabase.functions.invoke('update-ghl-opportunity', {
            body: {
              ghl_id: keepOpp.ghl_id,
              ...updateData,
            }
          });
        }
        await supabase
          .from('opportunities')
          .update(updateData)
          .eq('id', keepOpp.id);
      }

      // Transfer phone and email from duplicate contacts
      if (keepOpp.contact_uuid) {
        const { data: keepContact } = await supabase
          .from('contacts')
          .select('id, ghl_id, phone, email')
          .eq('id', keepOpp.contact_uuid)
          .maybeSingle();

        if (keepContact) {
          const contactUpdates: Record<string, string> = {};

          // Check phone
          if (!keepContact.phone) {
            for (const dup of deleteOpps) {
              if (dup.contact_uuid && dup.contact_uuid !== keepOpp.contact_uuid) {
                const { data: dupContact } = await supabase
                  .from('contacts')
                  .select('phone')
                  .eq('id', dup.contact_uuid)
                  .maybeSingle();
                if (dupContact?.phone) {
                  contactUpdates.phone = dupContact.phone;
                  break;
                }
              }
            }
          }

          // Check email
          if (!keepContact.email) {
            for (const dup of deleteOpps) {
              if (dup.contact_uuid && dup.contact_uuid !== keepOpp.contact_uuid) {
                const { data: dupContact } = await supabase
                  .from('contacts')
                  .select('email')
                  .eq('id', dup.contact_uuid)
                  .maybeSingle();
                if (dupContact?.email) {
                  contactUpdates.email = dupContact.email;
                  break;
                }
              }
            }
          }

          // Update the kept contact with transferred fields
          if (Object.keys(contactUpdates).length > 0) {
            await supabase
              .from('contacts')
              .update(contactUpdates)
              .eq('id', keepContact.id);
            
            // Also update in GHL if the contact has a ghl_id
            if (keepContact.ghl_id) {
              try {
                if (contactUpdates.phone) {
                  await supabase.functions.invoke('update-contact-phone', {
                    body: { contactId: keepContact.ghl_id, phone: contactUpdates.phone }
                  });
                }
                // Note: There's no update-contact-email edge function, so email is only updated locally
              } catch (err) {
                console.warn('Failed to update contact in GHL:', err);
              }
            }
          }
        }
      }

      // Transfer notes from duplicate contacts to the kept contact
      const dupContactUuids = deleteOpps
        .map(o => o.contact_uuid)
        .filter((uuid): uuid is string => Boolean(uuid) && uuid !== keepOpp.contact_uuid);

      if (dupContactUuids.length > 0 && keepOpp.contact_uuid) {
        const { error: notesError, count: notesTransferred } = await supabase
          .from('contact_notes')
          .update({ contact_uuid: keepOpp.contact_uuid })
          .in('contact_uuid', dupContactUuids);

        if (notesError) {
          console.warn('Failed to transfer notes:', notesError);
        } else if (notesTransferred && notesTransferred > 0) {
          console.log(`Transferred ${notesTransferred} notes to kept contact`);
        }
      }

      // Delete the duplicate opportunities
      let deleteSuccess = 0;
      let deleteFail = 0;

      for (const opp of deleteOpps) {
        try {
          // Only call GHL API if the opportunity has a ghl_id
          if (opp.ghl_id) {
            const { error } = await supabase.functions.invoke('delete-ghl-opportunity', {
              body: { opportunityId: opp.ghl_id }
            });
            
            if (error) {
              console.error('Delete error:', error);
              deleteFail++;
              continue;
            }
          } else {
            // For local-only opportunities, just delete from Supabase
            const { error } = await supabase
              .from('opportunities')
              .delete()
              .eq('id', opp.id);
            
            if (error) {
              console.error('Local delete error:', error);
              deleteFail++;
              continue;
            }
          }
          deleteSuccess++;
        } catch (err) {
          console.error('Delete exception:', err);
          deleteFail++;
        }
      }

      if (deleteSuccess > 0) {
        const transferCount = fieldsToTransfer.length + (notesToTransferCount > 0 ? 1 : 0);
        const transferMsg = transferCount > 0 ? ` Transferred ${transferCount} field(s).` : '';
        toast.success(`Merged and deleted ${deleteSuccess} duplicate(s).${transferMsg} Kept: "${keepOpp.name || 'Unnamed'}"`);
        setSelectedToKeep(prev => {
          const next = { ...prev };
          delete next[pendingMerge.key];
          return next;
        });
        setExpandedGroups(prev => {
          const next = new Set(prev);
          next.delete(pendingMerge.key);
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
      setFieldsToTransfer([]);
      setNotesToTransferCount(0);
    }
  };

  const getDeleteSummary = () => {
    if (!pendingMerge) return { keepOpp: null, deleteOpps: [] };
    const keepId = selectedToKeep[pendingMerge.key];
    const keepOpp = pendingMerge.opportunities.find(o => o.id === keepId);
    const deleteOpps = pendingMerge.opportunities.filter(o => o.id !== keepId);
    return { keepOpp, deleteOpps };
  };

  const { keepOpp, deleteOpps } = getDeleteSummary();

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-lg">Name Duplicates</CardTitle>
                <CardDescription>
                  {requireAddressMatch 
                    ? "Opportunities with matching name AND address" 
                    : "Opportunities with matching name (same person, different records)"
                  }
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="require-address" className="text-sm text-muted-foreground cursor-pointer">
                Require address match
              </Label>
              <Switch
                id="require-address"
                checked={requireAddressMatch}
                onCheckedChange={setRequireAddressMatch}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {duplicateGroups.length === 0 ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span>No {requireAddressMatch ? "address + name" : "name"} duplicates found</span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="outline" className="text-primary border-primary/30">
                  {duplicateGroups.length} duplicate group{duplicateGroups.length !== 1 ? 's' : ''} found
                </Badge>
                <span className="text-sm text-muted-foreground">
                  ({duplicateGroups.reduce((sum, g) => sum + g.opportunities.length, 0)} total opportunities)
                </span>
              </div>

              {duplicateGroups.map((group) => (
                <Collapsible
                  key={group.key}
                  open={expandedGroups.has(group.key)}
                  onOpenChange={() => toggleGroup(group)}
                >
                  <div className="border rounded-lg">
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50">
                        <div className="flex items-center gap-3">
                          {expandedGroups.has(group.key) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <div>
                            <div className="font-medium capitalize">{group.normalizedName}</div>
                            {group.normalizedAddress && (
                              <div className="text-sm text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                <span className="capitalize">{group.normalizedAddress}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <Badge variant="secondary">
                          {group.opportunities.length} duplicates
                        </Badge>
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="border-t p-3">
                        <RadioGroup
                          value={selectedToKeep[group.key] || ''}
                          onValueChange={(value) => 
                            setSelectedToKeep(prev => ({ ...prev, [group.key]: value }))
                          }
                        >
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-12">Keep</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Stage</TableHead>
                                <TableHead>Value</TableHead>
                                <TableHead>Address</TableHead>
                                <TableHead>Created</TableHead>
                                <TableHead className="w-12"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {group.opportunities.map((opp, idx) => (
                                <TableRow 
                                  key={opp.id}
                                  className={deletingIds.has(opp.id) ? 'opacity-50' : ''}
                                >
                                  <TableCell>
                                    <RadioGroupItem 
                                      value={opp.id} 
                                      id={`keep-${opp.id}`}
                                      disabled={deletingIds.has(opp.id)}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <span>{opp.name || 'Unnamed'}</span>
                                      {idx === 0 && (
                                        <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                                          Recommended
                                        </Badge>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="secondary" className="text-xs">
                                      {opp.stage_name || '-'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>{formatValue(opp.monetary_value)}</TableCell>
                                  <TableCell className="max-w-[200px] truncate" title={opp.address || ''}>
                                    {opp.address || '-'}
                                  </TableCell>
                                  <TableCell>{formatDate(opp.ghl_date_added)}</TableCell>
                                  <TableCell>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onOpenOpportunity(opp);
                                      }}
                                    >
                                      <ExternalLink className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </RadioGroup>

                        <div className="flex justify-end mt-3">
                          <Button
                            size="sm"
                            onClick={() => handleMergeClick(group)}
                            disabled={!selectedToKeep[group.key] || deletingIds.size > 0}
                          >
                            <Merge className="h-4 w-4 mr-2" />
                            Merge & Delete Duplicates
                          </Button>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Merge Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Merge & Delete</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                {keepOpp && (
                  <div className="p-3 rounded-md bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
                    <div className="text-sm font-medium text-green-800 dark:text-green-200">
                      Keeping: {keepOpp.name || 'Unnamed'}
                    </div>
                    <div className="text-xs text-green-600 dark:text-green-400">
                      Stage: {keepOpp.stage_name || '-'} • Value: {formatValue(keepOpp.monetary_value)}
                    </div>
                  </div>
                )}

                <div className="p-3 rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
                  <div className="text-sm font-medium text-red-800 dark:text-red-200">
                    Deleting {deleteOpps.length} opportunity(ies):
                  </div>
                  <ul className="mt-1 text-xs text-red-600 dark:text-red-400 list-disc list-inside">
                    {deleteOpps.map(opp => (
                      <li key={opp.id}>{opp.name || 'Unnamed'} ({opp.stage_name || 'No stage'})</li>
                    ))}
                  </ul>
                </div>

                {/* Fields to Transfer Preview */}
                {(fieldsToTransfer.length > 0 || notesToTransferCount > 0) && (
                  <div className="p-3 rounded-md bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
                    <div className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      Fields that will be transferred:
                    </div>
                    <ul className="mt-1 text-xs text-blue-600 dark:text-blue-400 list-disc list-inside">
                      {fieldsToTransfer.map((transfer, idx) => (
                        <li key={idx}>
                          <span className="font-medium">{transfer.field}:</span> {transfer.value}
                          <span className="text-blue-500 dark:text-blue-500"> (from {transfer.source})</span>
                        </li>
                      ))}
                      {notesToTransferCount > 0 && (
                        <li>
                          <span className="font-medium">Notes:</span> {notesToTransferCount} note(s) will be re-linked
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                <div className="space-y-3 border-t pt-3">
                  <div className="text-sm font-medium">Merge Options:</div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs">Monetary Value:</Label>
                    <RadioGroup
                      value={mergeOptions.monetaryValue}
                      onValueChange={(v) => setMergeOptions(prev => ({ ...prev, monetaryValue: v }))}
                      className="flex gap-4"
                    >
                      <div className="flex items-center gap-1.5">
                        <RadioGroupItem value="keep" id="value-keep" />
                        <Label htmlFor="value-keep" className="text-xs cursor-pointer">Keep selected</Label>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <RadioGroupItem value="highest" id="value-highest" />
                        <Label htmlFor="value-highest" className="text-xs cursor-pointer">Use highest</Label>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <RadioGroupItem value="sum" id="value-sum" />
                        <Label htmlFor="value-sum" className="text-xs cursor-pointer">Sum all</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Scope of Work:</Label>
                    <RadioGroup
                      value={mergeOptions.scopeOfWork}
                      onValueChange={(v) => setMergeOptions(prev => ({ ...prev, scopeOfWork: v }))}
                      className="flex gap-4"
                    >
                      <div className="flex items-center gap-1.5">
                        <RadioGroupItem value="keep" id="scope-keep" />
                        <Label htmlFor="scope-keep" className="text-xs cursor-pointer">Keep selected</Label>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <RadioGroupItem value="combine" id="scope-combine" />
                        <Label htmlFor="scope-combine" className="text-xs cursor-pointer">Combine all</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-xs">
                    Enter password to confirm:
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      setPasswordError(false);
                    }}
                    placeholder="Enter deletion password"
                    className={passwordError ? 'border-red-500' : ''}
                  />
                  {passwordError && (
                    <p className="text-xs text-red-500">Incorrect password</p>
                  )}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmMerge}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirm Merge & Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
