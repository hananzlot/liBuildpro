import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Building2, Users, Calendar, DollarSign, Edit, Plus, RefreshCw } from 'lucide-react';
import type { SubscriptionPlan, CompanySubscription, SubscriptionStatus } from '@/types/subscription';
import { AddCompanyDialog } from '@/components/subscription/AddCompanyDialog';
import { PlatformUsersSection } from '@/components/subscription/PlatformUsersSection';
import { PlansEditorSection } from '@/components/subscription/PlansEditorSection';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface CompanyWithSubscription {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  subscription?: CompanySubscription & { plan?: SubscriptionPlan };
  user_count: number;
}

export default function TenantManagement() {
  const { isSuperAdmin, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [selectedCompany, setSelectedCompany] = useState<CompanyWithSubscription | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    plan_id: '',
    status: '' as SubscriptionStatus | '',
    billing_cycle: '' as 'monthly' | 'yearly' | '',
    current_period_end: '',
    max_users_override: '' as string
  });

  // Fetch all companies with their subscriptions
  const { data: companies, isLoading: companiesLoading } = useQuery({
    queryKey: ['tenant-companies'],
    queryFn: async () => {
      // Fetch companies
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('*')
        .order('name');

      if (companiesError) throw companiesError;

      // Fetch subscriptions
      const { data: subscriptionsData, error: subscriptionsError } = await supabase
        .from('company_subscriptions')
        .select(`
          *,
          plan:subscription_plans(*)
        `);

      if (subscriptionsError) throw subscriptionsError;

      // Fetch user counts
      const { data: userCounts, error: userCountsError } = await supabase
        .from('profiles')
        .select('company_id');

      if (userCountsError) throw userCountsError;

      // Map user counts
      const countByCompany: Record<string, number> = {};
      userCounts?.forEach(profile => {
        if (profile.company_id) {
          countByCompany[profile.company_id] = (countByCompany[profile.company_id] || 0) + 1;
        }
      });

      // Combine data
      const result: CompanyWithSubscription[] = companiesData.map(company => {
        const subscription = subscriptionsData?.find(sub => sub.company_id === company.id);
        return {
          ...company,
          subscription: subscription ? {
            ...subscription,
            status: subscription.status as SubscriptionStatus,
            billing_cycle: subscription.billing_cycle as 'monthly' | 'yearly',
            plan: subscription.plan as unknown as SubscriptionPlan
          } : undefined,
          user_count: countByCompany[company.id] || 0
        };
      });

      return result;
    },
    enabled: isSuperAdmin
  });

  // Fetch all plans for the dropdown
  const { data: plans } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      return data as SubscriptionPlan[];
    },
    enabled: isSuperAdmin
  });

  // Update subscription mutation
  const updateSubscription = useMutation({
    mutationFn: async (data: {
      companyId: string;
      planId: string;
      status: SubscriptionStatus;
      billingCycle: 'monthly' | 'yearly';
      currentPeriodEnd: string;
      maxUsersOverride: number | null;
      hasExistingSubscription: boolean;
    }) => {
      if (data.hasExistingSubscription) {
        const { error } = await supabase
          .from('company_subscriptions')
          .update({
            plan_id: data.planId,
            status: data.status,
            billing_cycle: data.billingCycle,
            current_period_end: data.currentPeriodEnd,
            max_users_override: data.maxUsersOverride,
            updated_at: new Date().toISOString()
          })
          .eq('company_id', data.companyId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('company_subscriptions')
          .insert({
            company_id: data.companyId,
            plan_id: data.planId,
            status: data.status,
            billing_cycle: data.billingCycle,
            current_period_start: new Date().toISOString(),
            current_period_end: data.currentPeriodEnd,
            max_users_override: data.maxUsersOverride
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-companies'] });
      toast.success('Subscription updated successfully');
      setIsEditDialogOpen(false);
      setSelectedCompany(null);
    },
    onError: (error) => {
      console.error('Error updating subscription:', error);
      toast.error('Failed to update subscription');
    }
  });

  const handleEditClick = (company: CompanyWithSubscription) => {
    setSelectedCompany(company);
    setEditForm({
      plan_id: company.subscription?.plan_id || '',
      status: company.subscription?.status || 'active',
      billing_cycle: company.subscription?.billing_cycle || 'monthly',
      current_period_end: company.subscription?.current_period_end 
        ? format(new Date(company.subscription.current_period_end), 'yyyy-MM-dd')
        : format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
      max_users_override: company.subscription?.max_users_override?.toString() || ''
    });
    setIsEditDialogOpen(true);
  };

  const handleSave = () => {
    if (!selectedCompany || !editForm.plan_id || !editForm.status || !editForm.billing_cycle) {
      toast.error('Please fill in all required fields');
      return;
    }

    const maxUsersOverride = editForm.max_users_override.trim() === '' 
      ? null 
      : parseInt(editForm.max_users_override);

    updateSubscription.mutate({
      companyId: selectedCompany.id,
      planId: editForm.plan_id,
      status: editForm.status as SubscriptionStatus,
      billingCycle: editForm.billing_cycle as 'monthly' | 'yearly',
      currentPeriodEnd: new Date(editForm.current_period_end).toISOString(),
      maxUsersOverride,
      hasExistingSubscription: !!selectedCompany.subscription
    });
  };

  const getStatusBadgeVariant = (status?: SubscriptionStatus) => {
    switch (status) {
      case 'active': return 'default';
      case 'trialing': return 'secondary';
      case 'past_due': return 'destructive';
      case 'canceled': return 'outline';
      case 'expired': return 'destructive';
      case 'paused': return 'secondary';
      default: return 'outline';
    }
  };

  // Calculate metrics
  const metrics = {
    totalCompanies: companies?.length || 0,
    activeSubscriptions: companies?.filter(c => c.subscription?.status === 'active').length || 0,
    totalUsers: companies?.reduce((sum, c) => sum + c.user_count, 0) || 0,
    mrr: companies?.reduce((sum, c) => {
      if (c.subscription?.status === 'active' && c.subscription.plan) {
        const price = c.subscription.billing_cycle === 'yearly' 
          ? c.subscription.plan.price_yearly / 12 
          : c.subscription.plan.price_monthly;
        return sum + price;
      }
      return sum;
    }, 0) || 0
  };

  if (!authLoading && !isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Tenant Management</h1>
            <p className="text-muted-foreground">Manage company subscriptions and billing</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setIsAddDialogOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Company
            </Button>
            <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['tenant-companies'] })} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Companies</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalCompanies}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.activeSubscriptions}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalUsers}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${metrics.mrr.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for different sections */}
        <Tabs defaultValue="companies" className="space-y-6">
          <TabsList>
            <TabsTrigger value="companies">Companies</TabsTrigger>
            <TabsTrigger value="plans">Plans</TabsTrigger>
            <TabsTrigger value="admins">Platform Admins</TabsTrigger>
          </TabsList>

          <TabsContent value="companies">
            {/* Companies Table */}
            <Card>
          <CardHeader>
            <CardTitle>Companies</CardTitle>
            <CardDescription>All registered companies and their subscription status</CardDescription>
          </CardHeader>
          <CardContent>
            {companiesLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading companies...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead>Billing</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies?.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{company.name}</div>
                          <div className="text-sm text-muted-foreground">{company.slug}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {company.subscription?.plan?.name || (
                          <span className="text-muted-foreground">No plan</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {company.subscription ? (
                          <Badge variant={getStatusBadgeVariant(company.subscription.status)}>
                            {company.subscription.status}
                          </Badge>
                        ) : (
                          <Badge variant="outline">No subscription</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span>{company.user_count}</span>
                          {(() => {
                            const limit = company.subscription?.max_users_override ?? company.subscription?.plan?.max_users;
                            if (limit && limit !== -1) {
                              return <span className="text-muted-foreground">/ {limit}</span>;
                            }
                            return null;
                          })()}
                        </div>
                      </TableCell>
                      <TableCell>
                        {company.subscription?.billing_cycle || '-'}
                      </TableCell>
                      <TableCell>
                        {company.subscription?.current_period_end 
                          ? format(new Date(company.subscription.current_period_end), 'MMM d, yyyy')
                          : '-'
                        }
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleEditClick(company)}
                        >
                          {company.subscription ? (
                            <Edit className="h-4 w-4" />
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="plans">
            <PlansEditorSection />
          </TabsContent>

          <TabsContent value="admins">
            <PlatformUsersSection />
          </TabsContent>
        </Tabs>

        {/* Edit Subscription Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {selectedCompany?.subscription ? 'Edit Subscription' : 'Create Subscription'}
              </DialogTitle>
              <DialogDescription>
                {selectedCompany?.subscription 
                  ? `Modify subscription for ${selectedCompany?.name}`
                  : `Create a new subscription for ${selectedCompany?.name}`
                }
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Plan</Label>
                <Select 
                  value={editForm.plan_id} 
                  onValueChange={(value) => setEditForm(prev => ({ ...prev, plan_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans?.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name} - ${plan.price_monthly}/mo
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select 
                  value={editForm.status} 
                  onValueChange={(value) => setEditForm(prev => ({ ...prev, status: value as SubscriptionStatus }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="trialing">Trialing</SelectItem>
                    <SelectItem value="past_due">Past Due</SelectItem>
                    <SelectItem value="canceled">Canceled</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Billing Cycle</Label>
                <Select 
                  value={editForm.billing_cycle} 
                  onValueChange={(value) => setEditForm(prev => ({ ...prev, billing_cycle: value as 'monthly' | 'yearly' }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select billing cycle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Period End Date</Label>
                <Input 
                  type="date" 
                  value={editForm.current_period_end}
                  onChange={(e) => setEditForm(prev => ({ ...prev, current_period_end: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Max Users Override</Label>
                <Input 
                  type="number"
                  placeholder="Leave empty to use plan default"
                  value={editForm.max_users_override}
                  onChange={(e) => setEditForm(prev => ({ ...prev, max_users_override: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Override the plan's user limit for this company. -1 = unlimited. Empty = use plan default.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={updateSubscription.isPending}>
                {updateSubscription.isPending ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Company Dialog */}
        <AddCompanyDialog 
          open={isAddDialogOpen} 
          onOpenChange={setIsAddDialogOpen}
          plans={plans || []}
        />
      </div>
    </AppLayout>
  );
}
