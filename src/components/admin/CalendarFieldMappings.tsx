import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Save, ArrowRight, Calendar, User, Briefcase, FileText, Plus, Trash2 } from "lucide-react";

// Google Calendar event fields that can be mapped
const GOOGLE_EVENT_FIELDS = [
  { value: "summary", label: "Event Title (summary)" },
  { value: "description", label: "Event Description" },
  { value: "location", label: "Event Location" },
  { value: "organizer_email", label: "Organizer Email" },
  { value: "attendee_name", label: "First Attendee Name" },
  { value: "attendee_email", label: "First Attendee Email" },
];

// Target fields for Contact
const CONTACT_FIELDS = [
  { value: "none", label: "Do not map" },
  { value: "contact_name", label: "Contact Name" },
  { value: "first_name", label: "First Name" },
  { value: "last_name", label: "Last Name" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
];

// Target fields for Opportunity
const OPPORTUNITY_FIELDS = [
  { value: "none", label: "Do not map" },
  { value: "name", label: "Opportunity Name" },
  { value: "scope_of_work", label: "Scope of Work" },
  { value: "address", label: "Address" },
  { value: "notes", label: "Notes" },
];

interface FieldMapping {
  google_field: string;
  contact_field: string | null;
  opportunity_field: string | null;
}

interface DescriptionPattern {
  id: string;
  pattern: string;
  contact_field: string | null;
  opportunity_field: string | null;
}

interface CalendarMappingSettings {
  enabled: boolean;
  create_contact: boolean;
  create_opportunity: boolean;
  default_pipeline_id: string | null;
  default_stage_id: string | null;
  mappings: FieldMapping[];
  parse_description: boolean;
  description_patterns: DescriptionPattern[];
  combine_address_fields: boolean;
}

const DEFAULT_DESCRIPTION_PATTERNS: DescriptionPattern[] = [
  { id: "1", pattern: "NAME:", contact_field: "contact_name", opportunity_field: "name" },
  { id: "2", pattern: "EMAIL:", contact_field: "email", opportunity_field: null },
  { id: "3", pattern: "MOBILE:", contact_field: "phone", opportunity_field: null },
  { id: "4", pattern: "ADDRESS:", contact_field: null, opportunity_field: "address" },
  { id: "5", pattern: "Project:", contact_field: null, opportunity_field: "scope_of_work" },
  { id: "6", pattern: "Project Goal:", contact_field: null, opportunity_field: "notes" },
];

const DEFAULT_SETTINGS: CalendarMappingSettings = {
  enabled: false,
  create_contact: true,
  create_opportunity: true,
  default_pipeline_id: null,
  default_stage_id: null,
  mappings: [
    { google_field: "summary", contact_field: "contact_name", opportunity_field: "name" },
    { google_field: "description", contact_field: null, opportunity_field: "scope_of_work" },
    { google_field: "location", contact_field: null, opportunity_field: "address" },
    { google_field: "attendee_email", contact_field: "email", opportunity_field: null },
  ],
  parse_description: false,
  description_patterns: DEFAULT_DESCRIPTION_PATTERNS,
  combine_address_fields: true,
};

export function CalendarFieldMappings() {
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<CalendarMappingSettings>(DEFAULT_SETTINGS);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch existing settings
  const { data: savedSettings, isLoading } = useQuery({
    queryKey: ["calendar-field-mappings", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("setting_value")
        .eq("company_id", companyId)
        .eq("setting_key", "calendar_opportunity_mappings")
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data?.setting_value ? JSON.parse(data.setting_value) : null;
    },
    enabled: !!companyId,
  });

  // Fetch pipelines for default selection
  const { data: pipelines } = useQuery({
    queryKey: ["pipelines", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("opportunities")
        .select("pipeline_id, pipeline_name")
        .eq("company_id", companyId)
        .not("pipeline_id", "is", null);

      const uniquePipelines = new Map<string, string>();
      data?.forEach((opp) => {
        if (opp.pipeline_id && opp.pipeline_name) {
          uniquePipelines.set(opp.pipeline_id, opp.pipeline_name);
        }
      });

      return Array.from(uniquePipelines, ([id, name]) => ({ id, name }));
    },
    enabled: !!companyId,
  });

  // Fetch stages for selected pipeline
  const { data: stages } = useQuery({
    queryKey: ["pipeline-stages", companyId, settings.default_pipeline_id],
    queryFn: async () => {
      if (!settings.default_pipeline_id) return [];

      const { data } = await supabase
        .from("opportunities")
        .select("pipeline_stage_id, stage_name")
        .eq("company_id", companyId)
        .eq("pipeline_id", settings.default_pipeline_id)
        .not("pipeline_stage_id", "is", null);

      const uniqueStages = new Map<string, string>();
      data?.forEach((opp) => {
        if (opp.pipeline_stage_id && opp.stage_name) {
          uniqueStages.set(opp.pipeline_stage_id, opp.stage_name);
        }
      });

      return Array.from(uniqueStages, ([id, name]) => ({ id, name }));
    },
    enabled: !!companyId && !!settings.default_pipeline_id,
  });

  // Initialize settings from saved data
  useEffect(() => {
    if (savedSettings) {
      setSettings({ ...DEFAULT_SETTINGS, ...savedSettings });
    }
  }, [savedSettings]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("company_settings")
        .upsert({
          company_id: companyId,
          setting_key: "calendar_opportunity_mappings",
          setting_value: JSON.stringify(settings),
          setting_type: "json",
          description: "Field mappings for creating opportunities from Google Calendar events",
        }, { onConflict: "company_id,setting_key" });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Calendar mapping settings saved");
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["calendar-field-mappings"] });
    },
    onError: (error) => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  const updateSetting = <K extends keyof CalendarMappingSettings>(
    key: K,
    value: CalendarMappingSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const updateMapping = (index: number, field: keyof FieldMapping, value: string | null) => {
    const newMappings = [...settings.mappings];
    newMappings[index] = { ...newMappings[index], [field]: value === "none" ? null : value };
    setSettings((prev) => ({ ...prev, mappings: newMappings }));
    setHasChanges(true);
  };

  const updateDescriptionPattern = (id: string, field: keyof DescriptionPattern, value: string | null) => {
    const newPatterns = settings.description_patterns.map((p) =>
      p.id === id ? { ...p, [field]: value === "none" ? null : value } : p
    );
    setSettings((prev) => ({ ...prev, description_patterns: newPatterns }));
    setHasChanges(true);
  };

  const addDescriptionPattern = () => {
    const newPattern: DescriptionPattern = {
      id: Date.now().toString(),
      pattern: "",
      contact_field: null,
      opportunity_field: null,
    };
    setSettings((prev) => ({
      ...prev,
      description_patterns: [...prev.description_patterns, newPattern],
    }));
    setHasChanges(true);
  };

  const removeDescriptionPattern = (id: string) => {
    setSettings((prev) => ({
      ...prev,
      description_patterns: prev.description_patterns.filter((p) => p.id !== id),
    }));
    setHasChanges(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">Calendar → Opportunity Mapping</CardTitle>
              <CardDescription>
                Automatically create contacts and opportunities from imported Google Calendar events
              </CardDescription>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={!hasChanges || saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
          <div>
            <Label htmlFor="enabled" className="text-base font-medium">
              Enable Auto-Creation
            </Label>
            <p className="text-sm text-muted-foreground">
              When enabled, new calendar events will automatically create leads
            </p>
          </div>
          <Switch
            id="enabled"
            checked={settings.enabled}
            onCheckedChange={(checked) => updateSetting("enabled", checked)}
          />
        </div>

        {settings.enabled && (
          <>
            {/* Creation Options */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="create_contact">Create Contact</Label>
                </div>
                <Switch
                  id="create_contact"
                  checked={settings.create_contact}
                  onCheckedChange={(checked) => updateSetting("create_contact", checked)}
                />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="create_opportunity">Create Opportunity</Label>
                </div>
                <Switch
                  id="create_opportunity"
                  checked={settings.create_opportunity}
                  onCheckedChange={(checked) => updateSetting("create_opportunity", checked)}
                />
              </div>
            </div>

            {/* Default Pipeline/Stage Selection */}
            {settings.create_opportunity && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Default Pipeline</Label>
                  <Select
                    value={settings.default_pipeline_id || ""}
                    onValueChange={(value) => {
                      updateSetting("default_pipeline_id", value || null);
                      updateSetting("default_stage_id", null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select pipeline..." />
                    </SelectTrigger>
                    <SelectContent>
                      {pipelines?.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Default Stage</Label>
                  <Select
                    value={settings.default_stage_id || ""}
                    onValueChange={(value) => updateSetting("default_stage_id", value || null)}
                    disabled={!settings.default_pipeline_id}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select stage..." />
                    </SelectTrigger>
                    <SelectContent>
                      {stages?.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Field Mappings */}
            <div className="space-y-3">
              <Label className="text-base">Field Mappings</Label>
              <div className="space-y-2">
                {settings.mappings.map((mapping, index) => (
                  <div
                    key={mapping.google_field}
                    className="grid grid-cols-[1fr,auto,1fr,1fr] gap-2 items-center p-2 rounded-lg bg-muted/30"
                  >
                    <div className="text-sm font-medium">
                      {GOOGLE_EVENT_FIELDS.find((f) => f.value === mapping.google_field)?.label}
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <Select
                      value={mapping.contact_field || "none"}
                      onValueChange={(value) => updateMapping(index, "contact_field", value)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONTACT_FIELDS.map((f) => (
                          <SelectItem key={f.value} value={f.value}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={mapping.opportunity_field || "none"}
                      onValueChange={(value) => updateMapping(index, "opportunity_field", value)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPPORTUNITY_FIELDS.map((f) => (
                          <SelectItem key={f.value} value={f.value}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Map Google Calendar event fields to Contact and Opportunity fields
              </p>
            </div>

            {/* Description Parsing Section */}
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <div>
                    <Label htmlFor="parse_description" className="text-base font-medium">
                      Parse Description Fields
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Extract structured data (e.g., "NAME: John") from event descriptions
                    </p>
                  </div>
                </div>
                <Switch
                  id="parse_description"
                  checked={settings.parse_description}
                  onCheckedChange={(checked) => updateSetting("parse_description", checked)}
                />
              </div>

              {settings.parse_description && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Description Patterns</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addDescriptionPattern}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Pattern
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <div className="grid grid-cols-[1fr,auto,1fr,1fr,auto] gap-2 items-center px-2 text-xs font-medium text-muted-foreground">
                      <span>Pattern (e.g., "NAME:")</span>
                      <span></span>
                      <span>Contact Field</span>
                      <span>Opportunity Field</span>
                      <span></span>
                    </div>
                    {settings.description_patterns.map((pattern) => (
                      <div
                        key={pattern.id}
                        className="grid grid-cols-[1fr,auto,1fr,1fr,auto] gap-2 items-center p-2 rounded-lg bg-muted/30"
                      >
                        <Input
                          value={pattern.pattern}
                          onChange={(e) =>
                            updateDescriptionPattern(pattern.id, "pattern", e.target.value)
                          }
                          placeholder="FIELD_NAME:"
                          className="h-8 text-xs"
                        />
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <Select
                          value={pattern.contact_field || "none"}
                          onValueChange={(value) =>
                            updateDescriptionPattern(pattern.id, "contact_field", value)
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CONTACT_FIELDS.map((f) => (
                              <SelectItem key={f.value} value={f.value}>
                                {f.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={pattern.opportunity_field || "none"}
                          onValueChange={(value) =>
                            updateDescriptionPattern(pattern.id, "opportunity_field", value)
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {OPPORTUNITY_FIELDS.map((f) => (
                              <SelectItem key={f.value} value={f.value}>
                                {f.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeDescriptionPattern(pattern.id)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <Label htmlFor="combine_address">Combine Address Fields</Label>
                      <p className="text-xs text-muted-foreground">
                        Combine ADDRESS, CITY, STATE into a single address
                      </p>
                    </div>
                    <Switch
                      id="combine_address"
                      checked={settings.combine_address_fields}
                      onCheckedChange={(checked) =>
                        updateSetting("combine_address_fields", checked)
                      }
                    />
                  </div>

                  <div className="p-3 rounded-lg bg-muted/30 border">
                    <p className="text-xs font-medium mb-2">Example Description Format:</p>
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">
{`NAME: John Doe
EMAIL: john@example.com
MOBILE: +1 555-1234
ADDRESS: 123 Main St
CITY: Los Angeles
STATE: California
Project: Pavers
Project Goal: Replace Backyard`}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
