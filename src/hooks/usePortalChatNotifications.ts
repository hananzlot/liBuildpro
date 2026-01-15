import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import React from 'react';

interface ChatMessage {
  id: string;
  project_id: string;
  sender_type: string;
  sender_name: string;
  sender_email: string | null;
  message: string;
  created_at: string;
}

export function usePortalChatNotifications() {
  const { user, isAdmin, isSuperAdmin, isProduction } = useAuth();
  const navigate = useNavigate();

  const handleNewMessage = useCallback(async (payload: { new: unknown }) => {
    const message = payload.new as ChatMessage;
    
    // Only notify for customer messages
    if (message.sender_type !== 'customer') return;

    // Fetch project name for the notification
    const { data: project } = await supabase
      .from('projects')
      .select('id, project_name, customer_first_name, customer_last_name')
      .eq('id', message.project_id)
      .single();

    const projectName = project?.project_name || 
      `${project?.customer_first_name || ''} ${project?.customer_last_name || ''}`.trim() || 
      'Unknown Project';
    const truncatedMessage = message.message.length > 50 
      ? message.message.substring(0, 50) + '...' 
      : message.message;

    // Show clickable toast notification
    toast.message(`New message from ${message.sender_name}`, {
      description: `Project: ${projectName} - "${truncatedMessage}"`,
      duration: 10000,
      icon: React.createElement(MessageSquare, { className: 'h-4 w-4 text-primary' }),
      action: {
        label: 'View & Reply',
        onClick: () => {
          navigate(`/production?view=projects&openProject=${message.project_id}&tab=feedback`);
        },
      },
    });
  }, [navigate]);

  useEffect(() => {
    // Only subscribe for admins and production managers
    if (!user || (!isAdmin && !isSuperAdmin && !isProduction)) return;

    console.log('Setting up portal chat notifications listener');

    const channel = supabase
      .channel('portal-chat-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'portal_chat_messages',
        },
        (payload) => {
          console.log('New portal chat message received:', payload);
          handleNewMessage(payload as { new: Record<string, unknown> });
        }
      )
      .subscribe((status) => {
        console.log('Portal chat notifications subscription status:', status);
      });

    return () => {
      console.log('Cleaning up portal chat notifications listener');
      supabase.removeChannel(channel);
    };
  }, [user, isAdmin, isSuperAdmin, isProduction, handleNewMessage]);
}
