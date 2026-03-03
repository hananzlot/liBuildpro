import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Users, Shield, ShieldCheck, Loader2, UserPlus, Eye, EyeOff, Lock, AlertTriangle, Trash2, Building2, BarChart3, ChevronRight, Archive, RotateCcw } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { AppRole } from "@/contexts/AuthContext";
import { useAuth } from "@/contexts/AuthContext";
import { ANALYTICS_REPORTS, useManageAnalyticsPermissions, type AnalyticsReportKey } from "@/hooks/useAnalyticsPermissions";

interface UserManagementProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When true, renders content inline instead of in a Dialog */
  inline?: boolean;
}

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  ghl_user_id: string | null;
  company_id: string | null;
  archived_at: string | null;
}

interface Company {
  id: string;
  name: string;
}

interface UserRole {
  user_id: string;
  role: AppRole;
}

// Map roles to their required feature keys
// Roles not in this map are always available (admin, super_admin)
const ROLE_FEATURE_MAP: Partial<Record<AppRole, string>> = {
  magazine: 'magazine_sales',
  production: 'production',
  dispatch: 'production', // dispatch is part of production
  sales: 'sales_portal',
  contract_manager: 'documents',
};

const ROLE_CONFIG: { role: AppRole; label: string; color: string }[] = [
  { role: 'super_admin', label: 'Super Admin', color: 'bg-red-500/10 text-red-500' },
  { role: 'corp_admin', label: 'Corp Admin', color: 'bg-orange-500/10 text-orange-500' },
  { role: 'corp_viewer', label: 'Corp Viewer', color: 'bg-yellow-500/10 text-yellow-500' },
  { role: 'admin', label: 'Admin', color: 'bg-primary/10 text-primary' },
  { role: 'magazine', label: 'Magazine', color: 'bg-amber-500/10 text-amber-500' },
  { role: 'production', label: 'Production', color: 'bg-emerald-500/10 text-emerald-500' },
  { role: 'dispatch', label: 'Dispatch', color: 'bg-blue-500/10 text-blue-500' },
  { role: 'sales', label: 'Sales', color: 'bg-purple-500/10 text-purple-500' },
  { role: 'contract_manager', label: 'Contract Manager', color: 'bg-cyan-500/10 text-cyan-500' },
];

const PROFILES_QUERY_KEY = ["user-management", "profiles"] as const;

// Sub-component for per-user analytics report toggles
function UserAnalyticsToggles({ userId, isDisabled }: { userId: string; isDisabled: boolean }) {
  const { isReportVisible, toggleReport, setAllReports, isToggling, isLoading } = useManageAnalyticsPermissions(userId);
  const [isOpen, setIsOpen] = useState(false);

  if (isLoading) return null;

  const visibleCount = ANALYTICS_REPORTS.filter(r => isReportVisible(r.key)).length;
  const allVisible = visibleCount === ANALYTICS_REPORTS.length;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="ml-13">
      <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
        <BarChart3 className="h-3.5 w-3.5" />
        <span>Analytics Reports ({visibleCount}/{ANALYTICS_REPORTS.length})</span>
        <ChevronRight className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-1">
        <div className="space-y-1.5">
          {/* All toggle */}
          <div className="flex items-center gap-2 pb-1 border-b border-border">
            <Switch
              checked={allVisible}
              disabled={isDisabled || isToggling}
              onCheckedChange={(checked) => setAllReports(checked)}
            />
            <span className="text-xs font-medium text-muted-foreground">
              {allVisible ? "All Reports" : "Grant All"}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-1.5">
            {ANALYTICS_REPORTS.map((report) => (
              <div key={report.key} className="flex items-center gap-2">
                <Switch
                  checked={isReportVisible(report.key)}
                  disabled={isDisabled || isToggling}
                  onCheckedChange={(checked) => toggleReport(report.key, checked)}
                />
                <span className={`text-xs ${isDisabled ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
                  {report.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
const ROLES_QUERY_KEY = ["user-management", "roles"] as const;
const COMPANIES_QUERY_KEY = ["user-management", "companies"] as const;

const USER_COMPANIES_QUERY_KEY = ["user-management", "user-companies"] as const;

interface UserCompanyRow {
  id: string;
  user_id: string;
  company_id: string;
  is_primary: boolean;
}

export function UserManagement({ open, onOpenChange, inline = false }: UserManagementProps) {
  const { isSuperAdmin, isCorpAdmin, canUseFeature, companyId, company } = useAuth();
  const queryClient = useQueryClient();
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newRole, setNewRole] = useState<AppRole | "">("");
  const [showPassword, setShowPassword] = useState(false);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [settingPasswordForUser, setSettingPasswordForUser] = useState<Profile | null>(null);
  const [directPassword, setDirectPassword] = useState("");
  const [showDirectPassword, setShowDirectPassword] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [reassigningCompanyForUser, setReassigningCompanyForUser] = useState<Profile | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [managingCompaniesForUser, setManagingCompaniesForUser] = useState<Profile | null>(null);

  const canManageMultiCompany = isSuperAdmin || isCorpAdmin;

  // Fetch profiles - super admins see all, corp admins see their corporation, regular admins see their company
  const {
    data: profiles = [],
    isLoading: profilesLoading,
    error: profilesError,
  } = useQuery({
    queryKey: [...PROFILES_QUERY_KEY, isSuperAdmin ? 'all' : isCorpAdmin ? `corp-${company?.corporation_id}` : companyId],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("id, email, full_name, ghl_user_id, company_id, archived_at");
      
      if (!isSuperAdmin && !isCorpAdmin && companyId) {
        // Regular admins only see users in their company
        query = query.eq("company_id", companyId);
      } else if (!isSuperAdmin && isCorpAdmin && company?.corporation_id) {
        // Corp admins see users in companies within their corporation
        const { data: corpCompanies } = await supabase
          .from("companies")
          .select("id")
          .eq("corporation_id", company.corporation_id);
        const corpCompanyIds = corpCompanies?.map(c => c.id) || [];
        if (corpCompanyIds.length > 0) {
          query = query.in("company_id", corpCompanyIds);
        } else {
          return [];
        }
      }
      
      const { data, error } = await query.order("email");

      if (error) throw error;
      return data as Profile[];
    },
    enabled: open && (isSuperAdmin || isCorpAdmin || !!companyId),
    refetchOnMount: "always",
  });

  // Fetch companies - super admins see all, corp admins see their corporation
  const {
    data: companies = [],
    isLoading: companiesLoading,
  } = useQuery({
    queryKey: [...COMPANIES_QUERY_KEY, isSuperAdmin ? 'all' : `corp-${company?.corporation_id}`],
    queryFn: async () => {
      let query = supabase
        .from("companies")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      
      if (!isSuperAdmin && isCorpAdmin && company?.corporation_id) {
        query = query.eq("corporation_id", company.corporation_id);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Company[];
    },
    enabled: open && canManageMultiCompany,
  });

  // Fetch user_companies associations
  const {
    data: allUserCompanies = [],
  } = useQuery({
    queryKey: USER_COMPANIES_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_companies")
        .select("id, user_id, company_id, is_primary");

      if (error) throw error;
      return data as UserCompanyRow[];
    },
    enabled: open && canManageMultiCompany,
  });

  // Fetch all user roles
  const {
    data: userRoles = [],
    isLoading: rolesLoading,
    error: rolesError,
  } = useQuery({
    queryKey: ROLES_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*");

      if (error) throw error;
      return data as UserRole[];
    },
    enabled: open,
    refetchOnMount: "always",
  });

  const loadError = profilesError || rolesError;

  // Filter roles based on user type - admins see all roles except super_admin toggle
  const availableRoles = useMemo(() => {
    // Super admins see all roles including super_admin toggle
    if (isSuperAdmin) return ROLE_CONFIG;
    
    // Regular admins see all roles EXCEPT super_admin toggle
    // They can manage all other roles for users in their company
    return ROLE_CONFIG.filter(roleConfig => {
      // Hide super_admin toggle from regular admins - they can't use it anyway
      if (roleConfig.role === 'super_admin') return false;
      return true;
    });
  }, [isSuperAdmin]);

  // Roles available for new user creation (exclude super_admin for non-super admins)
  const creatableRoles = useMemo(() => {
    return availableRoles.filter(roleConfig => {
      // Only super admins can create super admins
      if (roleConfig.role === 'super_admin' && !isSuperAdmin) return false;
      return true;
    });
  }, [availableRoles, isSuperAdmin]);

  const createUserMutation = useMutation({
    mutationFn: async ({ email, password, fullName, role }: { email: string; password: string; fullName: string; role?: AppRole }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("create-user", {
        body: { 
          email, 
          password, 
          fullName,
          companyId: companyId || undefined, // Auto-assign to admin's company
          role: role || undefined, // Optional initial role
        },
      });

      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);
      
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROFILES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ROLES_QUERY_KEY });
      toast.success("User created successfully");
      setNewEmail("");
      setNewPassword("");
      setNewFullName("");
      setNewRole("");
      setShowCreateForm(false);
    },
    onError: (error) => {
      toast.error(`Failed to create user: ${error.message}`);
    },
  });

  const toggleRoleMutation = useMutation({
    mutationFn: async ({ userId, role, hasRole }: { userId: string; role: AppRole; hasRole: boolean }) => {
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
      return { role, hasRole, userId };
    },
    onMutate: async ({ userId, role, hasRole }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ROLES_QUERY_KEY });

      // Snapshot the previous value
      const previousRoles = queryClient.getQueryData<UserRole[]>(ROLES_QUERY_KEY);

      // Optimistically update to the new value
      queryClient.setQueryData<UserRole[]>(ROLES_QUERY_KEY, (old = []) => {
        if (hasRole) {
          // Remove the role
          return old.filter(r => !(r.user_id === userId && r.role === role));
        }

        // Add the role
        return [...old, { user_id: userId, role }];
      });

      return { previousRoles };
    },
    onSuccess: (data) => {
      const roleLabel = ROLE_CONFIG.find(r => r.role === data.role)?.label || data.role;
      toast.success(data.hasRole ? `${roleLabel} role removed` : `${roleLabel} role granted`);
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousRoles) {
        queryClient.setQueryData(ROLES_QUERY_KEY, context.previousRoles);
      }
      toast.error(`Failed to update role: ${error.message}`);
    },
    onSettled: async () => {
      setUpdatingUserId(null);
      setUpdatingRole(null);
      // Refetch to ensure we're in sync with server
      await queryClient.refetchQueries({ queryKey: ROLES_QUERY_KEY });
    },
  });

  const hasRole = (userId: string, role: AppRole) => {
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

  const setPasswordMutation = useMutation({
    mutationFn: async ({ userId, password }: { userId: string; password: string }) => {
      const response = await supabase.functions.invoke("update-user-password", {
        body: { userId, password },
      });

      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);
      
      return response.data;
    },
    onSuccess: () => {
      toast.success("Password updated successfully");
      setSettingPasswordForUser(null);
      setDirectPassword("");
      setShowDirectPassword(false);
    },
    onError: (error) => {
      toast.error(`Failed to set password: ${error.message}`);
    },
  });

  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);

  const archiveUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      setDeletingUserId(userId);
      const response = await supabase.functions.invoke("delete-user", {
        body: { userId, mode: "archive" },
      });
      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROFILES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ROLES_QUERY_KEY });
      toast.success("User archived successfully");
      setDeleteTarget(null);
    },
    onError: (error) => {
      toast.error(`Failed to archive user: ${error.message}`);
    },
    onSettled: () => {
      setDeletingUserId(null);
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      setDeletingUserId(userId);
      const response = await supabase.functions.invoke("delete-user", {
        body: { userId, mode: "permanent" },
      });
      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROFILES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ROLES_QUERY_KEY });
      toast.success("User permanently deleted");
      setDeleteTarget(null);
    },
    onError: (error) => {
      toast.error(`Failed to delete user: ${error.message}`);
    },
    onSettled: () => {
      setDeletingUserId(null);
    },
  });

  const restoreUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      // Unarchive the profile
      const { error } = await supabase
        .from("profiles")
        .update({ archived_at: null, archived_by: null })
        .eq("id", userId);
      if (error) throw error;

      // Unban in auth via edge function or direct - we'll use the suspend-user pattern
      const response = await supabase.functions.invoke("suspend-user", {
        body: { userId, suspend: false },
      });
      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROFILES_QUERY_KEY });
      toast.success("User restored successfully");
    },
    onError: (error) => {
      toast.error(`Failed to restore user: ${error.message}`);
    },
  });

  // Mutation to reassign user's primary company
  const reassignCompanyMutation = useMutation({
    mutationFn: async ({ userId, newCompanyId }: { userId: string; newCompanyId: string | null }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ company_id: newCompanyId })
        .eq("id", userId);

      if (error) throw error;
      return { userId, newCompanyId };
    },
    onSuccess: (data) => {
      const companyName = data.newCompanyId 
        ? companies.find(c => c.id === data.newCompanyId)?.name || "Unknown"
        : "None";
      queryClient.invalidateQueries({ queryKey: PROFILES_QUERY_KEY });
      toast.success(`User reassigned to ${companyName}`);
      setReassigningCompanyForUser(null);
      setSelectedCompanyId("");
    },
    onError: (error) => {
      toast.error(`Failed to reassign company: ${error.message}`);
    },
  });

  // Mutation to toggle a user_companies association
  const toggleUserCompanyMutation = useMutation({
    mutationFn: async ({ userId, companyId, add }: { userId: string; companyId: string; add: boolean }) => {
      if (add) {
        const { error } = await supabase
          .from("user_companies")
          .insert({ user_id: userId, company_id: companyId, is_primary: false });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_companies")
          .delete()
          .eq("user_id", userId)
          .eq("company_id", companyId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USER_COMPANIES_QUERY_KEY });
      toast.success("Company association updated");
    },
    onError: (error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  const handleSetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingPasswordForUser || !directPassword) {
      toast.error("Password is required");
      return;
    }
    if (directPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setPasswordMutation.mutate({ userId: settingPasswordForUser.id, password: directPassword });
  };

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
    createUserMutation.mutate({ 
      email: newEmail, 
      password: newPassword, 
      fullName: newFullName,
      role: newRole || undefined,
    });
  };

  const isLoading = profilesLoading || rolesLoading || (isSuperAdmin && companiesLoading);

  // Filter out super_admin users for non-super-admin viewers
  const filteredProfiles = useMemo(() => {
    // Super admins see everyone
    if (isSuperAdmin) return profiles;
    
    // Get all user IDs that have super_admin role
    const superAdminUserIds = new Set(
      userRoles
        .filter(r => r.role === 'super_admin')
        .map(r => r.user_id)
    );
    
    // Filter out users who are super admins
    return profiles.filter(profile => !superAdminUserIds.has(profile.id));
  }, [profiles, userRoles, isSuperAdmin]);

  // Helper to get company name for a profile
  const getCompanyName = (companyId: string | null) => {
    if (!companyId) return "No Company";
    return companies.find(c => c.id === companyId)?.name || "Unknown";
  };

  const content = (
    <>
      {!inline && (
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            User Management
          </DialogTitle>
        </DialogHeader>
      )}

        {loadError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Unable to load users/roles</AlertTitle>
            <AlertDescription>
              {(loadError instanceof Error && loadError.message) ? loadError.message : "Unknown error"}
              <div className="mt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await Promise.all([
                      queryClient.refetchQueries({ queryKey: PROFILES_QUERY_KEY }),
                      queryClient.refetchQueries({ queryKey: ROLES_QUERY_KEY }),
                    ]);
                  }}
                >
                  Retry
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

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
            <div className="grid gap-4 sm:grid-cols-2">
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
              <div className="space-y-2">
                <Label htmlFor="newRole">Initial Role (optional)</Label>
                <Select value={newRole} onValueChange={(value) => setNewRole(value as AppRole)}>
                  <SelectTrigger id="newRole">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {creatableRoles.map((roleConfig) => (
                      <SelectItem key={roleConfig.role} value={roleConfig.role}>
                        {roleConfig.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  setNewRole("");
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
          <div className="overflow-y-auto max-h-[calc(100vh-320px)]">
            <div className="space-y-2">
              {filteredProfiles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No users found
                </div>
              ) : filteredProfiles.map((profile) => {
                const userRolesForProfile = availableRoles.map(cfg => ({
                  ...cfg,
                  active: hasRole(profile.id, cfg.role),
                  isUpdating: updatingUserId === profile.id && updatingRole === cfg.role,
                }));

                const activeRoles = userRolesForProfile.filter(r => r.active);
                const isUserAdmin = hasRole(profile.id, 'super_admin') || hasRole(profile.id, 'admin');
                const isUserSuperAdmin = hasRole(profile.id, 'super_admin');

                return (
                  <div
                    key={profile.id}
                    className="flex flex-col gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          {isUserAdmin ? (
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

                      <div className="flex items-center gap-2">
                        <div className="flex flex-wrap gap-1">
                          {/* Show super_admin badge to all admins so they know who platform admins are */}
                          {profile.archived_at && (
                            <Badge variant="secondary" className="text-xs bg-muted text-muted-foreground">
                              Archived
                            </Badge>
                          )}
                          {isUserSuperAdmin && !isSuperAdmin && (
                            <Badge variant="secondary" className="text-xs bg-destructive/10 text-destructive">
                              Super Admin
                            </Badge>
                          )}
                          {canManageMultiCompany && (
                            <Badge variant="outline" className="text-xs">
                              {getCompanyName(profile.company_id)}
                            </Badge>
                          )}
                          {/* Show additional company badges */}
                          {canManageMultiCompany && (() => {
                            const userAssociations = allUserCompanies.filter(
                              uc => uc.user_id === profile.id && uc.company_id !== profile.company_id
                            );
                            return userAssociations.length > 0 ? (
                              <Badge variant="outline" className="text-xs text-muted-foreground">
                                +{userAssociations.length} co.
                              </Badge>
                            ) : null;
                          })()}
                          {activeRoles.map(r => (
                            <Badge key={r.role} variant="secondary" className={`text-xs ${r.color}`}>
                              {r.label}
                            </Badge>
                          ))}
                        </div>
                        {/* Company management button */}
                        {canManageMultiCompany && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              setManagingCompaniesForUser(profile);
                            }}
                            title="Manage company associations"
                          >
                            <Building2 className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setSettingPasswordForUser(profile);
                            setDirectPassword("");
                            setShowDirectPassword(false);
                          }}
                          disabled={isUserSuperAdmin && !isSuperAdmin}
                          title={isUserSuperAdmin && !isSuperAdmin ? "Cannot modify super admin" : "Set password directly"}
                        >
                          <Lock className="h-4 w-4" />
                        </Button>
                        {profile.archived_at ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-muted-foreground hover:text-foreground"
                            onClick={() => restoreUserMutation.mutate(profile.id)}
                            disabled={restoreUserMutation.isPending}
                            title="Restore archived user"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteTarget(profile)}
                          disabled={deletingUserId === profile.id || (isUserSuperAdmin && !isSuperAdmin)}
                          title={isUserSuperAdmin && !isSuperAdmin ? "Cannot delete super admin" : profile.archived_at ? "Permanently delete" : "Archive or delete user"}
                        >
                          {deletingUserId === profile.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Role toggles */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-x-4 gap-y-2 ml-13">
                      {userRolesForProfile.map((roleInfo) => {
                        // Regular admins cannot modify any roles for super_admin users
                        const cannotModifySuperAdminUser = isUserSuperAdmin && !isSuperAdmin;
                        // Only super_admin users can modify super_admin role
                        const isSuperAdminRole = roleInfo.role === 'super_admin';
                        const canModifyThisRole = isSuperAdminRole ? isSuperAdmin : true;
                        const isDisabled = !canModifyThisRole || cannotModifySuperAdminUser;

                        return (
                          <div key={roleInfo.role} className="flex items-center gap-2">
                            {roleInfo.isUpdating ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Switch
                                checked={roleInfo.active}
                                disabled={isDisabled}
                                onCheckedChange={() => {
                                  toggleRoleMutation.mutate({
                                    userId: profile.id,
                                    role: roleInfo.role,
                                    hasRole: roleInfo.active,
                                  });
                                }}
                              />
                            )}
                            <span className={`text-xs ${isDisabled ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
                              {roleInfo.label}
                              {isDisabled && ' 🔒'}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Analytics report toggles */}
                    <UserAnalyticsToggles 
                      userId={profile.id} 
                      isDisabled={isUserSuperAdmin && !isSuperAdmin}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Set Password Dialog */}
        {settingPasswordForUser && (
          <Dialog open={!!settingPasswordForUser} onOpenChange={() => setSettingPasswordForUser(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Set Password for {settingPasswordForUser.full_name || settingPasswordForUser.email}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="directPassword">New Password</Label>
                  <div className="relative">
                    <Input
                      id="directPassword"
                      type={showDirectPassword ? "text" : "password"}
                      placeholder="Minimum 6 characters"
                      value={directPassword}
                      onChange={(e) => setDirectPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowDirectPassword(!showDirectPassword)}
                    >
                      {showDirectPassword ? (
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
                      setSettingPasswordForUser(null);
                      setDirectPassword("");
                      setShowDirectPassword(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={setPasswordMutation.isPending}>
                    {setPasswordMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Setting...
                      </>
                    ) : (
                      "Set Password"
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}

        {/* Reassign Primary Company Dialog */}
        {reassigningCompanyForUser && canManageMultiCompany && (
          <Dialog open={!!reassigningCompanyForUser} onOpenChange={() => setReassigningCompanyForUser(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Change Primary Company for {reassigningCompanyForUser.full_name || reassigningCompanyForUser.email}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="companySelect">Primary Company</Label>
                  <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                    <SelectTrigger id="companySelect">
                      <SelectValue placeholder="Select a company" />
                    </SelectTrigger>
                    <SelectContent>
                      {isSuperAdmin && <SelectItem value="none">No Company (Platform User)</SelectItem>}
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => { setReassigningCompanyForUser(null); setSelectedCompanyId(""); }}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => reassignCompanyMutation.mutate({ userId: reassigningCompanyForUser.id, newCompanyId: selectedCompanyId === "none" ? null : selectedCompanyId })}
                    disabled={reassignCompanyMutation.isPending}
                  >
                    {reassignCompanyMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : "Save"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Multi-Company Association Dialog */}
        {managingCompaniesForUser && canManageMultiCompany && (
          <Dialog open={!!managingCompaniesForUser} onOpenChange={() => setManagingCompaniesForUser(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Company Access for {managingCompaniesForUser.full_name || managingCompaniesForUser.email}
                </DialogTitle>
                <DialogDescription>
                  Select which companies this user can access. Their primary company is set separately.
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[400px]">
                <div className="space-y-2 p-1">
                  {companies.map((c) => {
                    const isAssociated = allUserCompanies.some(
                      uc => uc.user_id === managingCompaniesForUser.id && uc.company_id === c.id
                    );
                    const isPrimary = managingCompaniesForUser.company_id === c.id;
                    return (
                      <div
                        key={c.id}
                        className={`flex items-center justify-between p-3 rounded-md border ${isAssociated ? 'border-primary/30 bg-primary/5' : 'border-border'}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{c.name}</span>
                          {isPrimary && <Badge variant="secondary" className="text-xs">Primary</Badge>}
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={isAssociated}
                            disabled={toggleUserCompanyMutation.isPending}
                            onCheckedChange={(checked) => {
                              toggleUserCompanyMutation.mutate({
                                userId: managingCompaniesForUser.id,
                                companyId: c.id,
                                add: !!checked,
                              });
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
              <div className="flex justify-between items-center pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setReassigningCompanyForUser(managingCompaniesForUser);
                    setSelectedCompanyId(managingCompaniesForUser.company_id || "");
                    setManagingCompaniesForUser(null);
                  }}
                >
                  Change Primary Company
                </Button>
                <Button onClick={() => setManagingCompaniesForUser(null)}>
                  Done
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Archive/Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {deleteTarget?.archived_at ? "Permanently Delete User" : "Archive or Delete User"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {deleteTarget?.archived_at ? (
                  <>
                    This user is already archived. Do you want to <strong>permanently delete</strong>{" "}
                    <strong>{deleteTarget?.full_name || deleteTarget?.email}</strong>?
                    This action cannot be undone.
                  </>
                ) : (
                  <>
                    Choose how to remove <strong>{deleteTarget?.full_name || deleteTarget?.email}</strong>:
                    <br /><br />
                    <strong>Archive</strong> — disables login and hides the user, but preserves all data. Can be restored later.
                    <br />
                    <strong>Permanently Delete</strong> — removes the user and all associated auth data forever. Cannot be undone.
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              {!deleteTarget?.archived_at && (
                <AlertDialogAction
                  onClick={() => deleteTarget && archiveUserMutation.mutate(deleteTarget.id)}
                  disabled={archiveUserMutation.isPending}
                  className="gap-1.5"
                >
                  <Archive className="h-4 w-4" />
                  {archiveUserMutation.isPending ? "Archiving…" : "Archive"}
                </AlertDialogAction>
              )}
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-1.5"
                onClick={() => deleteTarget && deleteUserMutation.mutate(deleteTarget.id)}
                disabled={deleteUserMutation.isPending}
              >
                <Trash2 className="h-4 w-4" />
                {deleteUserMutation.isPending ? "Deleting…" : "Permanently Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </>
  );

  if (inline) {
    if (!open) return null;
    return <div className="space-y-4">{content}</div>;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl">
        {content}
      </DialogContent>
    </Dialog>
  );
}
