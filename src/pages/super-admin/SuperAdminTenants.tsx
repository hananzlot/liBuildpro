import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SuperAdminLayout } from '@/components/layout/SuperAdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Edit, Plus, RefreshCw, ChevronDown, Mail } from 'lucide-react';
import type { SubscriptionPlan, CompanySubscription, SubscriptionStatus } from '@/types/subscription';
import { AddCompanyDialog } from '@/components/subscription/AddCompanyDialog';
import { InviteCompanyAdminDialog } from '@/components/super-admin/InviteCompanyAdminDialog';
import { AVAILABLE_FEATURES } from '@/constants/features';

interface CompanyWithSubscription {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  corporation_id: string | null;
  subscription?: CompanySubscription & { plan?: SubscriptionPlan };
  user_count: number;
  corporation_name?: string;
}

export default function SuperAdminTenants() {
  const queryClient = useQueryClient();
  const [selectedCompany, setSelectedCompany] = useState<CompanyWithSubscription | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteCompany, setInviteCompany] = useState<{ id: string; name: string } | null>(null);
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    corporation_id: '' as string,
    plan_id: '',
    status: '' as SubscriptionStatus | '',
    billing_cycle: '' as 'monthly' | 'yearly' | '',
    current_period_end: '',
    max_users_override: '' as string,
    features_override: {} as Record<string, boolean>
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
            features_override: subscription.features_override as Record<string, boolean> | null,
            plan: subscription.plan as unknown as SubscriptionPlan
          } : undefined,
          user_count: countByCompany[company.id] || 0
        };
      });

      return result;
    },
  });

  // Fetch corporations
  const { data: corporations } = useQuery({
    queryKey: ['corporations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('corporations')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data;
    },
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
      featuresOverride: Record<string, boolean> | null;
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
            features_override: data.featuresOverride,
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
            max_users_override: data.maxUsersOverride,
            features_override: data.featuresOverride
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
    setFeaturesOpen(false);
    setEditForm({
      corporation_id: company.corporation_id || '',
      plan_id: company.subscription?.plan_id || '',
      status: company.subscription?.status || 'active',
      billing_cycle: company.subscription?.billing_cycle || 'monthly',
      current_period_end: company.subscription?.current_period_end 
        ? format(new Date(company.subscription.current_period_end), 'yyyy-MM-dd')
        : format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
      max_users_override: company.subscription?.max_users_override?.toString() || '',
      features_override: company.subscription?.features_override || {}
    });
    setIsEditDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedCompany || !editForm.plan_id || !editForm.status || !editForm.billing_cycle) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Update corporation_id on the company and cascade to users
    const newCorpId = editForm.corporation_id || null;
    if (newCorpId !== (selectedCompany.corporation_id || null)) {
      const { error: corpError } = await supabase
        .from('companies')
        .update({ corporation_id: newCorpId })
        .eq('id', selectedCompany.id);
      if (corpError) {
        toast.error('Failed to update corporation');
        return;
      }

      // Update all users associated with this company to match the new corporation_id
      const { error: usersError } = await supabase
        .from('profiles')
        .update({ corporation_id: newCorpId })
        .eq('company_id', selectedCompany.id);
      if (usersError) {
        console.error('Failed to update user corporation_ids:', usersError);
        toast.error('Corporation updated on company but failed to update users');
      }
    }

    const maxUsersOverride = editForm.max_users_override.trim() === '' 
      ? null 
      : parseInt(editForm.max_users_override);

    // Only include features_override if there are actual overrides
    const hasOverrides = Object.keys(editForm.features_override).length > 0;
    const featuresOverride = hasOverrides ? editForm.features_override : null;

    updateSubscription.mutate({
      companyId: selectedCompany.id,
      planId: editForm.plan_id,
      status: editForm.status as SubscriptionStatus,
      billingCycle: editForm.billing_cycle as 'monthly' | 'yearly',
      currentPeriodEnd: new Date(editForm.current_period_end).toISOString(),
      maxUsersOverride,
      featuresOverride,
      hasExistingSubscription: !!selectedCompany.subscription
    });
  };

  const toggleFeatureOverride = (featureKey: string) => {
    const selectedPlan = plans?.find(p => p.id === editForm.plan_id);
    const planHasFeature = selectedPlan?.features?.[featureKey] ?? false;
    const currentOverride = editForm.features_override[featureKey];
    
    setEditForm(prev => {
      const newOverrides = { ...prev.features_override };
      
      if (currentOverride === undefined) {
        // First click: override to opposite of plan
        newOverrides[featureKey] = !planHasFeature;
      } else if (currentOverride !== planHasFeature) {
        // Second click: remove override (use plan default)
        delete newOverrides[featureKey];
      } else {
        // Toggle the override
        newOverrides[featureKey] = !currentOverride;
      }
      
      return { ...prev, features_override: newOverrides };
    });
  };

  const getFeatureValue = (featureKey: string): boolean => {
    const selectedPlan = plans?.find(p => p.id === editForm.plan_id);
    const planHasFeature = selectedPlan?.features?.[featureKey] ?? false;
    const override = editForm.features_override[featureKey];
    return override !== undefined ? override : planHasFeature;
  };

  const isFeatureOverridden = (featureKey: string): boolean => {
    return editForm.features_override[featureKey] !== undefined;
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

  return (
    <SuperAdminLayout 
      title="Tenant Management" 
      description="Manage company subscriptions and billing"
    >
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-end gap-2">
          <Button onClick={() => setIsAddDialogOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Company
          </Button>
          <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['tenant-companies'] })} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

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
                    <TableHead>Corporation</TableHead>
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
                        {company.corporation_id ? (
                          <span className="text-sm">{corporations?.find(c => c.id === company.corporation_id)?.name || '—'}</span>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
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
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setInviteCompany({ id: company.id, name: company.name });
                              setIsInviteDialogOpen(true);
                            }}
                            title="Invite Admin"
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
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
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Edit Subscription Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedCompany?.subscription ? 'Edit' : 'Create'} Subscription
              </DialogTitle>
              <DialogDescription>
                {selectedCompany?.name}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Corporation</Label>
                <Select 
                  value={editForm.corporation_id || 'none'} 
                  onValueChange={(v) => setEditForm(prev => ({ ...prev, corporation_id: v === 'none' ? '' : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select corporation (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {corporations?.map((corp) => (
                      <SelectItem key={corp.id} value={corp.id}>
                        {corp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Plan</Label>
                <Select 
                  value={editForm.plan_id} 
                  onValueChange={(v) => setEditForm(prev => ({ ...prev, plan_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans?.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select 
                  value={editForm.status} 
                  onValueChange={(v) => setEditForm(prev => ({ ...prev, status: v as SubscriptionStatus }))}
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
                  onValueChange={(v) => setEditForm(prev => ({ ...prev, billing_cycle: v as 'monthly' | 'yearly' }))}
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
                <Label>Current Period End</Label>
                <Input 
                  type="date" 
                  value={editForm.current_period_end}
                  onChange={(e) => setEditForm(prev => ({ ...prev, current_period_end: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Max Users Override</Label>
                <Input 
                  type="text"
                  inputMode="numeric"
                  placeholder="Leave empty to use plan default"
                  value={editForm.max_users_override}
                  onChange={(e) => { const val = e.target.value; if (val === '' || /^\d*$/.test(val)) setEditForm(prev => ({ ...prev, max_users_override: val })); }}
                />
                <p className="text-xs text-muted-foreground">
                  Plan default: {plans?.find(p => p.id === editForm.plan_id)?.max_users === -1 
                    ? 'Unlimited' 
                    : plans?.find(p => p.id === editForm.plan_id)?.max_users || 'N/A'}
                </p>
              </div>

              {/* Feature Overrides */}
              <Collapsible open={featuresOpen} onOpenChange={setFeaturesOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    Feature Overrides
                    <ChevronDown className={`h-4 w-4 transition-transform ${featuresOpen ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4 space-y-3">
                  {editForm.plan_id && AVAILABLE_FEATURES.map((feature) => (
                    <div key={feature.key} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{feature.label}</span>
                        {isFeatureOverridden(feature.key) && (
                          <Badge variant="secondary" className="text-xs">
                            Overridden
                          </Badge>
                        )}
                      </div>
                      <Switch
                        checked={getFeatureValue(feature.key)}
                        onCheckedChange={() => toggleFeatureOverride(feature.key)}
                      />
                    </div>
                  ))}
                  {!editForm.plan_id && (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      Select a plan first to configure features
                    </p>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={updateSubscription.isPending}>
                {updateSubscription.isPending ? 'Saving...' : 'Save Changes'}
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

        {/* Invite Admin Dialog */}
        <InviteCompanyAdminDialog
          open={isInviteDialogOpen}
          onOpenChange={setIsInviteDialogOpen}
          company={inviteCompany}
        />
      </div>
    </SuperAdminLayout>
  );
}
