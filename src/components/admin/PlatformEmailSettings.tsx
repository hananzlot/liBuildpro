import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Mail, AlertCircle, ExternalLink, CheckCircle2, Loader2 } from 'lucide-react';

interface EmailSettings {
  platform_resend_from_email: string;
  platform_resend_from_name: string;
  platform_support_email: string;
  platform_logo_url: string;
  platform_auth_emails_enabled: boolean;
}

export function PlatformEmailSettings() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<EmailSettings>({
    platform_resend_from_email: '',
    platform_resend_from_name: '',
    platform_support_email: '',
    platform_logo_url: '',
    platform_auth_emails_enabled: false,
  });
  const [isTesting, setIsTesting] = useState(false);

  // Fetch current settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['platform-email-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_key, setting_value')
        .in('setting_key', [
          'platform_resend_from_email',
          'platform_resend_from_name',
          'platform_support_email',
          'platform_logo_url',
          'platform_auth_emails_enabled'
        ]);

      if (error) throw error;

      const settingsMap: Record<string, string> = {};
      data?.forEach(row => {
        settingsMap[row.setting_key] = row.setting_value || '';
      });

      return {
        platform_resend_from_email: settingsMap['platform_resend_from_email'] || '',
        platform_resend_from_name: settingsMap['platform_resend_from_name'] || '',
        platform_support_email: settingsMap['platform_support_email'] || '',
        platform_logo_url: settingsMap['platform_logo_url'] || '',
        platform_auth_emails_enabled: settingsMap['platform_auth_emails_enabled'] === 'true',
      };
    }
  });

  // Update form when settings load
  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  // Save settings mutation
  const saveMutation = useMutation({
    mutationFn: async (data: EmailSettings) => {
      const updates = [
        { setting_key: 'platform_resend_from_email', setting_value: data.platform_resend_from_email },
        { setting_key: 'platform_resend_from_name', setting_value: data.platform_resend_from_name },
        { setting_key: 'platform_support_email', setting_value: data.platform_support_email },
        { setting_key: 'platform_logo_url', setting_value: data.platform_logo_url },
        { setting_key: 'platform_auth_emails_enabled', setting_value: data.platform_auth_emails_enabled ? 'true' : 'false' },
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from('app_settings')
          .update({ setting_value: update.setting_value, updated_at: new Date().toISOString() })
          .eq('setting_key', update.setting_key);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-email-settings'] });
      toast.success('Email settings saved');
    },
    onError: (error) => {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    }
  });

  const handleSave = () => {
    if (formData.platform_auth_emails_enabled && !formData.platform_resend_from_email) {
      toast.error('From email is required when auth emails are enabled');
      return;
    }
    saveMutation.mutate(formData);
  };

  const handleTestEmail = async () => {
    if (!formData.platform_resend_from_email) {
      toast.error('Please configure a from email first');
      return;
    }

    setIsTesting(true);
    try {
      // Get current user's email
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        toast.error('Could not determine your email address');
        return;
      }

      // Call the edge function directly for testing
      const { data, error } = await supabase.functions.invoke('send-auth-email', {
        body: {
          user: {
            id: user.id,
            email: user.email,
            user_metadata: { full_name: 'Test User' }
          },
          email_data: {
            token: '123456',
            email_action_type: 'signup',
            confirmation_url: window.location.origin,
          }
        }
      });

      if (error) throw error;
      toast.success(`Test email sent to ${user.email}`);
    } catch (error) {
      console.error('Test email error:', error);
      toast.error('Failed to send test email. Check console for details.');
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading email settings...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            <CardTitle>Platform Auth Email Settings</CardTitle>
          </div>
          <CardDescription>
            Configure Resend to send branded authentication emails (signup confirmations, password resets, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
            <div>
              <Label className="text-base font-medium">Enable Custom Auth Emails</Label>
              <p className="text-sm text-muted-foreground">
                When enabled, auth emails will be sent via Resend instead of Supabase defaults
              </p>
            </div>
            <Switch
              checked={formData.platform_auth_emails_enabled}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, platform_auth_emails_enabled: checked }))}
            />
          </div>

          {/* Settings Form */}
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="from_email">From Email *</Label>
              <Input
                id="from_email"
                type="email"
                placeholder="noreply@yourdomain.com"
                value={formData.platform_resend_from_email}
                onChange={(e) => setFormData(prev => ({ ...prev, platform_resend_from_email: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Must be a verified domain in Resend. <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="underline">Verify domain →</a>
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="from_name">From Name</Label>
              <Input
                id="from_name"
                placeholder="Your App Name"
                value={formData.platform_resend_from_name}
                onChange={(e) => setFormData(prev => ({ ...prev, platform_resend_from_name: e.target.value }))}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="support_email">Support Email</Label>
              <Input
                id="support_email"
                type="email"
                placeholder="support@yourdomain.com"
                value={formData.platform_support_email}
                onChange={(e) => setFormData(prev => ({ ...prev, platform_support_email: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Shown in email footers for user support
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="logo_url">Logo URL</Label>
              <Input
                id="logo_url"
                type="url"
                placeholder="https://yourdomain.com/logo.png"
                value={formData.platform_logo_url}
                onChange={(e) => setFormData(prev => ({ ...prev, platform_logo_url: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Logo displayed at the top of auth emails (max-height: 60px)
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
            </Button>
            <Button 
              variant="outline" 
              onClick={handleTestEmail}
              disabled={isTesting || !formData.platform_resend_from_email}
            >
              {isTesting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Test Email'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Setup Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Setup Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Supabase Auth Hook Required</AlertTitle>
            <AlertDescription className="mt-2 space-y-2">
              <p>To complete setup, you need to configure the Auth Hook in your Supabase dashboard:</p>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>Go to <strong>Authentication → Hooks</strong> in Supabase dashboard</li>
                <li>Enable the <strong>"Send Email"</strong> hook</li>
                <li>Select the <strong>send-auth-email</strong> function</li>
                <li>Copy the generated <strong>Hook Secret</strong></li>
                <li>Add it to Edge Function secrets as <code className="bg-muted px-1 py-0.5 rounded">SEND_EMAIL_HOOK_SECRET</code></li>
              </ol>
              <div className="flex gap-2 mt-3">
                <a 
                  href="https://supabase.com/dashboard/project/mspujwrfhbobrxhofxzv/auth/hooks"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  Open Auth Hooks <ExternalLink className="h-3 w-3" />
                </a>
                <span className="text-muted-foreground">|</span>
                <a 
                  href="https://supabase.com/dashboard/project/mspujwrfhbobrxhofxzv/settings/functions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  Edge Function Secrets <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </AlertDescription>
          </Alert>

          <div className="text-sm text-muted-foreground">
            <p className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              RESEND_API_KEY is already configured
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
