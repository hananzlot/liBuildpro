import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompanyContext } from '@/hooks/useCompanyContext';
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
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2, UserCircle, Phone, Mail } from 'lucide-react';

interface Salesperson {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function SalespeopleManagement() {
  const queryClient = useQueryClient();
  const { companyId } = useCompanyContext();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSalesperson, setEditingSalesperson] = useState<Salesperson | null>(null);
  const [formData, setFormData] = useState({ name: '', phone: '', email: '' });

  const { data: salespeople = [], isLoading } = useQuery({
    queryKey: ['salespeople', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salespeople')
        .select('*')
        .eq('company_id', companyId)
        .order('name');
      if (error) throw error;
      return data as Salesperson[];
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCircle className="h-5 w-5" />
          Salespeople Directory
        </CardTitle>
        <CardDescription>
          Manage salesperson contact information displayed in customer portals
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Salesperson
          </Button>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {salespeople.map((person) => (
                <TableRow key={person.id}>
                  <TableCell className="font-medium">{person.name}</TableCell>
                  <TableCell>
                    {person.phone ? (
                      <span className="flex items-center gap-1 text-sm">
                        <Phone className="h-3 w-3" />
                        {person.phone}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
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
              ))}
            </TableBody>
          </Table>
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
      </CardContent>
    </Card>
  );
}
