import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Users, Shield, ShieldCheck, Loader2, UserPlus, Eye, EyeOff, KeyRound } from "lucide-react";

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
  role: "admin" | "user" | "magazine_editor" | "production";
}

export function UserManagement({ open, onOpenChange }: UserManagementProps) {
  const queryClient = useQueryClient();
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);

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

  const createUserMutation = useMutation({
    mutationFn: async ({ email, password, fullName }: { email: string; password: string; fullName: string }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("create-user", {
        body: { email, password, fullName },
      });

      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);
      
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-profiles"] });
      toast.success("User created successfully");
      setNewEmail("");
      setNewPassword("");
      setNewFullName("");
      setShowCreateForm(false);
    },
    onError: (error) => {
      toast.error(`Failed to create user: ${error.message}`);
    },
  });

  const toggleRoleMutation = useMutation({
    mutationFn: async ({ userId, role, hasRole }: { userId: string; role: "admin" | "magazine_editor" | "production"; hasRole: boolean }) => {
      setUpdatingUserId(userId);
      setUpdatingRole(role);
      
      if (hasRole) {
        // Remove role
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", role);
        
        if (error) throw error;
      } else {
        // Add role
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role });
        
        if (error) throw error;
      }
      return { role, hasRole };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["all-user-roles"] });
      const roleName = data.role === "admin" ? "Admin" : data.role === "production" ? "Production" : "Magazine Editor";
      toast.success(data.hasRole ? `${roleName} role removed` : `${roleName} role granted`);
    },
    onError: (error) => {
      toast.error(`Failed to update role: ${error.message}`);
    },
    onSettled: () => {
      setUpdatingUserId(null);
      setUpdatingRole(null);
    },
  });

  const hasRole = (userId: string, role: "admin" | "magazine_editor" | "production") => {
    return userRoles.some(r => r.user_id === userId && r.role === role);
  };

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ email }: { email: string }) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Password reset email sent successfully");
    },
    onError: (error) => {
      toast.error(`Failed to send reset email: ${error.message}`);
    },
    onSettled: () => {
      setResettingUserId(null);
    },
  });

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword) {
      toast.error("Email and password are required");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    createUserMutation.mutate({ email: newEmail, password: newPassword, fullName: newFullName });
  };

  const isLoading = profilesLoading || rolesLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            User Management
          </DialogTitle>
        </DialogHeader>

        {/* Create User Form */}
        {showCreateForm ? (
          <form onSubmit={handleCreateUser} className="space-y-4 p-4 rounded-lg border border-border bg-muted/50">
            <h3 className="font-medium flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Create New User
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="newEmail">Email *</Label>
                <Input
                  id="newEmail"
                  type="email"
                  placeholder="user@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newFullName">Full Name</Label>
                <Input
                  id="newFullName"
                  type="text"
                  placeholder="John Doe"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">Password *</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="Minimum 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewEmail("");
                  setNewPassword("");
                  setNewFullName("");
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createUserMutation.isPending}>
                {createUserMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Create User
                  </>
                )}
              </Button>
            </div>
          </form>
        ) : (
          <Button
            variant="outline"
            onClick={() => setShowCreateForm(true)}
            className="w-full border-dashed"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Create New User
          </Button>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ScrollArea className="max-h-[50vh]">
            <div className="space-y-2">
              {profiles.map((profile) => {
                const userIsAdmin = hasRole(profile.id, "admin");
                const userIsMagazineEditor = hasRole(profile.id, "magazine_editor");
                const userIsProduction = hasRole(profile.id, "production");
                const isUpdatingAdmin = updatingUserId === profile.id && updatingRole === "admin";
                const isUpdatingMagazine = updatingUserId === profile.id && updatingRole === "magazine_editor";
                const isUpdatingProduction = updatingUserId === profile.id && updatingRole === "production";

                return (
                  <div
                    key={profile.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
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

                    <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                      <div className="flex flex-wrap gap-1 min-w-0">
                        {userIsAdmin && (
                          <Badge variant="secondary" className="bg-primary/10 text-primary text-xs">
                            Admin
                          </Badge>
                        )}
                        {userIsMagazineEditor && (
                          <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 text-xs">
                            Magazine
                          </Badge>
                        )}
                        {userIsProduction && (
                          <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 text-xs">
                            Production
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Admin</span>
                          {isUpdatingAdmin ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Switch
                              checked={userIsAdmin}
                              onCheckedChange={() => {
                                toggleRoleMutation.mutate({
                                  userId: profile.id,
                                  role: "admin",
                                  hasRole: userIsAdmin,
                                });
                              }}
                            />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Magazine</span>
                          {isUpdatingMagazine ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Switch
                              checked={userIsMagazineEditor}
                              onCheckedChange={() => {
                                toggleRoleMutation.mutate({
                                  userId: profile.id,
                                  role: "magazine_editor",
                                  hasRole: userIsMagazineEditor,
                                });
                              }}
                            />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Production</span>
                          {isUpdatingProduction ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Switch
                              checked={userIsProduction}
                              onCheckedChange={() => {
                                toggleRoleMutation.mutate({
                                  userId: profile.id,
                                  role: "production",
                                  hasRole: userIsProduction,
                                });
                              }}
                            />
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-muted-foreground hover:text-foreground"
                          disabled={resettingUserId === profile.id}
                          onClick={() => {
                            setResettingUserId(profile.id);
                            resetPasswordMutation.mutate({ email: profile.email });
                          }}
                          title="Send password reset email"
                        >
                          {resettingUserId === profile.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <KeyRound className="h-4 w-4" />
                          )}
                        </Button>
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
