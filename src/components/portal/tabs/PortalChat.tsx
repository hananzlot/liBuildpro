import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  MessageSquare, 
  Send, 
  Loader2,
  User,
  Building2
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface PortalChatProps {
  projectId: string;
  tokenId: string;
  customerName: string;
  customerEmail?: string | null;
}

interface ChatMessage {
  id: string;
  project_id: string;
  sender_type: 'customer' | 'staff';
  sender_name: string;
  message: string;
  created_at: string;
}

export function PortalChat({ projectId, tokenId, customerName, customerEmail }: PortalChatProps) {
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Fetch messages
  const { data: messages, isLoading } = useQuery({
    queryKey: ['portal-chat', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portal_chat_messages')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as ChatMessage[];
    },
  });

  // Subscribe to real-time updates
  useEffect(() => {
    const channel = supabase
      .channel(`portal-chat-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'portal_chat_messages',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          queryClient.setQueryData(['portal-chat', projectId], (old: ChatMessage[] | undefined) => {
            if (!old) return [payload.new as ChatMessage];
            // Avoid duplicates
            if (old.some(m => m.id === payload.new.id)) return old;
            return [...old, payload.new as ChatMessage];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, queryClient]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const { error } = await supabase
        .from('portal_chat_messages')
        .insert({
          project_id: projectId,
          portal_token_id: tokenId,
          sender_type: 'customer',
          sender_name: customerName,
          sender_email: customerEmail,
          message: message.trim(),
        });

      if (error) throw error;
    },
    onSuccess: () => {
      setNewMessage('');
    },
    onError: (error: Error) => {
      toast.error('Failed to send message: ' + error.message);
    },
  });

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    sendMessageMutation.mutate(newMessage);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-[350px] sm:h-[400px] bg-background rounded-lg border">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b bg-muted/30">
        <MessageSquare className="h-5 w-5 text-primary" />
        <span className="font-medium">Chat with Us</span>
      </div>
      
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages && messages.length > 0 ? (
          <>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} isCustomer={msg.sender_type === 'customer'} />
            ))}
            <div ref={messagesEndRef} />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <MessageSquare className="h-10 w-10 text-muted-foreground mb-3" />
            <h3 className="font-semibold text-sm">Start a Conversation</h3>
            <p className="text-xs text-muted-foreground">
              Send us a message and we'll respond as soon as possible.
            </p>
          </div>
        )}
      </div>

      {/* Message Input - Fixed at bottom */}
      <div className="border-t p-2 bg-background">
        <div className="flex gap-2 items-center">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1 h-10"
          />
          <Button 
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || sendMessageMutation.isPending}
            size="icon"
            className="h-10 w-10 shrink-0"
          >
            {sendMessageMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message, isCustomer }: { message: ChatMessage; isCustomer: boolean }) {
  return (
    <div className={`flex gap-2 ${isCustomer ? 'flex-row-reverse' : ''}`}>
      <Avatar className="h-7 w-7 shrink-0">
        <AvatarFallback className={isCustomer ? 'bg-primary text-primary-foreground' : 'bg-muted'}>
          {isCustomer ? <User className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
        </AvatarFallback>
      </Avatar>
      <div className={`flex flex-col ${isCustomer ? 'items-end' : 'items-start'} max-w-[75%]`}>
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[10px] font-medium">{message.sender_name}</span>
          <span className="text-[10px] text-muted-foreground">
            {format(new Date(message.created_at), 'h:mm a')}
          </span>
        </div>
        <div 
          className={`rounded-2xl px-3 py-2 ${
            isCustomer 
              ? 'bg-primary text-primary-foreground rounded-tr-sm' 
              : 'bg-muted rounded-tl-sm'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap break-words">{message.message}</p>
        </div>
      </div>
    </div>
  );
}
