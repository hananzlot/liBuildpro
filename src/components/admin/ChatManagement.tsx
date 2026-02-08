import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompanyContext } from '@/hooks/useCompanyContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
} from '@/components/ui/alert-dialog';
import { 
  MessageSquare, 
  Archive, 
  Trash2, 
  Loader2, 
  Mail,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface ChatMessage {
  id: string;
  project_id: string;
  sender_type: string;
  sender_name: string;
  sender_email: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
  project?: {
    project_number: number;
    project_name: string | null;
    customer_first_name: string | null;
    customer_last_name: string | null;
  };
}

interface ArchivedChatMessage {
  id: string;
  original_id: string;
  project_id: string;
  sender_type: string;
  sender_name: string;
  sender_email: string | null;
  message: string;
  is_read: boolean;
  original_created_at: string;
  archived_at: string;
  project?: {
    project_number: number;
    project_name: string | null;
    customer_first_name: string | null;
    customer_last_name: string | null;
  };
}

export function ChatManagement() {
  const queryClient = useQueryClient();
  const { companyId } = useCompanyContext();
  const [activeTab, setActiveTab] = useState('settings');

  // Fetch daily email setting (company-scoped)
  const { data: dailyEmailEnabled, isLoading: settingLoading } = useQuery({
    queryKey: ['daily-email-setting', companyId],
    queryFn: async () => {
      if (!companyId) return false;
      
      // Try company_settings first
      const { data: companyData } = await supabase
        .from('company_settings')
        .select('setting_value')
        .eq('company_id', companyId)
        .eq('setting_key', 'daily_portal_email_enabled')
        .maybeSingle();
      
      if (companyData) {
        return companyData.setting_value === 'true';
      }
      
      // Fallback to app_settings
      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'daily_portal_email_enabled')
        .single();
      if (error) return false;
      return data?.setting_value === 'true';
    },
    enabled: !!companyId,
  });

  // Fetch current chat messages (company-scoped) - include messages where project belongs to company
  const { data: currentChats = [], isLoading: currentLoading } = useQuery({
    queryKey: ['admin-current-chats', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      // First get project IDs that belong to this company
      const { data: projectIds } = await supabase
        .from('projects')
        .select('id')
        .eq('company_id', companyId)
        .is('deleted_at', null);
      
      if (!projectIds || projectIds.length === 0) return [];
      
      const ids = projectIds.map(p => p.id);
      
      const { data, error } = await supabase
        .from('portal_chat_messages')
        .select(`
          *,
          project:projects(project_number, project_name, customer_first_name, customer_last_name)
        `)
        .in('project_id', ids)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as ChatMessage[];
    },
    enabled: activeTab === 'current' && !!companyId,
  });

  // Fetch archived chat messages (company-scoped) - include messages where project belongs to company
  const { data: archivedChats = [], isLoading: archivedLoading } = useQuery({
    queryKey: ['admin-archived-chats', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      // First get project IDs that belong to this company
      const { data: projectIds } = await supabase
        .from('projects')
        .select('id')
        .eq('company_id', companyId)
        .is('deleted_at', null);
      
      if (!projectIds || projectIds.length === 0) return [];
      
      const ids = projectIds.map(p => p.id);
      
      const { data, error } = await supabase
        .from('portal_chat_messages_archived')
        .select(`
          *,
          project:projects(project_number, project_name, customer_first_name, customer_last_name)
        `)
        .in('project_id', ids)
        .order('archived_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as ArchivedChatMessage[];
    },
    enabled: activeTab === 'archived' && !!companyId,
  });

  // Toggle daily email setting (company-scoped)
  const toggleDailyEmailMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!companyId) throw new Error("No company selected");
      
      const { error } = await supabase
        .from('company_settings')
        .upsert({
          company_id: companyId,
          setting_key: 'daily_portal_email_enabled',
          setting_value: enabled ? 'true' : 'false',
          setting_type: 'boolean',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'company_id,setting_key' });
      if (error) throw error;
    },
    onSuccess: (_, enabled) => {
      toast.success(enabled ? 'Daily portal emails enabled' : 'Daily portal emails disabled');
      queryClient.invalidateQueries({ queryKey: ['daily-email-setting', companyId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Clear all current chats (company-scoped)
  const clearCurrentChatsMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No company selected");
      
      const { error } = await supabase
        .from('portal_chat_messages')
        .delete()
        .eq('company_id', companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('All current chat messages cleared');
      queryClient.invalidateQueries({ queryKey: ['admin-current-chats', companyId] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to clear messages: ${error.message}`);
    },
  });

  // Clear all archived chats (company-scoped)
  const clearArchivedChatsMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No company selected");
      
      const { error } = await supabase
        .from('portal_chat_messages_archived')
        .delete()
        .eq('company_id', companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('All archived chat messages cleared');
      queryClient.invalidateQueries({ queryKey: ['admin-archived-chats', companyId] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to clear archived messages: ${error.message}`);
    },
  });

  // Manual archive trigger (older than 24h)
  const triggerArchiveMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('archive-portal-chats', {
        body: { companyId }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || 'Archive completed');
      queryClient.invalidateQueries({ queryKey: ['admin-current-chats', companyId] });
      queryClient.invalidateQueries({ queryKey: ['admin-archived-chats', companyId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Archive ALL chats immediately
  const archiveAllMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('archive-portal-chats', {
        body: { archiveAll: true, companyId }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || 'All chats archived');
      queryClient.invalidateQueries({ queryKey: ['admin-current-chats', companyId] });
      queryClient.invalidateQueries({ queryKey: ['admin-archived-chats', companyId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const getProjectDisplay = (project: ChatMessage['project'] | ArchivedChatMessage['project']) => {
    if (!project) return 'Unknown Project';
    const name = project.project_name || 
      `${project.customer_first_name || ''} ${project.customer_last_name || ''}`.trim() ||
      'Unnamed';
    return `#${project.project_number} - ${name}`;
  };

  return (
    <div className="space-y-6">
      {/* Daily Email Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Daily Portal Email Settings
          </CardTitle>
          <CardDescription>
            Control automatic daily emails sent to customers when their project has updates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label htmlFor="daily-email-toggle" className="text-base font-medium">
                Automatic Daily Portal Update Emails
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                When enabled, customers receive an automatic email once per day if their project has updates.
                If a production manager manually sends an email that day, the automatic email is skipped.
              </p>
            </div>
            <Switch
              id="daily-email-toggle"
              checked={dailyEmailEnabled || false}
              onCheckedChange={(checked) => toggleDailyEmailMutation.mutate(checked)}
              disabled={settingLoading || toggleDailyEmailMutation.isPending}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Status: {dailyEmailEnabled ? 
              <Badge variant="default" className="ml-1">Enabled</Badge> : 
              <Badge variant="outline" className="ml-1">Disabled (default)</Badge>
            }
          </p>
        </CardContent>
      </Card>

      {/* Chat Management Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Portal Chat Management
          </CardTitle>
          <CardDescription>
            View and manage customer portal chat messages. Messages are automatically archived after 24 hours.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex items-center justify-between mb-4">
              <TabsList>
                <TabsTrigger value="settings">Overview</TabsTrigger>
                <TabsTrigger value="current">Current Messages</TabsTrigger>
                <TabsTrigger value="archived">Archived Messages</TabsTrigger>
              </TabsList>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => triggerArchiveMutation.mutate()}
                  disabled={triggerArchiveMutation.isPending}
                >
                  {triggerArchiveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Archive className="h-4 w-4 mr-2" />
                  )}
                  Archive Old
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={archiveAllMutation.isPending}
                    >
                      {archiveAllMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Archive className="h-4 w-4 mr-2" />
                      )}
                      Archive All
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Archive All Chats?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will archive ALL current chat messages immediately, regardless of age.
                        Messages will be moved to the archive and can still be viewed there.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => archiveAllMutation.mutate()}>
                        Archive All
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>

            <TabsContent value="settings" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    <span className="font-semibold">Current Messages</span>
                  </div>
                  <p className="text-2xl font-bold">{currentChats.length}</p>
                  <p className="text-sm text-muted-foreground">Active chat messages</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Archive className="h-5 w-5 text-muted-foreground" />
                    <span className="font-semibold">Archived Messages</span>
                  </div>
                  <p className="text-2xl font-bold">{archivedChats.length}</p>
                  <p className="text-sm text-muted-foreground">Archived chat messages</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Chat messages are automatically archived daily via a scheduled job. 
                Messages older than 24 hours are moved to the archive.
              </p>
            </TabsContent>

            <TabsContent value="current">
              <div className="flex justify-end mb-4">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={currentChats.length === 0}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear All Current
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Clear All Current Messages?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete all {currentChats.length} current chat messages. 
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => clearCurrentChatsMutation.mutate()}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete All
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              {currentLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : currentChats.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No current chat messages
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Project</TableHead>
                        <TableHead>Sender</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Message</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentChats.map((chat) => (
                        <TableRow key={chat.id}>
                          <TableCell className="whitespace-nowrap text-sm">
                            {format(new Date(chat.created_at), 'MMM d, h:mm a')}
                          </TableCell>
                          <TableCell className="text-sm max-w-[150px] truncate">
                            {getProjectDisplay(chat.project)}
                          </TableCell>
                          <TableCell className="text-sm">{chat.sender_name}</TableCell>
                          <TableCell>
                            <Badge variant={chat.sender_type === 'customer' ? 'default' : 'secondary'} className="text-xs">
                              {chat.sender_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm max-w-[200px] truncate">
                            {chat.message}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </TabsContent>

            <TabsContent value="archived">
              <div className="flex justify-end mb-4">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={archivedChats.length === 0}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear All Archived
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Clear All Archived Messages?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete all {archivedChats.length} archived chat messages. 
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => clearArchivedChatsMutation.mutate()}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete All
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              {archivedLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : archivedChats.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No archived chat messages
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Original Date</TableHead>
                        <TableHead>Archived</TableHead>
                        <TableHead>Project</TableHead>
                        <TableHead>Sender</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Message</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {archivedChats.map((chat) => (
                        <TableRow key={chat.id}>
                          <TableCell className="whitespace-nowrap text-sm">
                            {format(new Date(chat.original_created_at), 'MMM d, h:mm a')}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                            {format(new Date(chat.archived_at), 'MMM d')}
                          </TableCell>
                          <TableCell className="text-sm max-w-[150px] truncate">
                            {getProjectDisplay(chat.project)}
                          </TableCell>
                          <TableCell className="text-sm">{chat.sender_name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {chat.sender_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm max-w-[200px] truncate">
                            {chat.message}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
