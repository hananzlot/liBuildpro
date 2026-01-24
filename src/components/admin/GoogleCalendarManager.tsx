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
import { toast } from "sonner";
import { 
  Calendar, 
  RefreshCw, 
  Trash2, 
  Plus, 
  Check, 
  AlertCircle,
  ExternalLink,
  Loader2
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

  // Check if Google credentials are configured
  const { data: hasCredentials } = useQuery({
    queryKey: ['google-credentials-check', companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from('company_settings')
        .select('setting_key')
        .eq('company_id', companyId)
        .in('setting_key', ['google_client_id', 'google_client_secret']);

      return data?.length === 2;
    },
    enabled: !!companyId,
  });

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
        toast.success(`Synced: ${result?.imported || 0} imported, ${result?.exported || 0} exported`);
      }

      queryClient.invalidateQueries({ queryKey: ['google-calendar-connections'] });
    } catch (error) {
      toast.error(`Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSyncing(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Google Calendar Integration</h3>
          <p className="text-sm text-muted-foreground">
            Connect Google Calendars for two-way appointment sync
          </p>
        </div>
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
            Add Personal Calendar
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
            Add Company Calendar
          </Button>
        </div>
      </div>

      {!hasCredentials && (
        <Card className="border-warning/50 bg-warning/10">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-warning-foreground">
              <AlertCircle className="h-5 w-5" />
              <span>
                Google API credentials not configured. Please add your Client ID and Secret in the{' '}
                <strong>Custom</strong> tab above.
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {connections && connections.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h4 className="text-lg font-medium mb-2">No calendars connected</h4>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Connect a Google Calendar to sync appointments. Company calendars are visible to all users,
              while personal calendars are only visible to you.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {connections?.map((connection) => (
            <Card key={connection.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-primary" />
                    <div>
                      <CardTitle className="text-base">{connection.calendar_name}</CardTitle>
                      <CardDescription>{connection.calendar_email}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={connection.is_company_calendar ? 'default' : 'secondary'}>
                      {connection.is_company_calendar ? 'Company' : 'Personal'}
                    </Badge>
                    {connection.is_active ? (
                      <Badge variant="outline" className="text-green-600 border-green-200">
                        <Check className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-gray-500">
                        Inactive
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {connection.last_sync_at ? (
                      <>Last synced: {new Date(connection.last_sync_at).toLocaleString()}</>
                    ) : (
                      <>Never synced</>
                    )}
                    {connection.sync_error && (
                      <span className="text-red-500 ml-2">• Error: {connection.sync_error}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 mr-4">
                      <Switch
                        id={`active-${connection.id}`}
                        checked={connection.is_active}
                        onCheckedChange={(checked) =>
                          toggleActiveMutation.mutate({ id: connection.id, isActive: checked })
                        }
                      />
                      <Label htmlFor={`active-${connection.id}`} className="text-sm">
                        Sync enabled
                      </Label>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSync(connection.id)}
                      disabled={isSyncing === connection.id || !connection.is_active}
                    >
                      {isSyncing === connection.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive/80">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Disconnect Calendar?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will stop syncing with "{connection.calendar_name}". Existing appointments
                            will not be deleted.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                            onClick={() => deleteMutation.mutate(connection.id)}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            Disconnect
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="bg-muted/50">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <ExternalLink className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="text-sm">
              <p className="font-medium mb-1">Setup Instructions</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
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
                <li>Add the Client ID and Secret in the Custom tab</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
