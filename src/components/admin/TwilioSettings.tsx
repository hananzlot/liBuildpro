import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompanyContext } from '@/hooks/useCompanyContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Phone, Loader2, Check, ExternalLink, Copy } from 'lucide-react';
import { toast } from 'sonner';

export function TwilioSettings() {
  const queryClient = useQueryClient();
  const { companyId } = useCompanyContext();
  const [accountSid, setAccountSid] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showForm, setShowForm] = useState(false);

  // Fetch current Twilio config
  const { data: twilioConfig, isLoading } = useQuery({
    queryKey: ['twilio-config', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data } = await supabase
        .from('company_settings')
        .select('setting_key, setting_value')
        .eq('company_id', companyId)
        .in('setting_key', ['twilio_account_sid', 'twilio_phone_number']);
      
      const config: Record<string, string> = {};
      data?.forEach(s => {
        config[s.setting_key] = s.setting_value || '';
      });
      return config;
    },
    enabled: !!companyId,
  });

  const isConfigured = twilioConfig?.twilio_account_sid && twilioConfig?.twilio_phone_number;

  // Get webhook URL
  const webhookUrl = `https://mspujwrfhbobrxhofxzv.supabase.co/functions/v1/twilio-sms-webhook`;

  // Save Twilio config
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('No company selected');
      
      const settings = [
        { setting_key: 'twilio_account_sid', setting_value: accountSid },
        { setting_key: 'twilio_auth_token', setting_value: authToken },
        { setting_key: 'twilio_phone_number', setting_value: phoneNumber },
      ];

      for (const setting of settings) {
        const { error } = await supabase
          .from('company_settings')
          .upsert({
            company_id: companyId,
            setting_key: setting.setting_key,
            setting_value: setting.setting_value,
            setting_type: 'secret',
            updated_at: new Date().toISOString(),
          }, { onConflict: 'company_id,setting_key' });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Twilio settings saved!');
      setShowForm(false);
      setAccountSid('');
      setAuthToken('');
      setPhoneNumber('');
      queryClient.invalidateQueries({ queryKey: ['twilio-config', companyId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Remove Twilio config
  const removeMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('No company selected');
      
      const { error } = await supabase
        .from('company_settings')
        .delete()
        .eq('company_id', companyId)
        .in('setting_key', ['twilio_account_sid', 'twilio_auth_token', 'twilio_phone_number']);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Twilio configuration removed');
      queryClient.invalidateQueries({ queryKey: ['twilio-config', companyId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success('Webhook URL copied!');
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          SMS Integration (Twilio)
        </CardTitle>
        <CardDescription>
          Enable customers to send you text messages that appear in the portal chat
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConfigured && !showForm ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="gap-1">
                <Check className="h-3 w-3" />
                Connected
              </Badge>
              <span className="text-sm text-muted-foreground">
                {twilioConfig.twilio_phone_number}
              </span>
            </div>
            
            <div className="p-3 bg-muted rounded-lg space-y-2">
              <Label className="text-xs font-medium">Webhook URL (configure in Twilio Console)</Label>
              <div className="flex gap-2">
                <Input 
                  value={webhookUrl} 
                  readOnly 
                  className="text-xs font-mono"
                />
                <Button variant="outline" size="sm" onClick={copyWebhookUrl}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Set this as the webhook URL for incoming messages on your Twilio phone number.
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
                Update Credentials
              </Button>
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={() => removeMutation.mutate()}
                disabled={removeMutation.isPending}
              >
                {removeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Disconnect'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg text-sm space-y-2">
              <p className="font-medium">Setup Instructions:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs">
                <li>Sign up or log in to <a href="https://console.twilio.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Twilio Console <ExternalLink className="h-3 w-3 inline" /></a></li>
                <li>Find your Account SID and Auth Token on the dashboard</li>
                <li>Purchase a phone number with SMS capability</li>
                <li>Enter the credentials below</li>
                <li>After saving, configure the webhook URL in Twilio</li>
              </ol>
            </div>

            <div className="space-y-3">
              <div>
                <Label htmlFor="account-sid">Account SID</Label>
                <Input
                  id="account-sid"
                  value={accountSid}
                  onChange={(e) => setAccountSid(e.target.value)}
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                />
              </div>
              <div>
                <Label htmlFor="auth-token">Auth Token</Label>
                <Input
                  id="auth-token"
                  type="password"
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  placeholder="Your Twilio Auth Token"
                />
              </div>
              <div>
                <Label htmlFor="phone-number">Twilio Phone Number</Label>
                <Input
                  id="phone-number"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+1234567890"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Include country code (e.g., +1 for US)
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={() => saveMutation.mutate()}
                disabled={!accountSid || !authToken || !phoneNumber || saveMutation.isPending}
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Save Configuration
              </Button>
              {isConfigured && (
                <Button variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
