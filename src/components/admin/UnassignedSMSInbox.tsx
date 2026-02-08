import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompanyContext } from '@/hooks/useCompanyContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Phone, Loader2, Link2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface UnassignedSMS {
  id: string;
  sender_name: string;
  sms_phone_number: string | null;
  message: string;
  created_at: string;
}

interface Project {
  id: string;
  project_number: number;
  project_name: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
}

export function UnassignedSMSInbox() {
  const queryClient = useQueryClient();
  const { companyId } = useCompanyContext();
  const [selectedMessage, setSelectedMessage] = useState<UnassignedSMS | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);

  // Fetch unassigned SMS (project_id IS NULL)
  const { data: unassignedSMS = [], isLoading } = useQuery({
    queryKey: ['unassigned-sms', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      const { data, error } = await supabase
        .from('portal_chat_messages')
        .select('id, sender_name, sms_phone_number, message, created_at')
        .eq('company_id', companyId)
        .eq('is_sms', true)
        .is('project_id', null)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as UnassignedSMS[];
    },
    enabled: !!companyId,
  });

  // Fetch projects for assignment
  const { data: projects = [] } = useQuery({
    queryKey: ['projects-for-sms-assignment', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      const { data, error } = await supabase
        .from('projects')
        .select('id, project_number, project_name, customer_first_name, customer_last_name')
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .order('project_number', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data as Project[];
    },
    enabled: assignDialogOpen && !!companyId,
  });

  // Assign SMS to project
  const assignMutation = useMutation({
    mutationFn: async ({ messageId, projectId }: { messageId: string; projectId: string }) => {
      const { error } = await supabase
        .from('portal_chat_messages')
        .update({ project_id: projectId })
        .eq('id', messageId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('SMS assigned to project');
      setAssignDialogOpen(false);
      setSelectedMessage(null);
      queryClient.invalidateQueries({ queryKey: ['unassigned-sms', companyId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Delete unassigned SMS
  const deleteMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase
        .from('portal_chat_messages')
        .delete()
        .eq('id', messageId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('SMS deleted');
      queryClient.invalidateQueries({ queryKey: ['unassigned-sms', companyId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const getProjectDisplay = (project: Project) => {
    const name = project.project_name || 
      `${project.customer_first_name || ''} ${project.customer_last_name || ''}`.trim() ||
      'Unnamed';
    return `#${project.project_number} - ${name}`;
  };

  const handleAssign = (messageId: string) => {
    const message = unassignedSMS.find(m => m.id === messageId);
    if (message) {
      setSelectedMessage(message);
      setAssignDialogOpen(true);
    }
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
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Unassigned SMS Inbox
            {unassignedSMS.length > 0 && (
              <Badge variant="secondary">{unassignedSMS.length}</Badge>
            )}
          </CardTitle>
          <CardDescription>
            SMS messages from unknown phone numbers. Assign them to a project or delete.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {unassignedSMS.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No unassigned SMS messages
            </div>
          ) : (
            <ScrollArea className="h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="max-w-[300px]">Message</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unassignedSMS.map((sms) => (
                    <TableRow key={sms.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(sms.created_at), 'MMM d, h:mm a')}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {sms.sms_phone_number || 'Unknown'}
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate">
                        {sms.message}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAssign(sms.id)}
                          >
                            <Link2 className="h-4 w-4 mr-1" />
                            Assign
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteMutation.mutate(sms.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Assign Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign SMS to Project</DialogTitle>
            <DialogDescription>
              {selectedMessage && (
                <span className="block mt-2">
                  From: <span className="font-mono">{selectedMessage.sms_phone_number}</span>
                  <br />
                  Message: "{selectedMessage.message.substring(0, 50)}..."
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <Command className="border rounded-lg">
            <CommandInput placeholder="Search projects..." />
            <CommandList>
              <CommandEmpty>No projects found.</CommandEmpty>
              <CommandGroup>
                {projects.map((project) => (
                  <CommandItem
                    key={project.id}
                    onSelect={() => {
                      if (selectedMessage) {
                        assignMutation.mutate({
                          messageId: selectedMessage.id,
                          projectId: project.id,
                        });
                      }
                    }}
                  >
                    {getProjectDisplay(project)}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
