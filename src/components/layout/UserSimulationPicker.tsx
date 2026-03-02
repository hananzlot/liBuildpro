import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Users, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface UserWithRoles {
  id: string;
  email: string;
  full_name: string | null;
  company_id: string | null;
  roles: AppRole[];
}

interface UserSimulationPickerProps {
  onSelectUser: (userId: string, userName: string, roles: AppRole[]) => void;
  trigger: React.ReactNode;
}

export function UserSimulationPicker({ onSelectUser, trigger }: UserSimulationPickerProps) {
  const { companyId } = useAuth();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetchUsers();
  }, [open, companyId]);

  const fetchUsers = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      // Get profiles for the current company
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, email, full_name, company_id")
        .eq("company_id", companyId)
        .order("full_name");

      if (profileError || !profiles) {
        setUsers([]);
        return;
      }

      // Also get users from user_companies table
      const { data: ucProfiles } = await supabase
        .from("user_companies")
        .select("user_id")
        .eq("company_id", companyId);

      const allUserIds = new Set<string>();
      profiles.forEach(p => allUserIds.add(p.id));
      ucProfiles?.forEach(uc => allUserIds.add(uc.user_id));

      // Get roles for all users
      const userIdArray = Array.from(allUserIds);
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIdArray);

      const roleMap = new Map<string, AppRole[]>();
      rolesData?.forEach(r => {
        const existing = roleMap.get(r.user_id) || [];
        existing.push(r.role as AppRole);
        roleMap.set(r.user_id, existing);
      });

      // If there are user_companies users not in profiles query, fetch their profiles too
      const missingIds = userIdArray.filter(id => !profiles.find(p => p.id === id));
      let extraProfiles: typeof profiles = [];
      if (missingIds.length > 0) {
        const { data } = await supabase
          .from("profiles")
          .select("id, email, full_name, company_id")
          .in("id", missingIds);
        extraProfiles = data || [];
      }

      const allProfiles = [...profiles, ...extraProfiles];
      const usersWithRoles: UserWithRoles[] = allProfiles.map(p => ({
        ...p,
        roles: roleMap.get(p.id) || [],
      }));

      setUsers(usersWithRoles);
    } finally {
      setLoading(false);
    }
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return (
      (u.full_name?.toLowerCase().includes(q) || false) ||
      u.email.toLowerCase().includes(q) ||
      u.roles.some(r => r.toLowerCase().includes(q))
    );
  });

  const handleSelect = (user: UserWithRoles) => {
    if (user.roles.length === 0) {
      toast.warning(`${user.full_name || user.email} has no roles assigned`);
      return;
    }
    onSelectUser(user.id, user.full_name || user.email, user.roles);
    setOpen(false);
    toast.info(`Now simulating: ${user.full_name || user.email}`);
  };

  const formatRole = (role: string) =>
    role.charAt(0).toUpperCase() + role.slice(1).replace(/_/g, " ");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Simulate as User
          </DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <ScrollArea className="max-h-[360px]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No users found</p>
          ) : (
            <div className="space-y-1">
              {filtered.map(user => (
                <button
                  key={user.id}
                  onClick={() => handleSelect(user)}
                  className="w-full text-left px-3 py-2.5 rounded-md hover:bg-accent transition-colors"
                >
                  <div className="font-medium text-sm">
                    {user.full_name || "No name"}
                  </div>
                  <div className="text-xs text-muted-foreground">{user.email}</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {user.roles.length > 0 ? (
                      user.roles.map(r => (
                        <Badge key={r} variant="secondary" className="text-[10px] h-4 px-1.5">
                          {formatRole(r)}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-muted-foreground">
                        No roles
                      </Badge>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
