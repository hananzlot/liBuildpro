import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompanyContext } from '@/hooks/useCompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useShortLinks } from '@/hooks/useShortLinks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2, UserCircle, Phone, Mail, Link2, Copy, Check, ExternalLink, Merge } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

interface Salesperson {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  ghl_user_id: string | null;
  created_at: string;
  updated_at: string;
}


interface PortalToken {
  id: string;
  token: string;
  salesperson_id: string;
}

export function SalespeopleManagement() {
  const queryClient = useQueryClient();
  const { companyId } = useCompanyContext();
  const { user } = useAuth();
  const { createSalespersonCalendarShortLink, isShortLinksEnabled } = useShortLinks();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [editingSalesperson, setEditingSalesperson] = useState<Salesperson | null>(null);
  const [formData, setFormData] = useState({ name: '', phone: '', email: '' });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [selectedForMerge, setSelectedForMerge] = useState<Set<string>>(new Set());
  const [primaryMergeId, setPrimaryMergeId] = useState<string | null>(null);

  const { data: salespeople = [], isLoading } = useQuery({
    queryKey: ['salespeople', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salespeople')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as Salesperson[];
    },
    enabled: !!companyId,
  });


  // Fetch existing portal tokens
  const { data: portalTokens = [] } = useQuery({
    queryKey: ['salesperson-portal-tokens', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salesperson_portal_tokens')
        .select('id, token, salesperson_id')
        .eq('company_id', companyId)
        .eq('is_active', true);
      if (error) throw error;
      return data as PortalToken[];
    },
    enabled: !!companyId,
  });

  // Fetch company base URL for portal links
  const { data: companyBaseUrl } = useQuery({
    queryKey: ['company-base-url', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_settings')
        .select('setting_value')
        .eq('company_id', companyId)
        .eq('setting_key', 'app_base_url')
        .maybeSingle();
      if (error) throw error;
      return data?.setting_value || window.location.origin;
    },
    enabled: !!companyId,
  });

  // Fetch existing salesperson names from projects for sync
  const { data: projectSalespeople = [] } = useQuery({
    queryKey: ['project-salespeople-names', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('primary_salesperson, secondary_salesperson, tertiary_salesperson, quaternary_salesperson, project_manager')
        .eq('company_id', companyId);
      if (error) throw error;
      
      const names = new Set<string>();
      data.forEach((p) => {
        if (p.primary_salesperson) names.add(p.primary_salesperson);
        if (p.secondary_salesperson) names.add(p.secondary_salesperson);
        if (p.tertiary_salesperson) names.add(p.tertiary_salesperson);
        if (p.quaternary_salesperson) names.add(p.quaternary_salesperson);
        if (p.project_manager) names.add(p.project_manager);
      });
      
      return Array.from(names);
    },
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; phone: string; email: string }) => {
      const { error } = await supabase
        .from('salespeople')
        .insert({
          name: data.name,
          phone: data.phone || null,
          email: data.email || null,
          company_id: companyId,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Salesperson added');
      queryClient.invalidateQueries({ queryKey: ['salespeople', companyId] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(`Failed to add: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name: string; phone: string; email: string }) => {
      const { error } = await supabase
        .from('salespeople')
        .update({
          name: data.name,
          phone: data.phone || null,
          email: data.email || null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Salesperson updated');
      queryClient.invalidateQueries({ queryKey: ['salespeople', companyId] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('salespeople')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Salesperson deleted');
      queryClient.invalidateQueries({ queryKey: ['salespeople', companyId] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  const syncFromProjects = useMutation({
    mutationFn: async () => {
      const existingNames = salespeople.map(s => s.name.toLowerCase());
      const newNames = projectSalespeople.filter(
        name => !existingNames.includes(name.toLowerCase())
      );
      
      if (newNames.length === 0) {
        throw new Error('No new salespeople to sync');
      }
      
      const { error } = await supabase
        .from('salespeople')
        .insert(newNames.map(name => ({ name, company_id: companyId })));
      if (error) throw error;
      return newNames.length;
    },
    onSuccess: (count) => {
      toast.success(`Synced ${count} salespeople from projects`);
      queryClient.invalidateQueries({ queryKey: ['salespeople', companyId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const generatePortalLink = async (salesperson: Salesperson) => {
    // Portal links now work with salesperson_id (UUID) as primary identifier
    // GHL user linking is no longer required - it's just a fallback for legacy appointments

    setGeneratingFor(salesperson.id);

    try {
      // Check for existing token
      const existingToken = portalTokens.find(t => t.salesperson_id === salesperson.id);
      
      if (existingToken) {
        // Copy existing link using company base URL
        const baseUrl = companyBaseUrl || window.location.origin;
        const longUrl = `${baseUrl}/salesperson-calendar/${existingToken.token}`;
        // Use short link if feature is enabled
        const url = isShortLinksEnabled 
          ? await createSalespersonCalendarShortLink(longUrl, salesperson.name)
          : longUrl;
        await navigator.clipboard.writeText(url);
        setCopiedId(salesperson.id);
        setTimeout(() => setCopiedId(null), 2000);
        toast.success('Portal link copied to clipboard');
        return;
      }

      // Create new token
      const { data, error } = await supabase
        .from('salesperson_portal_tokens')
        .insert({
          salesperson_id: salesperson.id,
          company_id: companyId,
          created_by: user?.id,
        })
        .select('token')
        .single();

      if (error) throw error;

      const baseUrl = companyBaseUrl || window.location.origin;
      const longUrl = `${baseUrl}/salesperson-calendar/${data.token}`;
      // Use short link if feature is enabled
      const url = isShortLinksEnabled 
        ? await createSalespersonCalendarShortLink(longUrl, salesperson.name)
        : longUrl;
      await navigator.clipboard.writeText(url);
      setCopiedId(salesperson.id);
      setTimeout(() => setCopiedId(null), 2000);
      
      queryClient.invalidateQueries({ queryKey: ['salesperson-portal-tokens', companyId] });
      toast.success('Portal link generated and copied to clipboard');
    } catch (error) {
      toast.error(`Failed to generate link: ${(error as Error).message}`);
    } finally {
      setGeneratingFor(null);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', phone: '', email: '' });
    setEditingSalesperson(null);
  };

  const handleEdit = (salesperson: Salesperson) => {
    setEditingSalesperson(salesperson);
    setFormData({
      name: salesperson.name,
      phone: salesperson.phone || '',
      email: salesperson.email || '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }
    
    if (editingSalesperson) {
      updateMutation.mutate({ id: editingSalesperson.id, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };


  const missingSalespeople = projectSalespeople.filter(
    name => !salespeople.some(s => s.name.toLowerCase() === name.toLowerCase())
  );

  const toggleMergeSelection = (id: string) => {
    setSelectedForMerge(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (primaryMergeId === id) setPrimaryMergeId(null);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const mergeMutation = useMutation({
    mutationFn: async ({ primaryId, duplicateIds }: { primaryId: string; duplicateIds: string[] }) => {
      const primary = salespeople.find(s => s.id === primaryId);
      const duplicates = salespeople.filter(s => duplicateIds.includes(s.id));
      
      if (!primary || duplicates.length === 0) throw new Error('Invalid merge selection');

      // Track the ghl_user_id to use (primary's or transferred from a duplicate)
      let effectiveGhlUserId = primary.ghl_user_id;

      // If primary doesn't have a GHL user ID, try to get one from duplicates
      if (!effectiveGhlUserId) {
        const dupWithGhl = duplicates.find(d => d.ghl_user_id);
        if (dupWithGhl?.ghl_user_id) {
          effectiveGhlUserId = dupWithGhl.ghl_user_id;
          // Update primary salesperson with the GHL user ID from duplicate
          await supabase
            .from('salespeople')
            .update({ ghl_user_id: effectiveGhlUserId })
            .eq('id', primaryId);
        }
      }

      // Update projects: replace duplicate names with primary name
      for (const dup of duplicates) {
        // Update primary_salesperson
        await supabase
          .from('projects')
          .update({ primary_salesperson: primary.name })
          .eq('company_id', companyId)
          .eq('primary_salesperson', dup.name);

        // Update secondary_salesperson
        await supabase
          .from('projects')
          .update({ secondary_salesperson: primary.name })
          .eq('company_id', companyId)
          .eq('secondary_salesperson', dup.name);

        // Update tertiary_salesperson
        await supabase
          .from('projects')
          .update({ tertiary_salesperson: primary.name })
          .eq('company_id', companyId)
          .eq('tertiary_salesperson', dup.name);

        // Update quaternary_salesperson
        await supabase
          .from('projects')
          .update({ quaternary_salesperson: primary.name })
          .eq('company_id', companyId)
          .eq('quaternary_salesperson', dup.name);

        // Update project_manager
        await supabase
          .from('projects')
          .update({ project_manager: primary.name })
          .eq('company_id', companyId)
          .eq('project_manager', dup.name);

        // Update appointments: reassign salesperson_id from duplicate to primary
        await supabase
          .from('appointments')
          .update({ 
            salesperson_id: primary.id,
            assigned_user_id: effectiveGhlUserId // Use the effective GHL ID
          })
          .eq('company_id', companyId)
          .eq('salesperson_id', dup.id);

        // Also update any appointments that only have the GHL user ID (legacy records)
        if (dup.ghl_user_id) {
          await supabase
            .from('appointments')
            .update({ 
              salesperson_id: primary.id,
              assigned_user_id: effectiveGhlUserId 
            })
            .eq('company_id', companyId)
            .eq('assigned_user_id', dup.ghl_user_id)
            .is('salesperson_id', null);
        }

        // Update opportunities: reassign salesperson_id from duplicate to primary
        await supabase
          .from('opportunities')
          .update({ 
            salesperson_id: primary.id,
            assigned_to: effectiveGhlUserId // Use the effective GHL ID
          })
          .eq('company_id', companyId)
          .eq('salesperson_id', dup.id);

        // Also update any opportunities that only have the GHL user ID (legacy records)
        if (dup.ghl_user_id) {
          await supabase
            .from('opportunities')
            .update({ 
              salesperson_id: primary.id,
              assigned_to: effectiveGhlUserId 
            })
            .eq('company_id', companyId)
            .eq('assigned_to', dup.ghl_user_id)
            .is('salesperson_id', null);
        }

        // Update estimates: replace salesperson_name
        await supabase
          .from('estimates')
          .update({ salesperson_name: primary.name })
          .eq('company_id', companyId)
          .eq('salesperson_name', dup.name);

        // Transfer portal tokens to primary
        await supabase
          .from('salesperson_portal_tokens')
          .delete()
          .eq('salesperson_id', dup.id);

        // Mark duplicate salesperson as inactive instead of deleting
        const { error } = await supabase
          .from('salespeople')
          .update({ is_active: false })
          .eq('id', dup.id);
        
        if (error) throw error;
      }

      return duplicates.length;
    },
    onSuccess: (count) => {
      toast.success(`Merged ${count} duplicate record(s)`);
      queryClient.invalidateQueries({ queryKey: ['salespeople', companyId] });
      queryClient.invalidateQueries({ queryKey: ['salesperson-portal-tokens', companyId] });
      queryClient.invalidateQueries({ queryKey: ['project-salespeople-names', companyId] });
      setMergeDialogOpen(false);
      setSelectedForMerge(new Set());
      setPrimaryMergeId(null);
    },
    onError: (error: Error) => {
      toast.error(`Merge failed: ${error.message}`);
    },
  });

  const handleMerge = () => {
    if (!primaryMergeId) {
      toast.error('Please select a primary record to keep');
      return;
    }
    const duplicateIds = Array.from(selectedForMerge).filter(id => id !== primaryMergeId);
    if (duplicateIds.length === 0) {
      toast.error('Select at least one duplicate record to merge');
      return;
    }
    mergeMutation.mutate({ primaryId: primaryMergeId, duplicateIds });
  };

  const openMergeDialog = () => {
    setSelectedForMerge(new Set());
    setPrimaryMergeId(null);
    setMergeDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCircle className="h-5 w-5" />
          Salespeople Directory
        </CardTitle>
        <CardDescription>
          Manage salesperson contact information and generate calendar portal links
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Salesperson
          </Button>
          {salespeople.length >= 2 && (
            <Button variant="outline" onClick={openMergeDialog}>
              <Merge className="h-4 w-4 mr-2" />
              Merge Duplicates
            </Button>
          )}
          {missingSalespeople.length > 0 && (
            <Button 
              variant="outline" 
              onClick={() => syncFromProjects.mutate()}
              disabled={syncFromProjects.isPending}
            >
              {syncFromProjects.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Sync from Projects ({missingSalespeople.length})
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : salespeople.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No salespeople added yet. Add one or sync from existing projects.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Phone</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  
                  <TableHead className="w-[140px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salespeople.map((person) => {
                  const hasToken = portalTokens.some(t => t.salesperson_id === person.id);
                  const isCopied = copiedId === person.id;
                  const isGenerating = generatingFor === person.id;

                  return (
                    <TableRow key={person.id}>
                      <TableCell className="font-medium">
                        <div>
                          {person.name}
                          {person.ghl_user_id && (
                            <span className="block text-xs text-muted-foreground lg:hidden">
                              Linked to calendar
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {person.phone ? (
                          <span className="flex items-center gap-1 text-sm">
                            <Phone className="h-3 w-3" />
                            {person.phone}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {person.email ? (
                          <span className="flex items-center gap-1 text-sm">
                            <Mail className="h-3 w-3" />
                            {person.email}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => generatePortalLink(person)}
                                disabled={isGenerating || !person.ghl_user_id}
                              >
                                {isGenerating ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : isCopied ? (
                                  <Check className="h-4 w-4 text-emerald-500" />
                                ) : hasToken ? (
                                  <Copy className="h-4 w-4 text-primary" />
                                ) : (
                                  <Link2 className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {!person.ghl_user_id 
                                ? 'Link to calendar user first' 
                                : hasToken 
                                  ? 'Copy portal link' 
                                  : 'Generate portal link'}
                            </TooltipContent>
                          </Tooltip>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEdit(person)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => {
                              if (confirm('Delete this salesperson?')) {
                                deleteMutation.mutate(person.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingSalesperson ? 'Edit Salesperson' : 'Add Salesperson'}
              </DialogTitle>
              <DialogDescription>
                {editingSalesperson 
                  ? 'Update salesperson contact information' 
                  : 'Add a new salesperson to the directory'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="John Smith"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="john@company.com"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {editingSalesperson ? 'Update' : 'Add'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Merge Duplicates Dialog */}
        <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Merge className="h-5 w-5" />
                Merge Duplicate Salespeople
              </DialogTitle>
              <DialogDescription>
                Select records to merge. Choose one as the primary record to keep, and the others will be merged into it.
                All project references will be updated to use the primary name.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-3 py-4">
              {salespeople.map((person) => {
                const isSelected = selectedForMerge.has(person.id);
                const isPrimary = primaryMergeId === person.id;
                
                return (
                  <div
                    key={person.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      isSelected ? 'border-primary bg-primary/5' : 'border-border'
                    }`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleMergeSelection(person.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{person.name}</p>
                      {person.ghl_user_id && (
                        <p className="text-xs text-muted-foreground">Linked to calendar</p>
                      )}
                    </div>
                    {isSelected && (
                      <Button
                        variant={isPrimary ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPrimaryMergeId(person.id)}
                        className="shrink-0"
                      >
                        {isPrimary ? 'Primary' : 'Set Primary'}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>

            {selectedForMerge.size >= 2 && primaryMergeId && (
              <div className="rounded-lg bg-muted p-3 text-sm">
                <p className="font-medium text-foreground">Merge Summary</p>
                <p className="text-muted-foreground mt-1">
                  Keep: <span className="text-foreground">{salespeople.find(s => s.id === primaryMergeId)?.name}</span>
                </p>
                <p className="text-muted-foreground">
                  Delete: {Array.from(selectedForMerge)
                    .filter(id => id !== primaryMergeId)
                    .map(id => salespeople.find(s => s.id === id)?.name)
                    .join(', ')}
                </p>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setMergeDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleMerge}
                disabled={selectedForMerge.size < 2 || !primaryMergeId || mergeMutation.isPending}
              >
                {mergeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Merge Records
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
