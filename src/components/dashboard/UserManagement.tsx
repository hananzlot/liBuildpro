import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Users, Shield, ShieldCheck, Loader2 } from "lucide-react";

interface UserManagementProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  ghl_user_id: string | null;
}

interface UserRole {
  user_id: string;
  role: "admin" | "user";
}

export function UserManagement({ open, onOpenChange }: UserManagementProps) {
  const queryClient = useQueryClient();
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  // Fetch all profiles
  const { data: profiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("email");
      
      if (error) throw error;
      return data as Profile[];
    },
    enabled: open,
  });

  // Fetch all user roles
  const { data: userRoles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ["all-user-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("*");
      
      if (error) throw error;
      return data as UserRole[];
    },
    enabled: open,
  });

  const toggleAdminMutation = useMutation({
    mutationFn: async ({ userId, isCurrentlyAdmin }: { userId: string; isCurrentlyAdmin: boolean }) => {
      setUpdatingUserId(userId);
      
      if (isCurrentlyAdmin) {
        // Remove admin role
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", "admin");
        
        if (error) throw error;
      } else {
        // Add admin role
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: "admin" });
        
        if (error) throw error;
      }
    },
    onSuccess: (_, { isCurrentlyAdmin }) => {
      queryClient.invalidateQueries({ queryKey: ["all-user-roles"] });
      toast.success(isCurrentlyAdmin ? "Admin role removed" : "Admin role granted");
    },
    onError: (error) => {
      toast.error(`Failed to update role: ${error.message}`);
    },
    onSettled: () => {
      setUpdatingUserId(null);
    },
  });

  const isAdmin = (userId: string) => {
    return userRoles.some(role => role.user_id === userId && role.role === "admin");
  };

  const isLoading = profilesLoading || rolesLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            User Management
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-2">
              {profiles.map((profile) => {
                const userIsAdmin = isAdmin(profile.id);
                const isUpdating = updatingUserId === profile.id;

                return (
                  <div
                    key={profile.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        {userIsAdmin ? (
                          <ShieldCheck className="h-5 w-5 text-primary" />
                        ) : (
                          <Shield className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {profile.full_name || profile.email.split("@")[0]}
                        </p>
                        <p className="text-sm text-muted-foreground">{profile.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {userIsAdmin && (
                        <Badge variant="secondary" className="bg-primary/10 text-primary">
                          Admin
                        </Badge>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Admin</span>
                        {isUpdating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Switch
                            checked={userIsAdmin}
                            onCheckedChange={() => {
                              toggleAdminMutation.mutate({
                                userId: profile.id,
                                isCurrentlyAdmin: userIsAdmin,
                              });
                            }}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {profiles.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No users found
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        <div className="flex justify-end pt-4 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
