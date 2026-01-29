import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { 
  Calendar, 
  RefreshCw, 
  Trash2, 
  Plus, 
  Check, 
  AlertCircle,
  ExternalLink,
  Loader2,
  ChevronDown,
  Save,
  Key
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { CalendarFieldMappings } from "./CalendarFieldMappings";

interface GoogleCalendarConnection {
  id: string;
  company_id: string;
  user_id: string | null;
  calendar_id: string;
  calendar_name: string;
  calendar_email: string;
  is_active: boolean;
  is_company_calendar: boolean;
  sync_direction: 'import' | 'export' | 'bidirectional';
  last_sync_at: string | null;
  sync_error: string | null;
  created_at: string;
}

export function GoogleCalendarManager() {
  const { user } = useAuth();
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [editedCredentials, setEditedCredentials] = useState<Record<string, string>>({});
  const [isSavingCredential, setIsSavingCredential] = useState<string | null>(null);

  // Fetch connections
  const { data: connections, isLoading } = useQuery({
    queryKey: ['google-calendar-connections', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('google_calendar_connections')
        .select('*')
        .eq('company_id', companyId)
        .order('is_company_calendar', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as GoogleCalendarConnection[];
    },
    enabled: !!companyId,
  });

  // Fetch Google OAuth credentials
  const { data: credentials } = useQuery({
    queryKey: ['google-credentials', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_settings')
        .select('setting_key, setting_value')
        .eq('company_id', companyId)
        .in('setting_key', ['google_client_id', 'google_client_secret']);

      if (error) throw error;
      return data as { setting_key: string; setting_value: string | null }[];
    },
    enabled: !!companyId,
  });

  // Check if Google credentials are configured
  const hasCredentials = credentials?.length === 2 && 
    credentials.every(c => c.setting_value && c.setting_value.length > 0);

  // Listen for OAuth callback messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'google-auth-success') {
        toast.success(`Connected to ${event.data.calendar.name}`);
        queryClient.invalidateQueries({ queryKey: ['google-calendar-connections'] });
        setIsConnecting(false);
      } else if (event.data.type === 'google-auth-error') {
        toast.error(`Failed to connect: ${event.data.error}`);
        setIsConnecting(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [queryClient]);

  // Delete connection mutation
  const deleteMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      const { error } = await supabase
        .from('google_calendar_connections')
        .delete()
        .eq('id', connectionId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Calendar disconnected');
      queryClient.invalidateQueries({ queryKey: ['google-calendar-connections'] });
    },
    onError: (error) => {
      toast.error(`Failed to disconnect: ${error.message}`);
    },
  });

  // Save credential mutation
  const saveCredentialMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { error } = await supabase
        .from('company_settings')
        .upsert({
          company_id: companyId,
          setting_key: key,
          setting_value: value,
          setting_type: 'secret',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'company_id,setting_key' });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.success(`${variables.key === 'google_client_id' ? 'Client ID' : 'Client Secret'} saved`);
      queryClient.invalidateQueries({ queryKey: ['google-credentials'] });
      setEditedCredentials(prev => {
        const next = { ...prev };
        delete next[variables.key];
        return next;
      });
    },
    onError: (error) => {
      toast.error(`Failed to save: ${error.message}`);
    },
    onSettled: () => {
      setIsSavingCredential(null);
    },
  });

  // Toggle active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('google_calendar_connections')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-calendar-connections'] });
    },
  });

  const handleConnect = (isCompanyCalendar: boolean) => {
    if (!hasCredentials) {
      toast.error('Please configure Google Client ID and Secret in the Custom tab first');
      return;
    }

    setIsConnecting(true);

    // Build OAuth URL
    const state = btoa(JSON.stringify({
      companyId,
      userId: isCompanyCalendar ? null : user?.id,
      isCompanyCalendar,
      redirectUrl: window.location.href,
    }));

    // Get client ID from settings (we already have it loaded)
    supabase
      .from('company_settings')
      .select('setting_value')
      .eq('company_id', companyId)
      .eq('setting_key', 'google_client_id')
      .single()
      .then(({ data }) => {
        if (!data?.setting_value) {
          toast.error('Google Client ID not configured');
          setIsConnecting(false);
          return;
        }

        const clientId = data.setting_value;
        const redirectUri = `${import.meta.env.VITE_SUPABASE_URL || 'https://mspujwrfhbobrxhofxzv.supabase.co'}/functions/v1/google-auth-callback`;

        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authUrl.searchParams.set('client_id', clientId);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/calendar');
        authUrl.searchParams.set('access_type', 'offline');
        authUrl.searchParams.set('prompt', 'consent');
        authUrl.searchParams.set('state', state);

        // Open popup
        const width = 500;
        const height = 600;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        window.open(
          authUrl.toString(),
          'google-auth',
          `width=${width},height=${height},left=${left},top=${top}`
        );
      });
  };

  const handleSync = async (connectionId: string) => {
    setIsSyncing(connectionId);
    try {
      const { data, error } = await supabase.functions.invoke('sync-google-calendar', {
        body: { connectionId },
      });

      if (error) throw error;

      const result = data.results?.[0];
      if (result?.error) {
        toast.error(`Sync failed: ${result.error}`);
      } else {
        const parts = [];
        if (result?.imported) parts.push(`${result.imported} imported`);
        if (result?.exported) parts.push(`${result.exported} exported`);
        if (result?.leadsCreated) parts.push(`${result.leadsCreated} leads created`);
        toast.success(`Synced: ${parts.length > 0 ? parts.join(', ') : 'No changes'}`);
      }

      queryClient.invalidateQueries({ queryKey: ['google-calendar-connections'] });
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['ghl-contacts'] });
    } catch (error) {
      toast.error(`Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSyncing(null);
    }
  };

  const getCredentialValue = (key: string) => {
    if (key in editedCredentials) return editedCredentials[key];
    return credentials?.find(c => c.setting_key === key)?.setting_value ?? '';
  };

  const hasCredentialChanges = (key: string) => {
    const original = credentials?.find(c => c.setting_key === key)?.setting_value ?? '';
    const edited = editedCredentials[key];
    return edited !== undefined && edited !== original;
  };

  const handleSaveCredential = async (key: string) => {
    const value = editedCredentials[key];
    if (value === undefined) return;
    setIsSavingCredential(key);
    saveCredentialMutation.mutate({ key, value });
  };

  if (isLoading) {
    return (
      <Collapsible defaultOpen={false} className="group">
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Google Calendar Integration
                </span>
                <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </CardTitle>
              <CardDescription>
                Connect Google Calendars for two-way appointment sync
              </CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    );
  }

  return (
    <Collapsible defaultOpen={false} className="group">
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Google Calendar Integration
              </span>
              <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </CardTitle>
            <CardDescription>
              Connect Google Calendars for two-way appointment sync
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-6 pt-0">
            {/* OAuth Credentials Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-medium">OAuth Credentials</h4>
              </div>
              <p className="text-xs text-muted-foreground">
                Configure Google OAuth credentials. Create these at{" "}
                <a 
                  href="https://console.cloud.google.com/apis/credentials" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  Google Cloud Console
                </a>
              </p>

              {/* Google Client ID */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="google_client_id">Google Client ID</Label>
                  {hasCredentialChanges("google_client_id") && (
                    <Button
                      size="sm"
                      onClick={() => handleSaveCredential("google_client_id")}
                      disabled={isSavingCredential === "google_client_id"}
                    >
                      {isSavingCredential === "google_client_id" ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Save className="h-3 w-3 mr-1" />
                      )}
                      Save
                    </Button>
                  )}
                </div>
                <Input
                  id="google_client_id"
                  type="password"
                  value={getCredentialValue("google_client_id")}
                  onChange={(e) => setEditedCredentials(prev => ({ ...prev, google_client_id: e.target.value }))}
                  placeholder="xxxxx.apps.googleusercontent.com"
                />
                <p className="text-xs text-muted-foreground">OAuth 2.0 Client ID from Google Cloud Console</p>
              </div>

              {/* Google Client Secret */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="google_client_secret">Google Client Secret</Label>
                  {hasCredentialChanges("google_client_secret") && (
                    <Button
                      size="sm"
                      onClick={() => handleSaveCredential("google_client_secret")}
                      disabled={isSavingCredential === "google_client_secret"}
                    >
                      {isSavingCredential === "google_client_secret" ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Save className="h-3 w-3 mr-1" />
                      )}
                      Save
                    </Button>
                  )}
                </div>
                <Input
                  id="google_client_secret"
                  type="password"
                  value={getCredentialValue("google_client_secret")}
                  onChange={(e) => setEditedCredentials(prev => ({ ...prev, google_client_secret: e.target.value }))}
                  placeholder="GOCSPX-..."
                />
                <p className="text-xs text-muted-foreground">OAuth 2.0 Client Secret from Google Cloud Console</p>
              </div>

              <div className="text-xs text-muted-foreground p-3 bg-muted rounded-lg">
                <p className="font-medium mb-1">Setup Instructions:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Go to the Google Cloud Console and create a project</li>
                  <li>Enable the Google Calendar API</li>
                  <li>Configure the OAuth consent screen</li>
                  <li>Create OAuth 2.0 credentials (Web application)</li>
                  <li>
                    Add this redirect URI:{' '}
                    <code className="bg-background px-1 py-0.5 rounded text-xs">
                      https://mspujwrfhbobrxhofxzv.supabase.co/functions/v1/google-auth-callback
                    </code>
                  </li>
                </ol>
              </div>
            </div>

            <Separator />

            {/* Calendar Connections Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Connected Calendars</h4>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleConnect(false)}
                    disabled={isConnecting || !hasCredentials}
                  >
                    {isConnecting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    Add Personal
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleConnect(true)}
                    disabled={isConnecting || !hasCredentials}
                  >
                    {isConnecting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    Add Company
                  </Button>
                </div>
              </div>

              {!hasCredentials && (
                <div className="p-4 rounded-lg border border-destructive/50 bg-destructive/10">
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-5 w-5" />
                    <span>Please configure OAuth credentials above first.</span>
                  </div>
                </div>
              )}

              {connections && connections.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                  <h4 className="text-lg font-medium mb-2">No calendars connected</h4>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Connect a Google Calendar to sync appointments. Company calendars are visible to all users,
                    while personal calendars are only visible to you.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {connections?.map((connection) => (
                    <div key={connection.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Calendar className="h-5 w-5 text-primary" />
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {connection.calendar_name}
                              {connection.is_company_calendar && (
                                <Badge variant="secondary" className="text-xs">Company</Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {connection.calendar_email}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={connection.is_active}
                            onCheckedChange={(checked) => 
                              toggleActiveMutation.mutate({ id: connection.id, isActive: checked })
                            }
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSync(connection.id)}
                            disabled={isSyncing === connection.id}
                          >
                            {isSyncing === connection.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Disconnect Calendar?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will stop syncing appointments with this calendar.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMutation.mutate(connection.id)}>
                                  Disconnect
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                      {connection.sync_error && (
                        <div className="mt-2 text-sm text-destructive flex items-center gap-1">
                          <AlertCircle className="h-4 w-4" />
                          {connection.sync_error}
                        </div>
                      )}
                      {connection.last_sync_at && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          Last synced: {new Date(connection.last_sync_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Field Mappings */}
            <CalendarFieldMappings />
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
