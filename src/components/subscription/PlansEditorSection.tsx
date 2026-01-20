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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Edit, Plus, Package } from 'lucide-react';
import type { SubscriptionPlan } from '@/types/subscription';
import { AVAILABLE_FEATURES } from '@/constants/features';

export function PlansEditorSection() {
  const queryClient = useQueryClient();
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isNewPlan, setIsNewPlan] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    slug: '',
    description: '',
    price_monthly: '',
    price_yearly: '',
    max_users: '',
    features: {} as Record<string, boolean>,
    is_active: true,
    sort_order: ''
  });

  // Fetch all plans
  const { data: plans, isLoading } = useQuery({
    queryKey: ['all-subscription-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('sort_order');

      if (error) throw error;
      return data as SubscriptionPlan[];
    }
  });

  // Save plan mutation
  const savePlan = useMutation({
    mutationFn: async (data: {
      id?: string;
      name: string;
      slug: string;
      description: string | null;
      price_monthly: number;
      price_yearly: number;
      max_users: number;
      features: Record<string, boolean>;
      is_active: boolean;
      sort_order: number;
    }) => {
      if (data.id) {
        // Update existing
        const { error } = await supabase
          .from('subscription_plans')
          .update({
            name: data.name,
            slug: data.slug,
            description: data.description,
            price_monthly: data.price_monthly,
            price_yearly: data.price_yearly,
            max_users: data.max_users,
            features: data.features,
            is_active: data.is_active,
            sort_order: data.sort_order,
            updated_at: new Date().toISOString()
          })
          .eq('id', data.id);

        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from('subscription_plans')
          .insert({
            name: data.name,
            slug: data.slug,
            description: data.description,
            price_monthly: data.price_monthly,
            price_yearly: data.price_yearly,
            max_users: data.max_users,
            features: data.features,
            is_active: data.is_active,
            sort_order: data.sort_order
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-subscription-plans'] });
      queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
      toast.success(isNewPlan ? 'Plan created successfully' : 'Plan updated successfully');
      setIsEditDialogOpen(false);
      setSelectedPlan(null);
    },
    onError: (error: Error) => {
      console.error('Error saving plan:', error);
      if (error.message.includes('duplicate')) {
        toast.error('A plan with this slug already exists');
      } else {
        toast.error('Failed to save plan');
      }
    }
  });

  const handleEditClick = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    setIsNewPlan(false);
    setEditForm({
      name: plan.name,
      slug: plan.slug,
      description: plan.description || '',
      price_monthly: plan.price_monthly.toString(),
      price_yearly: plan.price_yearly.toString(),
      max_users: plan.max_users.toString(),
      features: plan.features || {},
      is_active: plan.is_active,
      sort_order: plan.sort_order.toString()
    });
    setIsEditDialogOpen(true);
  };

  const handleNewClick = () => {
    setSelectedPlan(null);
    setIsNewPlan(true);
    setEditForm({
      name: '',
      slug: '',
      description: '',
      price_monthly: '0',
      price_yearly: '0',
      max_users: '-1',
      features: {},
      is_active: true,
      sort_order: ((plans?.length || 0) + 1).toString()
    });
    setIsEditDialogOpen(true);
  };

  const handleNameChange = (name: string) => {
    setEditForm(prev => ({
      ...prev,
      name,
      slug: isNewPlan ? name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') : prev.slug
    }));
  };

  const toggleFeature = (featureKey: string) => {
    setEditForm(prev => ({
      ...prev,
      features: {
        ...prev.features,
        [featureKey]: !prev.features[featureKey]
      }
    }));
  };

  const handleSave = () => {
    if (!editForm.name || !editForm.slug) {
      toast.error('Name and slug are required');
      return;
    }

    savePlan.mutate({
      id: selectedPlan?.id,
      name: editForm.name,
      slug: editForm.slug,
      description: editForm.description || null,
      price_monthly: parseFloat(editForm.price_monthly) || 0,
      price_yearly: parseFloat(editForm.price_yearly) || 0,
      max_users: parseInt(editForm.max_users) || -1,
      features: editForm.features,
      is_active: editForm.is_active,
      sort_order: parseInt(editForm.sort_order) || 0
    });
  };

  const enabledFeatureCount = (features: Record<string, boolean>) => 
    Object.values(features).filter(Boolean).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Subscription Plans
            </CardTitle>
            <CardDescription>
              Configure pricing tiers, user limits, and feature access
            </CardDescription>
          </div>
          <Button onClick={handleNewClick} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Plan
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground">Loading...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Monthly</TableHead>
                <TableHead>Yearly</TableHead>
                <TableHead>Max Users</TableHead>
                <TableHead>Features</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans?.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{plan.name}</div>
                      <div className="text-sm text-muted-foreground">{plan.slug}</div>
                    </div>
                  </TableCell>
                  <TableCell>${plan.price_monthly}</TableCell>
                  <TableCell>${plan.price_yearly}</TableCell>
                  <TableCell>
                    {plan.max_users === -1 ? 'Unlimited' : plan.max_users}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {enabledFeatureCount(plan.features)} features
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={plan.is_active ? 'default' : 'outline'}>
                      {plan.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleEditClick(plan)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Edit Plan Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isNewPlan ? 'Create Plan' : 'Edit Plan'}</DialogTitle>
            <DialogDescription>
              {isNewPlan ? 'Create a new subscription plan' : `Modify ${selectedPlan?.name}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Plan Name *</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Professional"
                />
              </div>
              <div className="space-y-2">
                <Label>Slug *</Label>
                <Input
                  value={editForm.slug}
                  onChange={(e) => setEditForm(prev => ({ ...prev, slug: e.target.value }))}
                  placeholder="professional"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="For growing businesses..."
                rows={2}
              />
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Monthly Price ($)</Label>
                <Input
                  type="number"
                  value={editForm.price_monthly}
                  onChange={(e) => setEditForm(prev => ({ ...prev, price_monthly: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Yearly Price ($)</Label>
                <Input
                  type="number"
                  value={editForm.price_yearly}
                  onChange={(e) => setEditForm(prev => ({ ...prev, price_yearly: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Users (-1 = unlimited)</Label>
                <Input
                  type="number"
                  value={editForm.max_users}
                  onChange={(e) => setEditForm(prev => ({ ...prev, max_users: e.target.value }))}
                />
              </div>
            </div>

            {/* Features */}
            <div className="space-y-3">
              <Label>Features</Label>
              <div className="grid grid-cols-2 gap-3 p-4 border rounded-lg">
                {AVAILABLE_FEATURES.map((feature) => (
                  <div key={feature.key} className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium">{feature.label}</span>
                      <span className="text-xs text-muted-foreground ml-2">({feature.category})</span>
                    </div>
                    <Switch
                      checked={editForm.features[feature.key] || false}
                      onCheckedChange={() => toggleFeature(feature.key)}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <Label>Active</Label>
                <p className="text-sm text-muted-foreground">Inactive plans won't be shown to new customers</p>
              </div>
              <Switch
                checked={editForm.is_active}
                onCheckedChange={(checked) => setEditForm(prev => ({ ...prev, is_active: checked }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={savePlan.isPending}>
              {savePlan.isPending ? 'Saving...' : 'Save Plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
