import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, GitBranch, GripVertical, Pencil, Plus, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";

type Stage = {
  id: string;
  name: string;
  position: number;
};

export function PipelineStagesEditor() {
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [newStageName, setNewStageName] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const { data: stages = [], isLoading } = useQuery({
    queryKey: ["pipeline-stages-admin", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_stages")
        .select("id, name, position")
        .eq("company_id", companyId!)
        .order("position", { ascending: true });
      if (error) throw error;
      return data as Stage[];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["pipeline-stages-admin", companyId] });
    queryClient.invalidateQueries({ queryKey: ["company-pipeline-settings", companyId] });
  };

  const updateMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .from("pipeline_stages")
        .update({ name })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setEditingId(null);
      toast.success("Stage renamed");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("pipeline_stages")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Stage deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const addMutation = useMutation({
    mutationFn: async (name: string) => {
      const nextPosition = stages.length > 0 ? Math.max(...stages.map(s => s.position)) + 1 : 0;
      const { error } = await supabase
        .from("pipeline_stages")
        .insert({ company_id: companyId!, name, position: nextPosition });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setNewStageName("");
      setIsAdding(false);
      toast.success("Stage added");
    },
    onError: (e) => toast.error(e.message),
  });

  const startEdit = (stage: Stage) => {
    setEditingId(stage.id);
    setEditingName(stage.name);
  };

  const confirmEdit = () => {
    if (!editingId || !editingName.trim()) return;
    updateMutation.mutate({ id: editingId, name: editingName.trim() });
  };

  const confirmAdd = () => {
    if (!newStageName.trim()) return;
    addMutation.mutate(newStageName.trim());
  };

  return (
    <Collapsible defaultOpen={false} className="group">
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                Pipeline Stages
              </span>
              <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </CardTitle>
            <CardDescription>
              Add, rename, or remove pipeline stages for opportunities
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-2 pt-0">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading stages…</p>
            ) : stages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No stages configured yet.</p>
            ) : (
              <div className="space-y-1">
                {stages.map((stage, idx) => (
                  <div
                    key={stage.id}
                    className="flex items-center gap-2 rounded-md border border-border/50 bg-background px-3 py-2"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                    <span className="text-xs text-muted-foreground w-5 shrink-0">{idx + 1}</span>

                    {editingId === stage.id ? (
                      <>
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="h-7 text-sm flex-1"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") confirmEdit();
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={confirmEdit} disabled={updateMutation.isPending}>
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="text-sm flex-1">{stage.name}</span>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(stage)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm(`Delete stage "${stage.name}"?`)) {
                              deleteMutation.mutate(stage.id);
                            }
                          }}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {isAdding ? (
              <div className="flex items-center gap-2 pt-1">
                <Input
                  value={newStageName}
                  onChange={(e) => setNewStageName(e.target.value)}
                  placeholder="New stage name"
                  className="h-8 text-sm flex-1"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmAdd();
                    if (e.key === "Escape") { setIsAdding(false); setNewStageName(""); }
                  }}
                />
                <Button size="sm" className="h-8" onClick={confirmAdd} disabled={addMutation.isPending || !newStageName.trim()}>
                  <Check className="h-3.5 w-3.5 mr-1" /> Add
                </Button>
                <Button size="sm" variant="ghost" className="h-8" onClick={() => { setIsAdding(false); setNewStageName(""); }}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" className="mt-2" onClick={() => setIsAdding(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Stage
              </Button>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
