import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Save, Loader2, Tag, X, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface StageBadgeMapping {
  badgeName: string;
  stages: string[];
  color?: string;
}

const BADGE_COLORS = [
  { value: "amber", label: "Amber", class: "bg-amber-500/20 text-amber-500" },
  { value: "red", label: "Red", class: "bg-red-500/20 text-red-500" },
  { value: "blue", label: "Blue", class: "bg-blue-500/20 text-blue-500" },
  { value: "green", label: "Green", class: "bg-green-500/20 text-green-500" },
  { value: "purple", label: "Purple", class: "bg-purple-500/20 text-purple-500" },
  { value: "orange", label: "Orange", class: "bg-orange-500/20 text-orange-500" },
  { value: "teal", label: "Teal", class: "bg-teal-500/20 text-teal-500" },
];

export function StageBadgeMappingsEditor() {
  const { companyId } = useAuth();
  const queryClient = useQueryClient();
  const [mappings, setMappings] = useState<StageBadgeMapping[]>([]);
  const [newBadgeName, setNewBadgeName] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Fetch available pipeline stages
  const { data: pipelineStages = [] } = useQuery({
    queryKey: ["pipeline-stages-for-badges", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase
        .from("company_settings")
        .select("setting_value")
        .eq("company_id", companyId)
        .eq("setting_key", "pipeline_stages")
        .maybeSingle();

      if (!data?.setting_value) return [];

      try {
        const parsed = JSON.parse(data.setting_value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    },
  });

  // Fetch existing mappings
  const { data: existingMappings, isLoading } = useQuery({
    queryKey: ["stage-badge-mappings", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase
        .from("company_settings")
        .select("setting_value")
        .eq("company_id", companyId)
        .eq("setting_key", "stage_badge_mappings")
        .maybeSingle();

      if (!data?.setting_value) return [];

      try {
        return JSON.parse(data.setting_value) as StageBadgeMapping[];
      } catch {
        return [];
      }
    },
  });

  useEffect(() => {
    if (existingMappings && !hasUnsavedChanges) {
      setMappings(existingMappings);
    }
  }, [existingMappings, hasUnsavedChanges]);

  const saveMutation = useMutation({
    mutationFn: async (newMappings: StageBadgeMapping[]) => {
      if (!companyId) throw new Error("No company ID");

      const { error } = await supabase
        .from("company_settings")
        .upsert(
          {
            company_id: companyId,
            setting_key: "stage_badge_mappings",
            setting_value: JSON.stringify(newMappings),
            setting_type: "json",
            description: "Stage to badge category mappings for dashboard filters",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "company_id,setting_key" }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stage-badge-mappings", companyId] });
      toast.success("Badge mappings saved");
      setHasUnsavedChanges(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  const handleAddBadge = () => {
    if (!newBadgeName.trim()) return;
    if (mappings.some(m => m.badgeName.toLowerCase() === newBadgeName.toLowerCase())) {
      toast.error("Badge name already exists");
      return;
    }
    setMappings([...mappings, { badgeName: newBadgeName.trim(), stages: [], color: "amber" }]);
    setNewBadgeName("");
    setHasUnsavedChanges(true);
  };

  const handleRemoveBadge = (badgeName: string) => {
    setMappings(mappings.filter(m => m.badgeName !== badgeName));
    setHasUnsavedChanges(true);
  };

  const handleToggleStage = (badgeName: string, stageName: string) => {
    setMappings(mappings.map(m => {
      if (m.badgeName !== badgeName) return m;
      const hasStage = m.stages.includes(stageName);
      return {
        ...m,
        stages: hasStage
          ? m.stages.filter(s => s !== stageName)
          : [...m.stages, stageName]
      };
    }));
    setHasUnsavedChanges(true);
  };

  const handleColorChange = (badgeName: string, color: string) => {
    setMappings(mappings.map(m => 
      m.badgeName === badgeName ? { ...m, color } : m
    ));
    setHasUnsavedChanges(true);
  };

  const getColorClass = (color?: string) => {
    return BADGE_COLORS.find(c => c.value === color)?.class || "bg-amber-500/20 text-amber-500";
  };

  // Get stages that are already assigned to other badges
  const getAssignedStages = (excludeBadgeName: string): Set<string> => {
    const assigned = new Set<string>();
    mappings.forEach(m => {
      if (m.badgeName !== excludeBadgeName) {
        m.stages.forEach(s => assigned.add(s));
      }
    });
    return assigned;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Stage Badge Mappings
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Collapsible defaultOpen={false} className="group">
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Stage Badge Mappings
                {hasUnsavedChanges && (
                  <Badge variant="outline" className="ml-2 text-amber-500 border-amber-500">
                    Unsaved changes
                  </Badge>
                )}
              </span>
              <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </CardTitle>
            <CardDescription>
              Define custom badge categories and assign pipeline stages to them for dashboard filters
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-6">
            {/* Existing Badges */}
            <div className="space-y-4">
              {mappings.length === 0 ? (
                <div className="p-4 border border-dashed rounded-lg text-center text-muted-foreground">
                  No badge categories defined yet. Add one below.
                </div>
              ) : (
                mappings.map((mapping) => {
                  const assignedElsewhere = getAssignedStages(mapping.badgeName);
                  return (
                    <div
                      key={mapping.badgeName}
                      className="p-4 border rounded-lg space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge className={getColorClass(mapping.color)}>
                            {mapping.badgeName}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            ({mapping.stages.length} stages)
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Select
                            value={mapping.color || "amber"}
                            onValueChange={(val) => handleColorChange(mapping.badgeName, val)}
                          >
                            <SelectTrigger className="w-28 h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {BADGE_COLORS.map(c => (
                                <SelectItem key={c.value} value={c.value}>
                                  <span className={`px-2 py-0.5 rounded ${c.class}`}>{c.label}</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleRemoveBadge(mapping.badgeName)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Stage Selection */}
                      <div>
                        <Label className="text-xs text-muted-foreground mb-2 block">
                          Select stages that count toward this badge:
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          {pipelineStages.map((stage: string) => {
                            const isSelected = mapping.stages.includes(stage);
                            const isAssignedElsewhere = assignedElsewhere.has(stage);
                            return (
                              <button
                                key={stage}
                                type="button"
                                disabled={isAssignedElsewhere}
                                onClick={() => handleToggleStage(mapping.badgeName, stage)}
                                className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                                  isSelected
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : isAssignedElsewhere
                                    ? "bg-muted text-muted-foreground border-muted cursor-not-allowed opacity-50"
                                    : "bg-background hover:bg-muted border-border"
                                }`}
                                title={isAssignedElsewhere ? "Already assigned to another badge" : ""}
                              >
                                {stage}
                                {isSelected && <X className="h-3 w-3 ml-1 inline" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Add New Badge */}
            <div className="flex gap-2">
              <Input
                value={newBadgeName}
                onChange={(e) => setNewBadgeName(e.target.value)}
                placeholder="New badge name (e.g., No Contact, Follow Up)..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddBadge();
                  }
                }}
              />
              <Button
                variant="outline"
                onClick={handleAddBadge}
                disabled={!newBadgeName.trim()}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Badge
              </Button>
            </div>

            {/* Save Button */}
            {hasUnsavedChanges && (
              <div className="flex justify-end pt-4 border-t">
                <Button
                  onClick={() => saveMutation.mutate(mappings)}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Badge Mappings
                </Button>
              </div>
            )}

            <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
              <strong>Tip:</strong> Badge mappings let you group multiple pipeline stages under a single filter category. 
              For example, you could create a "No Contact" badge that includes both "New Lead" and "Not Contacted" stages.
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
