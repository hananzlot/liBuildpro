import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { OnboardingStep } from "@/hooks/useOnboardingProgress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Save, Loader2, Sparkles, Info, Upload, CheckCircle2 } from "lucide-react";
import { LogoUpload } from "@/components/admin/LogoUpload";

interface OnboardingStepContentProps {
  step: OnboardingStep;
  useDefault: boolean;
  onUseDefaultChange: (value: boolean) => void;
}

export function OnboardingStepContent({ 
  step, 
  useDefault, 
  onUseDefaultChange 
}: OnboardingStepContentProps) {
  const { companyId } = useAuth();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch app defaults
  const { data: defaults } = useQuery({
    queryKey: ["app-settings-defaults"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("setting_key, setting_value, description");
      
      const map: Record<string, { value: string | null; description: string | null }> = {};
      data?.forEach((s) => {
        map[s.setting_key] = { value: s.setting_value, description: s.description };
      });
      return map;
    },
  });

  // Fetch current company settings
  const { data: currentSettings, refetch } = useQuery({
    queryKey: ["company-settings-step", companyId, step.id],
    queryFn: async () => {
      if (!companyId) return {};
      
      const { data } = await supabase
        .from("company_settings")
        .select("setting_key, setting_value")
        .eq("company_id", companyId)
        .in("setting_key", step.settingsKeys);
      
      const map: Record<string, string> = {};
      data?.forEach((s) => {
        if (s.setting_value) map[s.setting_key] = s.setting_value;
      });
      return map;
    },
    enabled: !!companyId,
  });

  // Initialize values from current settings or defaults
  useEffect(() => {
    if (currentSettings) {
      const newValues: Record<string, string> = {};
      step.settingsKeys.forEach((key) => {
        newValues[key] = currentSettings[key] || "";
      });
      setValues(newValues);
    }
  }, [currentSettings, step.settingsKeys]);

  // Apply defaults
  useEffect(() => {
    if (useDefault && defaults) {
      const newValues: Record<string, string> = {};
      step.settingsKeys.forEach((key) => {
        newValues[key] = defaults[key]?.value || "";
      });
      setValues(newValues);
      setHasChanges(true);
    }
  }, [useDefault, defaults, step.settingsKeys]);

  const saveSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      if (!companyId) throw new Error("No company ID");
      
      const { error } = await supabase
        .from("company_settings")
        .upsert({
          company_id: companyId,
          setting_key: key,
          setting_value: value,
          updated_at: new Date().toISOString(),
        }, { onConflict: "company_id,setting_key" });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-settings"] });
      queryClient.invalidateQueries({ queryKey: ["company-settings-step"] });
      queryClient.invalidateQueries({ queryKey: ["company-settings-onboarding"] });
    },
  });

  const handleSaveAll = async () => {
    try {
      for (const key of step.settingsKeys) {
        if (values[key] !== undefined && values[key] !== currentSettings?.[key]) {
          await saveSetting.mutateAsync({ key, value: values[key] });
        }
      }
      toast.success("Settings saved successfully");
      setHasChanges(false);
      refetch();
    } catch (error) {
      toast.error("Failed to save settings");
    }
  };

  const handleChange = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
    onUseDefaultChange(false); // Clear "use default" when manually editing
  };

  const formatLabel = (key: string) => {
    return key
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  // Special case for logo step
  if (step.id === "logo") {
    return (
      <div className="space-y-4">
        <LogoUpload />
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Your logo will appear on estimates, invoices, and the customer portal.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Special case for integrations
  if (step.id === "ghl_integration" || step.id === "quickbooks") {
    return (
      <div className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            {step.id === "ghl_integration" 
              ? "GoHighLevel integration can be configured in Admin Settings → GoHighLevel tab after completing onboarding."
              : "QuickBooks integration can be configured in Admin Settings → QuickBooks tab after completing onboarding."
            }
          </AlertDescription>
        </Alert>
        <p className="text-sm text-muted-foreground">
          You can skip this step for now and set it up later.
        </p>
      </div>
    );
  }

  // Check if any defaults are available
  const hasDefaults = step.settingsKeys.some((key) => defaults?.[key]?.value);

  return (
    <div className="space-y-6">
      {/* Use Defaults Option */}
      {hasDefaults && (
        <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/10">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium text-sm">Use Platform Defaults</p>
              <p className="text-xs text-muted-foreground">
                Apply recommended default values to get started quickly
              </p>
            </div>
          </div>
          <Switch
            checked={useDefault}
            onCheckedChange={(checked) => {
              onUseDefaultChange(checked);
            }}
          />
        </div>
      )}

      {/* Settings Fields */}
      <div className="space-y-4">
        {step.settingsKeys.map((key) => {
          const isTextarea = key.includes("terms") || key.includes("conditions");
          const defaultValue = defaults?.[key]?.value;
          const description = defaults?.[key]?.description;
          const currentValue = values[key] || "";
          const hasValue = currentValue.trim() !== "";

          return (
            <div key={key} className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor={key} className="flex items-center gap-2">
                  {formatLabel(key)}
                  {hasValue && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
                  )}
                </Label>
                {defaultValue && !useDefault && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleChange(key, defaultValue)}
                    className="text-xs h-6"
                  >
                    Use Default
                  </Button>
                )}
              </div>
              
              {isTextarea ? (
                <Textarea
                  id={key}
                  value={currentValue}
                  onChange={(e) => handleChange(key, e.target.value)}
                  placeholder={description || `Enter ${formatLabel(key).toLowerCase()}`}
                  rows={8}
                  className="font-mono text-sm"
                />
              ) : (
                <Input
                  id={key}
                  value={currentValue}
                  onChange={(e) => handleChange(key, e.target.value)}
                  placeholder={description || `Enter ${formatLabel(key).toLowerCase()}`}
                />
              )}
              
              {description && (
                <p className="text-xs text-muted-foreground">{description}</p>
              )}
              
              {defaultValue && (
                <p className="text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-xs font-normal mr-1">
                    Default
                  </Badge>
                  {defaultValue.length > 100 
                    ? `${defaultValue.substring(0, 100)}...` 
                    : defaultValue
                  }
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Save Button */}
      {hasChanges && (
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSaveAll} disabled={saveSetting.isPending}>
            {saveSetting.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      )}
    </div>
  );
}
