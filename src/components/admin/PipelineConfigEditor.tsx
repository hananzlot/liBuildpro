import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, GitBranch, Pencil, Plus, Trash2, Check, X, Star } from "lucide-react";
import { toast } from "sonner";

type Pipeline = {
  id: string;
  name: string;
  is_default: boolean;
  position: number;
};

export function PipelineConfigEditor() {
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [newName, setNewName] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const { data: pipelines = [], isLoading } = useQuery({
    queryKey: ["pipelines-admin", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipelines")
        .select("id, name, is_default, position")
        .eq("company_id", companyId!)
        .order("position", { ascending: true });
      if (error) throw error;
      return data as Pipeline[];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["pipelines-admin", companyId] });
    queryClient.invalidateQueries({ queryKey: ["company-pipeline-settings", companyId] });
  };

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from("pipelines").update({ name }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); setEditingId(null); toast.success("Pipeline renamed"); },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pipelines").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Pipeline deleted"); },
    onError: (e) => toast.error(e.message),
  });

  const addMutation = useMutation({
    mutationFn: async (name: string) => {
      const nextPos = pipelines.length > 0 ? Math.max(...pipelines.map(p => p.position)) + 1 : 0;
      const { error } = await supabase
        .from("pipelines")
        .insert({ company_id: companyId!, name, position: nextPos, is_default: pipelines.length === 0 });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); setNewName(""); setIsAdding(false); toast.success("Pipeline created"); },
    onError: (e) => toast.error(e.message),
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      // Unset all defaults for this company, then set the chosen one
      const { error: e1 } = await supabase
        .from("pipelines")
        .update({ is_default: false })
        .eq("company_id", companyId!);
      if (e1) throw e1;
      const { error: e2 } = await supabase
        .from("pipelines")
        .update({ is_default: true })
        .eq("id", id);
      if (e2) throw e2;
    },
    onSuccess: () => { invalidate(); toast.success("Default pipeline updated"); },
    onError: (e) => toast.error(e.message),
  });

  const startEdit = (p: Pipeline) => { setEditingId(p.id); setEditingName(p.name); };
  const confirmEdit = () => {
    if (!editingId || !editingName.trim()) return;
    renameMutation.mutate({ id: editingId, name: editingName.trim() });
  };
  const confirmAdd = () => {
    if (!newName.trim()) return;
    addMutation.mutate(newName.trim());
  };

  return (
    <Collapsible defaultOpen={false} className="group">
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                Pipeline Configuration
              </span>
              <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </CardTitle>
            <CardDescription>
              Manage pipelines for your opportunities
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-2 pt-0">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : pipelines.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pipelines configured yet.</p>
            ) : (
              <div className="space-y-1">
                {pipelines.map((pipeline) => (
                  <div
                    key={pipeline.id}
                    className="flex items-center gap-2 rounded-md border border-border/50 bg-background px-3 py-2"
                  >
                    {editingId === pipeline.id ? (
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
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={confirmEdit} disabled={renameMutation.isPending}>
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="text-sm flex-1 flex items-center gap-2">
                          {pipeline.name}
                          {pipeline.is_default && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Default</Badge>
                          )}
                        </span>
                        {!pipeline.is_default && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            title="Set as default"
                            onClick={() => setDefaultMutation.mutate(pipeline.id)}
                            disabled={setDefaultMutation.isPending}
                          >
                            <Star className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(pipeline)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => {
                            if (pipeline.is_default) {
                              toast.error("Cannot delete the default pipeline");
                              return;
                            }
                            if (confirm(`Delete pipeline "${pipeline.name}" and all its stages?`)) {
                              deleteMutation.mutate(pipeline.id);
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
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="New pipeline name"
                  className="h-8 text-sm flex-1"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmAdd();
                    if (e.key === "Escape") { setIsAdding(false); setNewName(""); }
                  }}
                />
                <Button size="sm" className="h-8" onClick={confirmAdd} disabled={addMutation.isPending || !newName.trim()}>
                  <Check className="h-3.5 w-3.5 mr-1" /> Create
                </Button>
                <Button size="sm" variant="ghost" className="h-8" onClick={() => { setIsAdding(false); setNewName(""); }}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" className="mt-2" onClick={() => setIsAdding(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Pipeline
              </Button>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
