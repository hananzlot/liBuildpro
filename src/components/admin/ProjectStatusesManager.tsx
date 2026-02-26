import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Plus, Trash2, ArrowUp, ArrowDown, Pencil, Check, X, Loader2, FolderKanban } from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_PROJECT_STATUSES } from "@/components/production/AdminKPIFilters";

interface StatusEdit {
  id: string | null;
  name: string;
  sort_order: number;
  is_default: boolean;
}

export function ProjectStatusesManager() {
  const { companyId } = useAuth();
  const queryClient = useQueryClient();
  const [statuses, setStatuses] = useState<StatusEdit[]>([]);
  const [newStatusName, setNewStatusName] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: dbStatuses, refetch } = useQuery({
    queryKey: ["project-statuses-admin", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_statuses")
        .select("*")
        .eq("company_id", companyId!)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  useEffect(() => {
    if (dbStatuses && !loaded) {
      if (dbStatuses.length > 0) {
        setStatuses(dbStatuses.map((s) => ({
          id: s.id,
          name: s.name,
          sort_order: s.sort_order,
          is_default: s.is_default,
        })));
      } else {
        // Seed from defaults
        setStatuses(DEFAULT_PROJECT_STATUSES.map((name, idx) => ({
          id: null,
          name,
          sort_order: idx,
          is_default: true,
        })));
      }
      setLoaded(true);
    }
  }, [dbStatuses, loaded]);

  const handleAdd = () => {
    const trimmed = newStatusName.trim();
    if (!trimmed) return;
    if (statuses.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("Status already exists");
      return;
    }
    setStatuses([...statuses, { id: null, name: trimmed, sort_order: statuses.length, is_default: false }]);
    setNewStatusName("");
  };

  const handleRemove = (index: number) => {
    setStatuses(statuses.filter((_, i) => i !== index).map((s, i) => ({ ...s, sort_order: i })));
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    const newArr = [...statuses];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newArr.length) return;
    [newArr[index], newArr[newIndex]] = [newArr[newIndex], newArr[index]];
    setStatuses(newArr.map((s, i) => ({ ...s, sort_order: i })));
  };

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setEditingName(statuses[index].name);
  };

  const confirmEdit = () => {
    if (editingIndex === null) return;
    const trimmed = editingName.trim();
    if (!trimmed) return;
    if (statuses.some((s, i) => i !== editingIndex && s.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("Status name already exists");
      return;
    }
    const updated = [...statuses];
    updated[editingIndex] = { ...updated[editingIndex], name: trimmed };
    setStatuses(updated);
    setEditingIndex(null);
    setEditingName("");
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditingName("");
  };

  const handleSave = async () => {
    if (!companyId) return;
    setSaving(true);
    try {
      // Get existing statuses to find deletions
      const { data: existing } = await supabase
        .from("project_statuses")
        .select("id")
        .eq("company_id", companyId);

      const existingIds = new Set((existing || []).map((e) => e.id));
      const currentIds = new Set(statuses.filter((s) => s.id).map((s) => s.id));

      // Delete removed statuses
      const toDelete = [...existingIds].filter((id) => !currentIds.has(id));
      if (toDelete.length > 0) {
        await supabase.from("project_statuses").delete().in("id", toDelete);
      }

      // Upsert all current statuses
      for (const status of statuses) {
        if (status.id) {
          await supabase
            .from("project_statuses")
            .update({ name: status.name, sort_order: status.sort_order })
            .eq("id", status.id);
        } else {
          await supabase.from("project_statuses").insert({
            company_id: companyId,
            name: status.name,
            sort_order: status.sort_order,
            is_default: status.is_default,
          });
        }
      }

      toast.success("Project statuses saved");
      await refetch();
      setLoaded(false); // Force reload
      queryClient.invalidateQueries({ queryKey: ["project-statuses", companyId] });
    } catch (err) {
      toast.error(`Failed to save: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = () => {
    if (!dbStatuses) return statuses.length > 0;
    if (dbStatuses.length !== statuses.length) return true;
    return statuses.some((s, i) => {
      const db = dbStatuses[i];
      if (!db) return true;
      return s.id !== db.id || s.name !== db.name || s.sort_order !== db.sort_order;
    });
  };

  return (
    <Collapsible defaultOpen={false} className="group">
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FolderKanban className="h-5 w-5" />
                Project Statuses
              </span>
              <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </CardTitle>
            <CardDescription>
              Manage the available statuses for projects across your company
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            <div className="space-y-2">
              {statuses.map((status, index) => (
                <div key={status.id || `new-${index}`} className="flex items-center gap-2 group/item">
                  <span className="text-xs text-muted-foreground w-6 text-right">{index + 1}.</span>
                  {editingIndex === index ? (
                    <>
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="h-8 flex-1"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") confirmEdit();
                          if (e.key === "Escape") cancelEdit();
                        }}
                        autoFocus
                      />
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={confirmEdit}>
                        <Check className="h-3.5 w-3.5 text-primary" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelEdit}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm">{status.name}</span>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(index)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleMove(index, "up")}
                          disabled={index === 0}
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleMove(index, "down")}
                          disabled={index === statuses.length - 1}
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleRemove(index)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Input
                value={newStatusName}
                onChange={(e) => setNewStatusName(e.target.value)}
                placeholder="New status name..."
                className="h-8"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                }}
              />
              <Button variant="outline" size="sm" onClick={handleAdd} disabled={!newStatusName.trim()}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add
              </Button>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving || !hasChanges()} size="sm">
                {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                Save Statuses
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
