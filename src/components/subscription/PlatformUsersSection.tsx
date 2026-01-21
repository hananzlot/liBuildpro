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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Trash2, Shield, UserPlus, Eye, EyeOff, Pencil } from 'lucide-react';

interface PlatformUser {
  id: string;
  email: string;
  full_name: string | null;
  company_id: string | null;
  company_name?: string | null;
  roles: string[];
}

interface Company {
  id: string;
  name: string;
}

export function PlatformUsersSection() {
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<PlatformUser | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    email: '',
    password: '',
    full_name: '',
    company_id: ''
  });
  const [editForm, setEditForm] = useState({
    full_name: '',
    company_id: ''
  });

  // Fetch all companies for the dropdown
  const { data: companies } = useQuery({
    queryKey: ['all-companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as Company[];
    }
  });

  // Fetch all super admins (users with super_admin role)
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

      // Get company names
      const companyIds = profiles?.map(p => p.company_id).filter(Boolean) || [];
      let companyNames: Record<string, string> = {};
      
      if (companyIds.length > 0) {
        const { data: companiesData } = await supabase
          .from('companies')
          .select('id, name')
          .in('id', companyIds);
        
        companiesData?.forEach(c => {
          companyNames[c.id] = c.name;
        });
      }

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
        company_name: p.company_id ? companyNames[p.company_id] : null,
        roles: rolesByUser[p.id] || []
      })) as PlatformUser[];
    }
  });

  // Create new super admin
  const createSuperAdmin = useMutation({
    mutationFn: async (data: { email: string; password: string; full_name: string; company_id: string }) => {
      // Call edge function to create user
      const { data: result, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: data.email,
          password: data.password,
          fullName: data.full_name,
          role: 'super_admin',
          companyId: data.company_id || null
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
      setNewUserForm({ email: '', password: '', full_name: '', company_id: '' });
      setShowPassword(false);
    },
    onError: (error: Error) => {
      console.error('Error creating super admin:', error);
      toast.error(error.message || 'Failed to create super admin');
    }
  });

  // Update super admin profile
  const updateSuperAdmin = useMutation({
    mutationFn: async (data: { userId: string; full_name: string; company_id: string | null }) => {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: data.full_name,
          company_id: data.company_id
        })
        .eq('id', data.userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-users'] });
      toast.success('Super admin updated successfully');
      setIsEditDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error: Error) => {
      console.error('Error updating super admin:', error);
      toast.error('Failed to update super admin');
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
    if (newUserForm.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    createSuperAdmin.mutate(newUserForm);
  };

  const handleEditClick = (user: PlatformUser) => {
    setSelectedUser(user);
    setEditForm({
      full_name: user.full_name || '',
      company_id: user.company_id || ''
    });
    setIsEditDialogOpen(true);
  };

  const handleEditSubmit = () => {
    if (!selectedUser) return;
    updateSuperAdmin.mutate({
      userId: selectedUser.id,
      full_name: editForm.full_name,
      company_id: editForm.company_id || null
    });
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
                      <Badge variant="outline">{user.company_name || 'Unknown'}</Badge>
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
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditClick(user)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
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
                    </div>
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
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Minimum 6 characters"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Assign to Company (optional)</Label>
              <Select 
                value={newUserForm.company_id} 
                onValueChange={(value) => setNewUserForm(prev => ({ ...prev, company_id: value === 'none' ? '' : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Platform Only (no company)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Platform Only</SelectItem>
                  {companies?.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                If assigned, user can also see that company's data
              </p>
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

      {/* Edit Super Admin Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Super Admin</DialogTitle>
            <DialogDescription>
              Update {selectedUser?.email}'s profile information.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={selectedUser?.email || ''}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Email cannot be changed
              </p>
            </div>
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                value={editForm.full_name}
                onChange={(e) => setEditForm(prev => ({ ...prev, full_name: e.target.value }))}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label>Assign to Company</Label>
              <Select 
                value={editForm.company_id || 'none'} 
                onValueChange={(value) => setEditForm(prev => ({ ...prev, company_id: value === 'none' ? '' : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Platform Only (no company)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Platform Only</SelectItem>
                  {companies?.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                If assigned, user can also see that company's data
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditSubmit} disabled={updateSuperAdmin.isPending}>
              {updateSuperAdmin.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
