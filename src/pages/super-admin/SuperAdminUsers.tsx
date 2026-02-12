import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  ChevronDown,
  ChevronRight,
  Building2,
  Building,
  User,
  MoreVertical,
  Ban,
  ShieldOff,
  Trash2,
} from "lucide-react";
import type { AppRole } from "@/contexts/AuthContext";

const ROLE_CONFIG: { role: AppRole; label: string; color: string }[] = [
  { role: "super_admin", label: "Super Admin", color: "bg-red-500/10 text-red-500" },
  { role: "corp_admin", label: "Corp Admin", color: "bg-orange-500/10 text-orange-500" },
  { role: "corp_viewer", label: "Corp Viewer", color: "bg-yellow-500/10 text-yellow-500" },
  { role: "admin", label: "Admin", color: "bg-primary/10 text-primary" },
  { role: "magazine", label: "Magazine", color: "bg-amber-500/10 text-amber-500" },
  { role: "production", label: "Production", color: "bg-emerald-500/10 text-emerald-500" },
  { role: "dispatch", label: "Dispatch", color: "bg-blue-500/10 text-blue-500" },
  { role: "sales", label: "Sales", color: "bg-purple-500/10 text-purple-500" },
  { role: "contract_manager", label: "Contract Mgr", color: "bg-cyan-500/10 text-cyan-500" },
];

interface ProfileRow {
  id: string;
  email: string | null;
  full_name: string | null;
  company_id: string | null;
  corporation_id: string | null;
}

interface RoleRow {
  user_id: string;
  role: AppRole;
}

interface CompanyRow {
  id: string;
  name: string;
  corporation_id: string | null;
}

interface CorporationRow {
  id: string;
  name: string;
}

export default function SuperAdminUsers() {
  const [search, setSearch] = useState("");
  const [openCorps, setOpenCorps] = useState<Set<string>>(new Set());
  const [openCompanies, setOpenCompanies] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<ProfileRow | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<{ user: ProfileRow; suspend: boolean } | null>(null);
  const queryClient = useQueryClient();

  // Fetch all data in parallel
  const { data: profiles, isLoading: loadingProfiles } = useQuery({
    queryKey: ["sa-users-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, company_id, corporation_id")
        .order("full_name");
      if (error) throw error;
      return data as ProfileRow[];
    },
  });

  const { data: roles, isLoading: loadingRoles } = useQuery({
    queryKey: ["sa-users-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      return data as RoleRow[];
    },
  });

  const { data: companies } = useQuery({
    queryKey: ["sa-users-companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, corporation_id")
        .order("name");
      if (error) throw error;
      return data as CompanyRow[];
    },
  });

  const { data: corporations } = useQuery({
    queryKey: ["sa-users-corporations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("corporations")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data as CorporationRow[];
    },
  });

  const toggleRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const currentlyHas = roleMap.get(userId)?.has(role) ?? false;

      if (currentlyHas) {
        // Remove role - use .select() to verify rows were actually deleted
        const { data: deleted, error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", role)
          .select();
        if (error) throw error;
        if (!deleted || deleted.length === 0) {
          throw new Error("Failed to remove role – no rows were deleted. Check RLS policies on user_roles.");
        }
      } else {
        // Add role
        const { data, error } = await supabase.rpc("admin_assign_role", {
          target_user_id: userId,
          target_role: role,
        });
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sa-users-roles"] });
      toast.success("Role updated");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sa-users-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["sa-users-roles"] });
      toast.success("User deleted");
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const suspendUserMutation = useMutation({
    mutationFn: async ({ userId, suspend }: { userId: string; suspend: boolean }) => {
      const { data, error } = await supabase.functions.invoke("suspend-user", {
        body: { userId, suspend },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_, variables) => {
      toast.success(variables.suspend ? "User suspended" : "User unsuspended");
      setSuspendTarget(null);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // Build role lookup
  const roleMap = useMemo(() => {
    const m = new Map<string, Set<string>>();
    roles?.forEach((r) => {
      if (!m.has(r.user_id)) m.set(r.user_id, new Set());
      m.get(r.user_id)!.add(r.role);
    });
    return m;
  }, [roles]);

  // Filter profiles by search
  const filtered = useMemo(() => {
    if (!profiles) return [];
    if (!search.trim()) return profiles;
    const q = search.toLowerCase();
    return profiles.filter(
      (p) =>
        p.full_name?.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q)
    );
  }, [profiles, search]);

  // Group: Corporation → Company → Users
  const grouped = useMemo(() => {
    const corpMap = new Map<string, CorporationRow>();
    corporations?.forEach((c) => corpMap.set(c.id, c));

    const companyMap = new Map<string, CompanyRow>();
    companies?.forEach((c) => companyMap.set(c.id, c));

    // corp_id → company_id → users
    const tree = new Map<
      string,
      { corp: CorporationRow | null; companies: Map<string, { company: CompanyRow | null; users: ProfileRow[] }> }
    >();

    const NO_CORP = "__no_corp__";
    const NO_COMPANY = "__no_company__";

    filtered.forEach((user) => {
      const corpId = user.corporation_id || NO_CORP;
      const companyId = user.company_id || NO_COMPANY;

      if (!tree.has(corpId)) {
        tree.set(corpId, {
          corp: corpId !== NO_CORP ? corpMap.get(corpId) || null : null,
          companies: new Map(),
        });
      }
      const corpNode = tree.get(corpId)!;

      if (!corpNode.companies.has(companyId)) {
        corpNode.companies.set(companyId, {
          company: companyId !== NO_COMPANY ? companyMap.get(companyId) || null : null,
          users: [],
        });
      }
      corpNode.companies.get(companyId)!.users.push(user);
    });

    return tree;
  }, [filtered, corporations, companies]);

  const toggleCorp = (id: string) => {
    setOpenCorps((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleCompany = (id: string) => {
    setOpenCompanies((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const hasRole = (userId: string, role: string) => roleMap.get(userId)?.has(role) ?? false;

  const isLoading = loadingProfiles || loadingRoles;

  return (
    <SuperAdminLayout
      title="User Management"
      description="All platform users grouped by corporation and company"
    >
      <div className="p-6 space-y-4">
        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">No users found.</p>
        ) : (
          <div className="space-y-3">
            {Array.from(grouped.entries())
              .sort(([aId], [bId]) => {
                if (aId === "__no_corp__") return 1;
                if (bId === "__no_corp__") return -1;
                return (grouped.get(aId)?.corp?.name || "").localeCompare(
                  grouped.get(bId)?.corp?.name || ""
                );
              })
              .map(([corpId, corpNode]) => {
                const corpOpen = openCorps.has(corpId);
                const corpName = corpNode.corp?.name || "No Corporation";
                const corpUserCount = Array.from(corpNode.companies.values()).reduce(
                  (sum, c) => sum + c.users.length,
                  0
                );

                return (
                  <Collapsible key={corpId} open={corpOpen} onOpenChange={() => toggleCorp(corpId)}>
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full justify-between h-auto py-3 px-4 rounded-lg border bg-card hover:bg-accent/50"
                      >
                        <div className="flex items-center gap-3">
                          <Building2 className="h-5 w-5 text-primary" />
                          <span className="font-semibold text-base">{corpName}</span>
                          <Badge variant="secondary" className="text-xs">
                            {corpUserCount} {corpUserCount === 1 ? "user" : "users"}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {corpNode.companies.size} {corpNode.companies.size === 1 ? "company" : "companies"}
                          </Badge>
                        </div>
                        {corpOpen ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </CollapsibleTrigger>

                    <CollapsibleContent className="pl-6 pt-2 space-y-2">
                      {Array.from(corpNode.companies.entries())
                        .sort(([aId], [bId]) => {
                          if (aId === "__no_company__") return 1;
                          if (bId === "__no_company__") return -1;
                          const aName = corpNode.companies.get(aId)?.company?.name || "";
                          const bName = corpNode.companies.get(bId)?.company?.name || "";
                          return aName.localeCompare(bName);
                        })
                        .map(([companyId, companyNode]) => {
                          const compOpen = openCompanies.has(companyId);
                          const compName = companyNode.company?.name || "No Company";

                          return (
                            <Collapsible
                              key={companyId}
                              open={compOpen}
                              onOpenChange={() => toggleCompany(companyId)}
                            >
                              <CollapsibleTrigger asChild>
                                <Button
                                  variant="ghost"
                                  className="w-full justify-between h-auto py-2.5 px-3 rounded-lg border bg-muted/30 hover:bg-accent/30"
                                >
                                  <div className="flex items-center gap-2">
                                    <Building className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium text-sm">{compName}</span>
                                    <Badge variant="secondary" className="text-xs">
                                      {companyNode.users.length}
                                    </Badge>
                                  </div>
                                  {compOpen ? (
                                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                  )}
                                </Button>
                              </CollapsibleTrigger>

                              <CollapsibleContent className="pl-4 pt-2 space-y-1">
                                {companyNode.users.map((user) => (
                                  <div
                                    key={user.id}
                                    className="flex items-center justify-between gap-4 p-3 rounded-lg border bg-card"
                                  >
                                    <div className="flex items-center gap-3 min-w-0">
                                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                                        <User className="h-4 w-4 text-muted-foreground" />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-sm font-medium truncate">
                                          {user.full_name || "Unnamed"}
                                        </p>
                                        <p className="text-xs text-muted-foreground truncate">
                                          {user.email}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                      {ROLE_CONFIG.map((cfg) => {
                                        const active = hasRole(user.id, cfg.role);
                                        return (
                                          <div
                                            key={cfg.role}
                                            className="flex items-center gap-1.5"
                                          >
                                            <Switch
                                              checked={active}
                                              onCheckedChange={() =>
                                                toggleRoleMutation.mutate({
                                                  userId: user.id,
                                                  role: cfg.role,
                                                })
                                              }
                                              className="scale-75"
                                            />
                                            <span
                                              className={`text-xs px-1.5 py-0.5 rounded ${
                                                active ? cfg.color : "text-muted-foreground"
                                              }`}
                                            >
                                              {cfg.label}
                                            </span>
                                          </div>
                                        );
                                      })}

                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-7 w-7 ml-1">
                                            <MoreVertical className="h-4 w-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem
                                            onClick={() => setSuspendTarget({ user, suspend: true })}
                                          >
                                            <Ban className="h-4 w-4 mr-2" />
                                            Suspend User
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() => setSuspendTarget({ user, suspend: false })}
                                          >
                                            <ShieldOff className="h-4 w-4 mr-2" />
                                            Unsuspend User
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() => setDeleteTarget(user)}
                                            className="text-destructive focus:text-destructive"
                                          >
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Delete User
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  </div>
                                ))}
                              </CollapsibleContent>
                            </Collapsible>
                          );
                        })}
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
          </div>
        )}
      </div>
      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete{" "}
              <strong>{deleteTarget?.full_name || deleteTarget?.email}</strong>?
              This action cannot be undone. All roles and profile data will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteUserMutation.mutate(deleteTarget.id)}
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Suspend Confirmation */}
      <AlertDialog open={!!suspendTarget} onOpenChange={(open) => !open && setSuspendTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {suspendTarget?.suspend ? "Suspend User" : "Unsuspend User"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {suspendTarget?.suspend
                ? <>Are you sure you want to suspend <strong>{suspendTarget.user.full_name || suspendTarget.user.email}</strong>? They will be unable to log in until unsuspended.</>
                : <>Are you sure you want to unsuspend <strong>{suspendTarget?.user.full_name || suspendTarget?.user.email}</strong>? They will regain the ability to log in.</>
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                suspendTarget &&
                suspendUserMutation.mutate({
                  userId: suspendTarget.user.id,
                  suspend: suspendTarget.suspend,
                })
              }
              disabled={suspendUserMutation.isPending}
            >
              {suspendUserMutation.isPending
                ? "Processing…"
                : suspendTarget?.suspend
                  ? "Suspend"
                  : "Unsuspend"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SuperAdminLayout>
  );
}
