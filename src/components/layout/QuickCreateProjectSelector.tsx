import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, FolderKanban } from "lucide-react";

export type QuickCreateAction = "new-invoice" | "new-payment" | "new-bill";

const actionLabels: Record<QuickCreateAction, string> = {
  "new-invoice": "Create New Invoice",
  "new-payment": "Record New Payment",
  "new-bill": "Create New Bill",
};

interface QuickCreateProjectSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: QuickCreateAction | null;
  onProjectSelected: (projectId: string, action: QuickCreateAction) => void;
}

export function QuickCreateProjectSelector({
  open,
  onOpenChange,
  action,
  onProjectSelected,
}: QuickCreateProjectSelectorProps) {
  const { companyId } = useCompanyContext();
  const [search, setSearch] = useState("");

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["quick-create-projects", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("projects")
        .select("id, project_number, project_name, project_address, customer_first_name, customer_last_name, deleted_at, project_status")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .in("project_status", ["New Job", "In-Progress"])
        .order("project_number", { ascending: false });
      if (error) throw error;
      return (data || []).map(p => ({
        ...p,
        customer_name: [p.customer_first_name, p.customer_last_name].filter(Boolean).join(" ") || null,
      }));
    },
    enabled: !!companyId && open,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return projects;
    const q = search.toLowerCase();
    return projects.filter(
      (p) =>
        p.project_number?.toString().includes(q) ||
        p.project_name?.toLowerCase().includes(q) ||
        p.project_address?.toLowerCase().includes(q) ||
        p.customer_name?.toLowerCase().includes(q)
    );
  }, [projects, search]);

  const handleSelect = (projectId: string) => {
    if (action) {
      onProjectSelected(projectId, action);
      onOpenChange(false);
      setSearch("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setSearch(""); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{action ? actionLabels[action] : "Select Project"}</DialogTitle>
          <DialogDescription>Select a project to continue</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by project #, name, address, or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>
        <ScrollArea className="max-h-[350px]">
          {isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading projects...</div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No projects found</div>
          ) : (
            <div className="space-y-1">
              {filtered.map((project) => (
                <button
                  key={project.id}
                  onClick={() => handleSelect(project.id)}
                  className="w-full text-left px-3 py-2.5 rounded-md hover:bg-accent transition-colors flex items-start gap-3"
                >
                  <FolderKanban className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      #{project.project_number} — {project.project_name || project.project_address || "Untitled"}
                    </div>
                    {project.customer_name && (
                      <div className="text-xs text-muted-foreground truncate">{project.customer_name}</div>
                    )}
                    {project.project_address && project.project_name && (
                      <div className="text-xs text-muted-foreground truncate">{project.project_address}</div>
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
