import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Mail, CheckCircle2, AlertCircle, Loader2, Copy, Trash2, RefreshCw } from 'lucide-react';

interface DnsRecord {
  type: string;
  name: string;
  value: string;
  status?: string;
  ttl?: string;
  priority?: number;
}

interface EmailDomainData {
  id: string;
  company_id: string;
  domain: string;
  resend_domain_id: string | null;
  verified: boolean;
  dns_records: DnsRecord[] | null;
  from_name: string | null;
  from_email: string | null;
  verified_at: string | null;
}

interface CompanyEmailDomainSetupProps {
  companyId: string;
}

export function CompanyEmailDomainSetup({ companyId }: CompanyEmailDomainSetupProps) {
  const queryClient = useQueryClient();
  const [newDomain, setNewDomain] = useState('');
  const [fromName, setFromName] = useState('');

  const { data: emailDomain, isLoading } = useQuery({
    queryKey: ['company-email-domain', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_email_domains')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle();

      if (error) throw error;
      return data as unknown as EmailDomainData | null;
    },
    enabled: !!companyId,
  });

  const registerMutation = useMutation({
    mutationFn: async ({ domain, fromName }: { domain: string; fromName: string }) => {
      const { data, error } = await supabase.functions.invoke('manage-email-domain', {
        body: { action: 'register', companyId, domain, fromName },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Registration failed');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-email-domain', companyId] });
      toast.success('Domain registered! Add the DNS records below to verify.');
      setNewDomain('');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to register domain');
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async () => {
      if (!emailDomain?.resend_domain_id) throw new Error('No domain to verify');
      const { data, error } = await supabase.functions.invoke('manage-email-domain', {
        body: { action: 'verify', companyId, resendDomainId: emailDomain.resend_domain_id },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Verification check failed');
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['company-email-domain', companyId] });
      if (data.verified) {
        toast.success('Domain verified! Emails will now be sent from your domain.');
      } else {
        toast.info(`Domain status: ${data.status}. DNS records may take up to 72 hours to propagate.`);
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Verification check failed');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!emailDomain?.resend_domain_id) throw new Error('No domain to delete');
      const { data, error } = await supabase.functions.invoke('manage-email-domain', {
        body: { action: 'delete', companyId, resendDomainId: emailDomain.resend_domain_id },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Deletion failed');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-email-domain', companyId] });
      toast.success('Domain removed');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to remove domain');
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading email domain settings...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          <CardTitle className="text-lg">Email Domain</CardTitle>
        </div>
        <CardDescription>
          Set up your company's email domain so emails are sent from your brand (e.g., noreply@yourcompany.com)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!emailDomain ? (
          /* Register new domain */
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="email_domain">Email Domain</Label>
              <Input
                id="email_domain"
                placeholder="yourcompany.com"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Enter the domain you want to send emails from (e.g., yourcompany.com)
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="from_name">From Name</Label>
              <Input
                id="from_name"
                placeholder="Your Company Name"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
              />
            </div>
            <Button
              onClick={() => registerMutation.mutate({ domain: newDomain.trim(), fromName: fromName.trim() })}
              disabled={registerMutation.isPending || !newDomain.trim()}
            >
              {registerMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Registering...
                </>
              ) : (
                'Register Domain'
              )}
            </Button>
          </div>
        ) : (
          /* Domain exists — show status and DNS records */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{emailDomain.domain}</p>
                <p className="text-sm text-muted-foreground">
                  Emails sent from: {emailDomain.from_email || `noreply@${emailDomain.domain}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {emailDomain.verified ? (
                  <Badge variant="default" className="bg-primary">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Verified
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Pending Verification
                  </Badge>
                )}
              </div>
            </div>

            {/* DNS Records */}
            {!emailDomain.verified && emailDomain.dns_records && emailDomain.dns_records.length > 0 && (
              <div className="space-y-3">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Add these DNS records at your domain registrar to verify ownership. DNS changes can take up to 72 hours to propagate.
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  {emailDomain.dns_records.map((record: DnsRecord, index: number) => (
                    <div key={index} className="border rounded-lg p-3 bg-muted/30 space-y-1">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs">{record.type}</Badge>
                        {record.status && (
                          <Badge variant={record.status === 'verified' ? 'default' : 'secondary'} className="text-xs">
                            {record.status}
                          </Badge>
                        )}
                      </div>
                      <div className="grid gap-1 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Host:</span>
                          <div className="flex items-center gap-1">
                            <code className="text-xs bg-background px-1.5 py-0.5 rounded max-w-[300px] truncate">{record.name}</code>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(record.name)}>
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Value:</span>
                          <div className="flex items-center gap-1">
                            <code className="text-xs bg-background px-1.5 py-0.5 rounded max-w-[300px] truncate">{record.value}</code>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(record.value)}>
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        {record.priority !== undefined && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Priority:</span>
                            <code className="text-xs bg-background px-1.5 py-0.5 rounded">{record.priority}</code>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              {!emailDomain.verified && (
                <Button
                  variant="outline"
                  onClick={() => verifyMutation.mutate()}
                  disabled={verifyMutation.isPending}
                >
                  {verifyMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Check Verification
                    </>
                  )}
                </Button>
              )}
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (confirm('Remove this email domain? Emails will fall back to platform defaults.')) {
                    deleteMutation.mutate();
                  }
                }}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remove Domain
              </Button>
            </div>

            {emailDomain.verified && (
              <p className="text-sm text-primary flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />
                All business emails (proposals, portal notifications, etc.) will be sent from{' '}
                <strong>{emailDomain.from_email || `noreply@${emailDomain.domain}`}</strong>
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
