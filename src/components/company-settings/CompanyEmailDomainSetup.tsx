import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Mail, CheckCircle2, AlertCircle, Loader2, Copy, Trash2, RefreshCw, Send, Globe, ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

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

// Map NS patterns to registrar info
const REGISTRAR_MAP: { pattern: RegExp; name: string; dnsUrl: string }[] = [
  { pattern: /cloudflare/i, name: 'Cloudflare', dnsUrl: 'https://dash.cloudflare.com/' },
  { pattern: /godaddy|domaincontrol/i, name: 'GoDaddy', dnsUrl: 'https://dcc.godaddy.com/manage-dns' },
  { pattern: /namecheap/i, name: 'Namecheap', dnsUrl: 'https://ap.www.namecheap.com/domains/domaincontrolpanel/' },
  { pattern: /google|googledomains/i, name: 'Google Domains', dnsUrl: 'https://domains.google.com/registrar/' },
  { pattern: /squarespace/i, name: 'Squarespace Domains', dnsUrl: 'https://account.squarespace.com/domains/' },
  { pattern: /awsdns|amazonaws/i, name: 'AWS Route 53', dnsUrl: 'https://console.aws.amazon.com/route53/v2/hostedzones' },
  { pattern: /azure-dns|microsoft/i, name: 'Azure DNS', dnsUrl: 'https://portal.azure.com/#browse/Microsoft.Network%2FdnsZones' },
  { pattern: /digitalocean/i, name: 'DigitalOcean', dnsUrl: 'https://cloud.digitalocean.com/networking/domains' },
  { pattern: /hover/i, name: 'Hover', dnsUrl: 'https://www.hover.com/control_panel/domain/' },
  { pattern: /name\.com/i, name: 'Name.com', dnsUrl: 'https://www.name.com/account/domain' },
  { pattern: /hostgator/i, name: 'HostGator', dnsUrl: 'https://portal.hostgator.com/domain/manage' },
  { pattern: /bluehost/i, name: 'Bluehost', dnsUrl: 'https://my.bluehost.com/hosting/domains' },
  { pattern: /netlify/i, name: 'Netlify DNS', dnsUrl: 'https://app.netlify.com/dns' },
  { pattern: /vercel/i, name: 'Vercel', dnsUrl: 'https://vercel.com/dashboard/domains' },
  { pattern: /wix/i, name: 'Wix', dnsUrl: 'https://www.wix.com/my-account/domains' },
  { pattern: /dynadot/i, name: 'Dynadot', dnsUrl: 'https://www.dynadot.com/account/domain/name/server.html' },
  { pattern: /porkbun/i, name: 'Porkbun', dnsUrl: 'https://porkbun.com/account/domainsSpe498' },
  { pattern: /gandi/i, name: 'Gandi', dnsUrl: 'https://admin.gandi.net/domain/' },
  { pattern: /ionos|1and1/i, name: 'IONOS', dnsUrl: 'https://my.ionos.com/domains' },
  { pattern: /ovh/i, name: 'OVH', dnsUrl: 'https://www.ovh.com/manager/web/#/domain' },
  { pattern: /dreamhost/i, name: 'DreamHost', dnsUrl: 'https://panel.dreamhost.com/index.cgi?tree=domain.dns' },
];

async function detectRegistrar(domain: string): Promise<{ name: string; dnsUrl: string } | null> {
  try {
    // Use Google Public DNS API to look up NS records
    const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=NS`);
    if (!res.ok) return null;
    const data = await res.json();
    
    if (!data.Answer || data.Answer.length === 0) return null;
    
    const nsRecords = data.Answer
      .filter((a: { type: number }) => a.type === 2)
      .map((a: { data: string }) => a.data.toLowerCase());
    
    for (const ns of nsRecords) {
      for (const registrar of REGISTRAR_MAP) {
        if (registrar.pattern.test(ns)) {
          return { name: registrar.name, dnsUrl: registrar.dnsUrl };
        }
      }
    }
    
    return null;
  } catch {
    return null;
  }
}

export function CompanyEmailDomainSetup({ companyId }: CompanyEmailDomainSetupProps) {
  const queryClient = useQueryClient();
  const [newDomain, setNewDomain] = useState('');
  const [fromName, setFromName] = useState('');
  const [registrar, setRegistrar] = useState<{ name: string; dnsUrl: string } | null>(null);
  const [detectingRegistrar, setDetectingRegistrar] = useState(false);
  const [itEmail, setItEmail] = useState('');
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);

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

  // Auto-poll verification every 60 seconds when domain is pending
  const isPending = emailDomain && !emailDomain.verified;

  const autoVerify = useCallback(async () => {
    if (!emailDomain?.resend_domain_id || emailDomain.verified) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('manage-email-domain', {
        body: { action: 'verify', companyId, resendDomainId: emailDomain.resend_domain_id },
      });
      if (error) return;
      if (data?.verified) {
        queryClient.invalidateQueries({ queryKey: ['company-email-domain', companyId] });
        toast.success('🎉 Domain verified! Emails will now be sent from your domain.');
      } else {
        // Silently refresh DNS record statuses
        queryClient.invalidateQueries({ queryKey: ['company-email-domain', companyId] });
      }
    } catch {
      // Silent fail for auto-polling
    }
  }, [emailDomain?.resend_domain_id, emailDomain?.verified, companyId, queryClient]);

  useEffect(() => {
    if (!isPending) return;
    const interval = setInterval(autoVerify, 60000);
    return () => clearInterval(interval);
  }, [isPending, autoVerify]);

  // Detect registrar when domain is set
  useEffect(() => {
    if (!emailDomain?.domain || emailDomain.verified) {
      setRegistrar(null);
      return;
    }
    
    setDetectingRegistrar(true);
    detectRegistrar(emailDomain.domain).then((r) => {
      setRegistrar(r);
      setDetectingRegistrar(false);
    });
  }, [emailDomain?.domain, emailDomain?.verified]);

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

  const sendInstructionsMutation = useMutation({
    mutationFn: async (recipientEmail: string) => {
      const { data, error } = await supabase.functions.invoke('send-dns-instructions', {
        body: {
          recipientEmail,
          domain: emailDomain?.domain,
          dnsRecords: emailDomain?.dns_records,
          companyName: emailDomain?.from_name || emailDomain?.domain,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to send');
      return data;
    },
    onSuccess: () => {
      toast.success('DNS instructions sent!');
      setEmailDialogOpen(false);
      setItEmail('');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to send instructions');
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

            {/* Registrar Detection */}
            {!emailDomain.verified && (
              <div>
                {detectingRegistrar ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Detecting your DNS provider...
                  </div>
                ) : registrar ? (
                  <Alert className="border-primary/20 bg-primary/5">
                    <Globe className="h-4 w-4" />
                    <AlertDescription className="flex items-center justify-between">
                      <span>
                        We detected <strong>{registrar.name}</strong> as your DNS provider.
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="ml-2 shrink-0"
                        onClick={() => window.open(registrar.dnsUrl, '_blank')}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Open {registrar.name} DNS
                      </Button>
                    </AlertDescription>
                  </Alert>
                ) : null}
              </div>
            )}

            {/* DNS Records */}
            {!emailDomain.verified && emailDomain.dns_records && emailDomain.dns_records.length > 0 && (
              <div className="space-y-3">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Add these DNS records at your domain registrar to verify ownership. DNS changes can take up to 72 hours to propagate.
                    {isPending && (
                      <span className="block mt-1 text-xs text-muted-foreground">
                        ✓ Auto-checking verification every 60 seconds...
                      </span>
                    )}
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
            <div className="flex flex-wrap gap-2">
              {!emailDomain.verified && (
                <>
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

                  {/* Email to IT button */}
                  <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline">
                        <Send className="h-4 w-4 mr-2" />
                        Email Instructions to IT
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Send DNS Instructions</DialogTitle>
                        <DialogDescription>
                          Send the DNS records and setup instructions to your IT team or domain administrator.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label htmlFor="it_email">IT / Admin Email</Label>
                          <Input
                            id="it_email"
                            type="email"
                            placeholder="it@yourcompany.com"
                            value={itEmail}
                            onChange={(e) => setItEmail(e.target.value)}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          onClick={() => sendInstructionsMutation.mutate(itEmail.trim())}
                          disabled={!itEmail.trim() || sendInstructionsMutation.isPending}
                        >
                          {sendInstructionsMutation.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Sending...
                            </>
                          ) : (
                            <>
                              <Send className="h-4 w-4 mr-2" />
                              Send Instructions
                            </>
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </>
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
