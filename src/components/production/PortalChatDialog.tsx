import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyContext } from '@/hooks/useCompanyContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, Send, MessageSquare, Phone } from 'lucide-react';

interface PortalChatDialogProps {
  projectId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PortalChatDialog({ projectId, open, onOpenChange }: PortalChatDialogProps) {
  const { user } = useAuth();
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();
  const [reply, setReply] = useState('');
  const [sendMode, setSendMode] = useState<'portal' | 'sms'>('portal');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch project details including phone
  const { data: project } = useQuery({
    queryKey: ['chat-dialog-project', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from('projects')
        .select('id, project_name, project_number, customer_first_name, customer_last_name, cell_phone, home_phone')
        .eq('id', projectId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId && open,
  });

  // Check if SMS is configured for this company
  const { data: smsConfigured } = useQuery({
    queryKey: ['sms-configured', companyId],
    queryFn: async () => {
      if (!companyId) return false;
      const { data } = await supabase
        .from('company_settings')
        .select('setting_key')
        .eq('company_id', companyId)
        .eq('setting_key', 'twilio_account_sid')
        .maybeSingle();
      return !!data;
    },
    enabled: !!companyId && open,
  });

  // Fetch chat messages
  const { data: messages = [] } = useQuery({
    queryKey: ['chat-dialog-messages', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('portal_chat_messages')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId && open,
  });

  // Real-time subscription for new messages
  useEffect(() => {
    if (!projectId || !open) return;

    const channel = supabase
      .channel(`chat-dialog-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'portal_chat_messages',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['chat-dialog-messages', projectId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, open, queryClient]);

  // Scroll to bottom when messages change
  useEffect(() => {
    const scrollToBottom = () => {
      if (scrollRef.current) {
        const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (viewport) {
          viewport.scrollTop = viewport.scrollHeight;
        }
      }
    };
    
    requestAnimationFrame(() => {
      requestAnimationFrame(scrollToBottom);
    });
  }, [messages, messages.length]);

  // Send portal reply mutation
  const sendReplyMutation = useMutation({
    mutationFn: async (message: string) => {
      if (!projectId) throw new Error('No project selected');
      const { error } = await supabase
        .from('portal_chat_messages')
        .insert({
          project_id: projectId,
          sender_type: 'staff',
          sender_name: user?.email?.split('@')[0] || 'Staff',
          sender_email: user?.email,
          sender_user_id: user?.id,
          message: message.trim(),
          company_id: companyId,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      setReply('');
      queryClient.invalidateQueries({ queryKey: ['chat-dialog-messages', projectId] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to send: ${error.message}`);
    },
  });

  // Send SMS mutation
  const sendSmsMutation = useMutation({
    mutationFn: async (message: string) => {
      if (!projectId) throw new Error('No project selected');
      const customerPhone = project?.cell_phone || project?.home_phone;
      if (!customerPhone) throw new Error('No phone number on file');

      const { data, error } = await supabase.functions.invoke('send-sms', {
        body: {
          toPhone: customerPhone,
          message: message.trim(),
          projectId,
          companyId,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to send SMS');
      return data;
    },
    onSuccess: () => {
      setReply('');
      toast.success('SMS sent!');
      queryClient.invalidateQueries({ queryKey: ['chat-dialog-messages', projectId] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to send SMS: ${error.message}`);
    },
  });

  const handleSend = () => {
    if (!reply.trim()) return;
    
    if (sendMode === 'sms') {
      sendSmsMutation.mutate(reply);
    } else {
      sendReplyMutation.mutate(reply);
    }
  };

  const isPending = sendReplyMutation.isPending || sendSmsMutation.isPending;
  const customerPhone = project?.cell_phone || project?.home_phone;

  const projectName = project?.project_name || 
    `${project?.customer_first_name || ''} ${project?.customer_last_name || ''}`.trim() || 
    'Project';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4" />
            Customer Chat
          </DialogTitle>
          <DialogDescription className="text-sm">
            {project?.project_number ? `#${project.project_number} - ` : ''}{projectName}
            {customerPhone && (
              <span className="ml-2 text-xs">• {customerPhone}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[350px] pr-4" ref={scrollRef}>
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No chat messages yet
            </p>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-3 rounded-lg ${
                    msg.sender_type === 'customer'
                      ? 'bg-blue-50 border border-blue-200 dark:bg-blue-950/30 dark:border-blue-800'
                      : 'bg-muted'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">
                      {msg.sender_name}
                      {msg.sender_type === 'customer' && (
                        <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0">
                          Customer
                        </Badge>
                      )}
                      {msg.sender_type === 'staff' && (
                        <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0">
                          Staff
                        </Badge>
                      )}
                      {msg.is_sms && (
                        <Badge variant="outline" className="ml-1 text-[10px] px-1.5 py-0 border-green-500 text-green-600">
                          <Phone className="h-2.5 w-2.5 mr-0.5" />
                          SMS
                        </Badge>
                      )}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(msg.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="space-y-2 pt-2 border-t">
          {smsConfigured && customerPhone && (
            <Tabs value={sendMode} onValueChange={(v) => setSendMode(v as 'portal' | 'sms')} className="w-full">
              <TabsList className="w-full">
                <TabsTrigger value="portal" className="flex-1 text-xs">
                  <MessageSquare className="h-3 w-3 mr-1" />
                  Portal Chat
                </TabsTrigger>
                <TabsTrigger value="sms" className="flex-1 text-xs">
                  <Phone className="h-3 w-3 mr-1" />
                  SMS Text
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}
          
          <div className="flex gap-2">
            <Input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder={sendMode === 'sms' ? 'Type SMS message...' : 'Type your reply...'}
              className="text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button
              onClick={handleSend}
              disabled={!reply.trim() || isPending}
              variant={sendMode === 'sms' ? 'default' : 'default'}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : sendMode === 'sms' ? (
                <Phone className="h-4 w-4" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          {sendMode === 'sms' && (
            <p className="text-[10px] text-muted-foreground text-center">
              Sending to: {customerPhone}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
