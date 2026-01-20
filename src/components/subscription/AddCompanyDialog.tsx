import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import type { SubscriptionPlan, SubscriptionStatus } from '@/types/subscription';

interface AddCompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plans: SubscriptionPlan[];
}

export function AddCompanyDialog({ open, onOpenChange, plans }: AddCompanyDialogProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    slug: '',
    email: '',
    phone: '',
    plan_id: '',
    status: 'active' as SubscriptionStatus,
    billing_cycle: 'monthly' as 'monthly' | 'yearly',
    period_days: '30'
  });

  const createCompany = useMutation({
    mutationFn: async () => {
      // Create company first
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: form.name,
          slug: form.slug.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
          email: form.email || null,
          phone: form.phone || null,
          is_active: true
        })
        .select()
        .single();

      if (companyError) throw companyError;

      // Create subscription if plan selected
      if (form.plan_id) {
        const periodDays = parseInt(form.period_days) || 30;
        const currentPeriodEnd = new Date();
        currentPeriodEnd.setDate(currentPeriodEnd.getDate() + periodDays);

        const { error: subError } = await supabase
          .from('company_subscriptions')
          .insert({
            company_id: companyData.id,
            plan_id: form.plan_id,
            status: form.status,
            billing_cycle: form.billing_cycle,
            current_period_start: new Date().toISOString(),
            current_period_end: currentPeriodEnd.toISOString()
          });

        if (subError) throw subError;
      }

      return companyData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-companies'] });
      toast.success('Company created successfully');
      onOpenChange(false);
      resetForm();
    },
    onError: (error: Error) => {
      console.error('Error creating company:', error);
      if (error.message.includes('duplicate')) {
        toast.error('A company with this slug already exists');
      } else {
        toast.error('Failed to create company');
      }
    }
  });

  const resetForm = () => {
    setForm({
      name: '',
      slug: '',
      email: '',
      phone: '',
      plan_id: '',
      status: 'active',
      billing_cycle: 'monthly',
      period_days: '30'
    });
  };

  const handleNameChange = (name: string) => {
    setForm(prev => ({
      ...prev,
      name,
      slug: name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    }));
  };

  const handleSubmit = () => {
    if (!form.name.trim()) {
      toast.error('Company name is required');
      return;
    }
    if (!form.slug.trim()) {
      toast.error('Company slug is required');
      return;
    }
    createCompany.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add New Company</DialogTitle>
          <DialogDescription>
            Create a new company and optionally assign a subscription plan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Company Name *</Label>
              <Input 
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Acme Inc."
              />
            </div>
            <div className="space-y-2">
              <Label>Slug *</Label>
              <Input 
                value={form.slug}
                onChange={(e) => setForm(prev => ({ ...prev, slug: e.target.value }))}
                placeholder="acme-inc"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input 
                type="email"
                value={form.email}
                onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="contact@acme.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input 
                value={form.phone}
                onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="(555) 123-4567"
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium mb-3">Subscription</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Plan</Label>
                <Select 
                  value={form.plan_id} 
                  onValueChange={(value) => setForm(prev => ({ ...prev, plan_id: value }))}
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
                  value={form.status} 
                  onValueChange={(value) => setForm(prev => ({ ...prev, status: value as SubscriptionStatus }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="trialing">Trialing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <Label>Billing Cycle</Label>
                <Select 
                  value={form.billing_cycle} 
                  onValueChange={(value) => setForm(prev => ({ ...prev, billing_cycle: value as 'monthly' | 'yearly' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Initial Period (days)</Label>
                <Input 
                  type="number"
                  value={form.period_days}
                  onChange={(e) => setForm(prev => ({ ...prev, period_days: e.target.value }))}
                  placeholder="30"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createCompany.isPending}>
            {createCompany.isPending ? 'Creating...' : 'Create Company'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
