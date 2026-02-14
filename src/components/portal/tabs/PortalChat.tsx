import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompanyContext } from '@/hooks/useCompanyContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  MessageSquare, 
  Send, 
  Loader2,
  User,
  Building2,
  Smile,
  Check,
  CheckCheck
} from 'lucide-react';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { toast } from 'sonner';

interface PortalChatProps {
  projectId: string;
  tokenId: string;
  customerName: string;
  customerEmail?: string | null;
  companyId?: string | null;
}

interface ChatMessage {
  id: string;
  project_id: string;
  sender_type: 'customer' | 'staff';
  sender_name: string;
  message: string;
  created_at: string;
  is_read?: boolean;
}

export function PortalChat({ projectId, tokenId, customerName, customerEmail, companyId: passedCompanyId }: PortalChatProps) {
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  // Use passed companyId from portal (for anonymous users) or fall back to context (for staff)
  const { companyId: contextCompanyId } = useCompanyContext();
  const companyId = passedCompanyId || contextCompanyId;
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
          company_id: companyId,
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

  const formatMessageTime = (date: Date) => {
    if (isToday(date)) return format(date, 'h:mm a');
    if (isYesterday(date)) return `Yesterday ${format(date, 'h:mm a')}`;
    return format(date, 'MMM d, h:mm a');
  };

  const getDateSeparator = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'EEEE, MMMM d');
  };

  // Group messages by date for separators
  const renderMessages = () => {
    if (!messages || messages.length === 0) return null;
    
    let lastDate: Date | null = null;
    
    return messages.map((msg, index) => {
      const msgDate = new Date(msg.created_at);
      const showDateSeparator = !lastDate || !isSameDay(msgDate, lastDate);
      lastDate = msgDate;
      
      return (
        <React.Fragment key={msg.id}>
          {showDateSeparator && (
            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                {getDateSeparator(msgDate)}
              </span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>
          )}
          <MessageBubble 
            message={msg} 
            isCustomer={msg.sender_type === 'customer'}
            showAvatar={
              index === 0 || 
              messages[index - 1]?.sender_type !== msg.sender_type ||
              showDateSeparator
            }
          />
        </React.Fragment>
      );
    });
  };

  return (
    <Card className="border-0 shadow-xl overflow-hidden max-w-full">
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-5 text-white">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
            <MessageSquare className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-lg">Chat with Us</h3>
            <p className="text-white/60 text-sm">We typically respond within a few hours</p>
          </div>
          <div className="w-3 h-3 rounded-full bg-green-400 ring-4 ring-green-400/20" />
        </div>
      </div>
      
      {/* Messages Area */}
      <div className="h-[400px] overflow-y-auto p-5 bg-gradient-to-b from-slate-50 to-white">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
              <p className="text-sm text-slate-500">Loading messages...</p>
            </div>
          </div>
        ) : messages && messages.length > 0 ? (
          <div className="space-y-1">
            {renderMessages()}
            <div ref={messagesEndRef} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mb-6">
              <MessageSquare className="h-10 w-10 text-primary" />
            </div>
            <h3 className="font-bold text-lg text-slate-900 mb-2">Start a Conversation</h3>
            <p className="text-slate-500 max-w-sm">
              Have a question about your project? Send us a message and we'll get back to you as soon as possible.
            </p>
          </div>
        )}
      </div>

      {/* Message Input */}
      <div className="border-t border-slate-200 p-4 bg-white">
        <div className="flex gap-3 items-center">
          <div className="flex-1 relative">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Type your message..."
              className="pr-10 h-12 bg-slate-50 border-slate-200 rounded-xl focus:bg-white transition-colors"
            />
          </div>
          <Button 
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || sendMessageMutation.isPending}
            size="lg"
            className="h-12 w-12 rounded-xl shrink-0 shadow-lg"
          >
            {sendMessageMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
        <p className="text-xs text-slate-400 mt-2 text-center">
          Press Enter to send • We'll respond as soon as possible
        </p>
      </div>
    </Card>
  );
}

function MessageBubble({ 
  message, 
  isCustomer,
  showAvatar 
}: { 
  message: ChatMessage; 
  isCustomer: boolean;
  showAvatar: boolean;
}) {
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return format(date, 'h:mm a');
    return format(date, 'MMM d, h:mm a');
  };

  return (
    <div className={`flex gap-3 ${isCustomer ? 'flex-row-reverse' : ''} ${showAvatar ? 'mt-4' : 'mt-1'}`}>
      {showAvatar ? (
        <Avatar className={`h-9 w-9 shrink-0 ring-2 ${isCustomer ? 'ring-primary/20' : 'ring-slate-200'}`}>
          <AvatarFallback className={`${
            isCustomer 
              ? 'bg-gradient-to-br from-primary to-primary/80 text-white' 
              : 'bg-gradient-to-br from-slate-700 to-slate-800 text-white'
          }`}>
            {isCustomer ? <User className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
          </AvatarFallback>
        </Avatar>
      ) : (
        <div className="w-9 shrink-0" />
      )}
      <div className={`flex flex-col ${isCustomer ? 'items-end' : 'items-start'} max-w-[75%]`}>
        {showAvatar && (
          <div className={`flex items-center gap-2 mb-1.5 ${isCustomer ? 'flex-row-reverse' : ''}`}>
            <span className="text-xs font-semibold text-slate-700">{message.sender_name}</span>
          </div>
        )}
        <div 
          className={`rounded-2xl px-4 py-3 shadow-sm ${
            isCustomer 
              ? 'bg-gradient-to-br from-primary to-primary/90 text-white rounded-tr-md' 
              : 'bg-white border border-slate-200 text-slate-700 rounded-tl-md'
          }`}
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.message}</p>
        </div>
        <div className={`flex items-center gap-1.5 mt-1.5 ${isCustomer ? 'flex-row-reverse' : ''}`}>
          <span className="text-[10px] text-slate-400">
            {formatTime(message.created_at)}
          </span>
          {isCustomer && (
            <CheckCheck className="h-3.5 w-3.5 text-primary" />
          )}
        </div>
      </div>
    </div>
  );
}