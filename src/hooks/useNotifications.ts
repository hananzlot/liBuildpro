import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyContext } from "@/hooks/useCompanyContext";

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
  dismissed_at: string | null;
  snoozed_until: string | null;
}

export function useNotifications() {
  const { profile } = useAuth();
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications", companyId, profile?.ghl_user_id],
    queryFn: async () => {
      if (!companyId) return [];
      
      const now = new Date().toISOString();
      
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("company_id", companyId)
        .is("dismissed_at", null)
        .or(`snoozed_until.is.null,snoozed_until.lt.${now}`)
        .or(
          profile?.ghl_user_id
            ? `ghl_user_id.eq.${profile.ghl_user_id},ghl_user_id.is.null`
            : `ghl_user_id.is.null`
        )
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as Notification[];
    },
    enabled: !!companyId,
    refetchInterval: 60 * 1000,
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
      if (!companyId) return;
      
      let query = supabase
        .from("notifications")
        .update({ read: true })
        .eq("company_id", companyId)
        .eq("read", false);

      if (profile?.ghl_user_id) {
        query = query.or(
          `ghl_user_id.eq.${profile.ghl_user_id},ghl_user_id.is.null`
        );
      } else {
        query = query.is("ghl_user_id", null);
      }

      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const dismissNotification = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ dismissed_at: new Date().toISOString() } as any)
        .eq("id", notificationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const snoozeNotification = useMutation({
    mutationFn: async ({ notificationId, days }: { notificationId: string; days: number }) => {
      const snoozedUntil = new Date();
      snoozedUntil.setDate(snoozedUntil.getDate() + days);
      const { error } = await supabase
        .from("notifications")
        .update({ snoozed_until: snoozedUntil.toISOString() } as any)
        .eq("id", notificationId);
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
    dismissNotification: dismissNotification.mutate,
    snoozeNotification: snoozeNotification.mutate,
  };
}
