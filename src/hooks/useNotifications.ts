import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Notification {
  id: string;
  user_id: string | null;
  ghl_user_id: string | null;
  title: string;
  message: string;
  type: string;
  read: boolean;
  appointment_ghl_id: string | null;
  created_at: string;
  reference_url: string | null;
}

export function useNotifications() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications", profile?.ghl_user_id],
    queryFn: async () => {
      if (!profile?.ghl_user_id) return [];
      
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("ghl_user_id", profile.ghl_user_id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as Notification[];
    },
    enabled: !!profile?.ghl_user_id,
    refetchInterval: 60 * 1000, // Refetch every minute
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notificationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      if (!profile?.ghl_user_id) return;
      
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("ghl_user_id", profile.ghl_user_id)
        .eq("read", false);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead: markAsRead.mutate,
    markAllAsRead: markAllAsRead.mutate,
  };
}
