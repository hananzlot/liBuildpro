import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';
import type { SubscriptionPlan, SubscriptionStatus } from '@/types/subscription';

interface AddCompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plans: SubscriptionPlan[];
}

export function AddCompanyDialog({ open, onOpenChange, plans }: AddCompanyDialogProps) {
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    name: '',
    slug: '',
    email: '',
    phone: '',
    corporation_id: '',
    plan_id: '',
    status: 'active' as SubscriptionStatus,
    billing_cycle: 'monthly' as 'monthly' | 'yearly',
    period_days: '30',
    // Admin user fields
    admin_email: '',
    admin_password: '',
    admin_name: ''
  });

  // Fetch corporations for dropdown
  const { data: corporations } = useQuery({
    queryKey: ['corporations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('corporations')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: open
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
          corporation_id: form.corporation_id || null,
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

      // Create admin user if email provided
      if (form.admin_email && form.admin_password) {
        const { error: userError } = await supabase.functions.invoke('create-user', {
          body: {
            email: form.admin_email,
            password: form.admin_password,
            fullName: form.admin_name || form.admin_email.split('@')[0],
            companyId: companyData.id,
            role: 'admin'
          }
        });

        if (userError) {
          console.error('Error creating admin user:', userError);
          toast.error('Company created but failed to create admin user');
        }
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
      corporation_id: '',
      plan_id: '',
      status: 'active',
      billing_cycle: 'monthly',
      period_days: '30',
      admin_email: '',
      admin_password: '',
      admin_name: ''
    });
    setShowPassword(false);
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
    // Validate admin user if partially filled
    if ((form.admin_email && !form.admin_password) || (!form.admin_email && form.admin_password)) {
      toast.error('Both admin email and password are required to create an admin user');
      return;
    }
    if (form.admin_password && form.admin_password.length < 6) {
      toast.error('Admin password must be at least 6 characters');
      return;
    }
    createCompany.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Company</DialogTitle>
          <DialogDescription>
            Create a new company, assign a subscription, and optionally create an admin user.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Company Details */}
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

          <div className="space-y-2">
            <Label>Corporation (optional)</Label>
            <Select 
              value={form.corporation_id} 
              onValueChange={(value) => setForm(prev => ({ ...prev, corporation_id: value === 'none' ? '' : value }))}
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

          <Separator />

          {/* Subscription */}
          <div>
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
                  type="text"
                  inputMode="numeric"
                  value={form.period_days}
                  onChange={(e) => { const val = e.target.value; if (val === '' || /^\d+$/.test(val)) setForm(prev => ({ ...prev, period_days: val })); }}
                  placeholder="30"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Admin User */}
          <div>
            <h4 className="font-medium mb-3">Company Admin (optional)</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Create an admin user who can manage this company.
            </p>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Admin Email</Label>
                  <Input 
                    type="email"
                    value={form.admin_email}
                    onChange={(e) => setForm(prev => ({ ...prev, admin_email: e.target.value }))}
                    placeholder="admin@acme.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Admin Name</Label>
                  <Input 
                    value={form.admin_name}
                    onChange={(e) => setForm(prev => ({ ...prev, admin_name: e.target.value }))}
                    placeholder="John Doe"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Admin Password</Label>
                <div className="relative">
                  <Input 
                    type={showPassword ? 'text' : 'password'}
                    value={form.admin_password}
                    onChange={(e) => setForm(prev => ({ ...prev, admin_password: e.target.value }))}
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
