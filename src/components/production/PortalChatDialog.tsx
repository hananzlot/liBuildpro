import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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
import { toast } from 'sonner';
import { Loader2, Send, MessageSquare } from 'lucide-react';

interface PortalChatDialogProps {
  projectId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PortalChatDialog({ projectId, open, onOpenChange }: PortalChatDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [reply, setReply] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch project details
  const { data: project } = useQuery({
    queryKey: ['chat-dialog-project', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from('projects')
        .select('id, project_name, project_number, customer_first_name, customer_last_name')
        .eq('id', projectId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId && open,
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
    if (scrollRef.current) {
      // ScrollArea uses a viewport element inside - find it
      const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages]);

  // Send reply mutation
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

  const handleSend = () => {
    if (reply.trim()) {
      sendReplyMutation.mutate(reply);
    }
  };

  const projectName = project?.project_name || 
    `${project?.customer_first_name || ''} ${project?.customer_last_name || ''}`.trim() || 
    'Project';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4" />
            Customer Portal Chat
          </DialogTitle>
          <DialogDescription className="text-sm">
            {project?.project_number ? `#${project.project_number} - ` : ''}{projectName}
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

        <div className="flex gap-2 pt-2 border-t">
          <Input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Type your reply..."
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
            disabled={!reply.trim() || sendReplyMutation.isPending}
          >
            {sendReplyMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
