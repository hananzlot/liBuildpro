import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus, Trash2, Shield, UserPlus } from 'lucide-react';

interface PlatformUser {
  id: string;
  email: string;
  full_name: string | null;
  company_id: string | null;
  roles: string[];
}

export function PlatformUsersSection() {
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    email: '',
    password: '',
    full_name: ''
  });

  // Fetch all super admins (users with super_admin role and no company)
  const { data: platformUsers, isLoading } = useQuery({
    queryKey: ['platform-users'],
    queryFn: async () => {
      // Get all users with super_admin role
      const { data: superAdminRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'super_admin');

      if (rolesError) throw rolesError;

      const userIds = superAdminRoles?.map(r => r.user_id) || [];
      
      if (userIds.length === 0) return [];

      // Get profiles for these users
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name, company_id')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Get all roles for each user
      const { data: allRoles, error: allRolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      if (allRolesError) throw allRolesError;

      const rolesByUser: Record<string, string[]> = {};
      allRoles?.forEach(r => {
        if (!rolesByUser[r.user_id]) rolesByUser[r.user_id] = [];
        rolesByUser[r.user_id].push(r.role);
      });

      return profiles?.map(p => ({
        ...p,
        roles: rolesByUser[p.id] || []
      })) as PlatformUser[];
    }
  });

  // Create new super admin
  const createSuperAdmin = useMutation({
    mutationFn: async (data: { email: string; password: string; full_name: string }) => {
      // Call edge function to create user
      const { data: result, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: data.email,
          password: data.password,
          full_name: data.full_name,
          role: 'super_admin',
          company_id: null // No company for platform users
        }
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-users'] });
      toast.success('Super admin created successfully');
      setIsAddDialogOpen(false);
      setNewUserForm({ email: '', password: '', full_name: '' });
    },
    onError: (error: Error) => {
      console.error('Error creating super admin:', error);
      toast.error(error.message || 'Failed to create super admin');
    }
  });

  // Remove super admin role
  const removeSuperAdminRole = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', 'super_admin');

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-users'] });
      toast.success('Super admin role removed');
    },
    onError: (error) => {
      console.error('Error removing role:', error);
      toast.error('Failed to remove super admin role');
    }
  });

  const handleSubmit = () => {
    if (!newUserForm.email || !newUserForm.password) {
      toast.error('Email and password are required');
      return;
    }
    createSuperAdmin.mutate(newUserForm);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Platform Administrators
            </CardTitle>
            <CardDescription>
              Super admins with full platform access (not tied to any company)
            </CardDescription>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)} size="sm">
            <UserPlus className="h-4 w-4 mr-2" />
            Add Super Admin
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground">Loading...</div>
        ) : platformUsers && platformUsers.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {platformUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.full_name || 'No name'}
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    {user.company_id ? (
                      <Badge variant="outline">Has Company</Badge>
                    ) : (
                      <Badge variant="secondary">Platform Only</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {user.roles.map((role) => (
                        <Badge key={role} variant={role === 'super_admin' ? 'default' : 'outline'}>
                          {role}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm('Remove super admin role from this user?')) {
                          removeSuperAdminRole.mutate(user.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No platform administrators found
          </div>
        )}
      </CardContent>

      {/* Add Super Admin Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Super Admin</DialogTitle>
            <DialogDescription>
              Create a new platform administrator with full access to all companies.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                value={newUserForm.full_name}
                onChange={(e) => setNewUserForm(prev => ({ ...prev, full_name: e.target.value }))}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={newUserForm.email}
                onChange={(e) => setNewUserForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="admin@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Password *</Label>
              <Input
                type="password"
                value={newUserForm.password}
                onChange={(e) => setNewUserForm(prev => ({ ...prev, password: e.target.value }))}
                placeholder="••••••••"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={createSuperAdmin.isPending}>
              {createSuperAdmin.isPending ? 'Creating...' : 'Create Super Admin'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
