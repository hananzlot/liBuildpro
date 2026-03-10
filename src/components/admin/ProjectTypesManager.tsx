import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Plus, Trash2, ArrowUp, ArrowDown, Pencil, Check, X, Loader2, Layers } from "lucide-react";
import { toast } from "sonner";

interface TypeEdit {
  id: string | null;
  name: string;
  sort_order: number;
  is_default: boolean;
}

const DEFAULT_PROJECT_TYPES = [
  "Residential",
  "Commercial",
  "Insurance",
  "Other",
];

export function ProjectTypesManager() {
  const { companyId } = useAuth();
  const queryClient = useQueryClient();
  const [types, setTypes] = useState<TypeEdit[]>([]);
  const [newTypeName, setNewTypeName] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: dbTypes, refetch } = useQuery({
    queryKey: ["project-types-admin", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_types")
        .select("*")
        .eq("company_id", companyId!)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  useEffect(() => {
    if (dbTypes && !loaded) {
      if (dbTypes.length > 0) {
        setTypes(dbTypes.map((t) => ({
          id: t.id,
          name: t.name,
          sort_order: t.sort_order ?? 0,
          is_default: t.is_default ?? false,
        })));
      } else {
        setTypes(DEFAULT_PROJECT_TYPES.map((name, idx) => ({
          id: null,
          name,
          sort_order: idx,
          is_default: true,
        })));
      }
      setLoaded(true);
    }
  }, [dbTypes, loaded]);

  const handleAdd = () => {
    const trimmed = newTypeName.trim();
    if (!trimmed) return;
    if (types.some((t) => t.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("Type already exists");
      return;
    }
    setTypes([...types, { id: null, name: trimmed, sort_order: types.length, is_default: false }]);
    setNewTypeName("");
  };

  const handleRemove = (index: number) => {
    setTypes(types.filter((_, i) => i !== index).map((t, i) => ({ ...t, sort_order: i })));
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    const newArr = [...types];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newArr.length) return;
    [newArr[index], newArr[newIndex]] = [newArr[newIndex], newArr[index]];
    setTypes(newArr.map((t, i) => ({ ...t, sort_order: i })));
  };

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setEditingName(types[index].name);
  };

  const confirmEdit = () => {
    if (editingIndex === null) return;
    const trimmed = editingName.trim();
    if (!trimmed) return;
    if (types.some((t, i) => i !== editingIndex && t.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("Type name already exists");
      return;
    }
    const updated = [...types];
    updated[editingIndex] = { ...updated[editingIndex], name: trimmed };
    setTypes(updated);
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
      const { data: existing } = await supabase
        .from("project_types")
        .select("id")
        .eq("company_id", companyId);

      const existingIds = new Set((existing || []).map((e) => e.id));
      const currentIds = new Set(types.filter((t) => t.id).map((t) => t.id));

      // Delete removed types
      const toDelete = [...existingIds].filter((id) => !currentIds.has(id));
      if (toDelete.length > 0) {
        await supabase.from("project_types").delete().in("id", toDelete);
      }

      // Upsert all current types
      for (const type of types) {
        if (type.id) {
          await supabase
            .from("project_types")
            .update({ name: type.name, sort_order: type.sort_order })
            .eq("id", type.id);
        } else {
          await supabase.from("project_types").insert({
            company_id: companyId,
            name: type.name,
            sort_order: type.sort_order,
            is_default: type.is_default,
          });
        }
      }

      toast.success("Project types saved");
      await refetch();
      setLoaded(false);
      queryClient.invalidateQueries({ queryKey: ["project-types", companyId] });
    } catch (err) {
      toast.error(`Failed to save: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = () => {
    if (!dbTypes) return types.length > 0;
    if (dbTypes.length !== types.length) return true;
    return types.some((t, i) => {
      const db = dbTypes[i];
      if (!db) return true;
      return t.id !== db.id || t.name !== db.name || t.sort_order !== (db.sort_order ?? 0);
    });
  };

  return (
    <Collapsible defaultOpen={false} className="group">
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Project Types
              </span>
              <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </CardTitle>
            <CardDescription>
              Manage the available project types across your company
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            <div className="space-y-2">
              {types.map((type, index) => (
                <div key={type.id || `new-${index}`} className="flex items-center gap-2 group/item">
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
                      <span className="flex-1 text-sm">{type.name}</span>
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
                          disabled={index === types.length - 1}
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
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                placeholder="New type name..."
                className="h-8"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                }}
              />
              <Button variant="outline" size="sm" onClick={handleAdd} disabled={!newTypeName.trim()}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add
              </Button>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving || !hasChanges()} size="sm">
                {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                Save Types
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
