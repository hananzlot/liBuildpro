import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Save, Loader2, Building, Mail, FileText, Settings, Upload, AlertTriangle, Key } from "lucide-react";

interface AppSetting {
  id: string;
  setting_key: string;
  setting_value: string | null;
  setting_type: string | null;
  description: string | null;
  updated_at: string | null;
}

export default function AppDefaultSettings() {
  const queryClient = useQueryClient();
  const [editedSettings, setEditedSettings] = useState<Record<string, string>>({});

  // Fetch app_settings (global defaults)
  const { data: settings, isLoading } = useQuery({
    queryKey: ["app-settings-global"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .order("setting_key");

      if (error) throw error;
      return data as AppSetting[];
    },
  });

  const updateSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      // Check if setting exists
      const { data: existing } = await supabase
        .from("app_settings")
        .select("id")
        .eq("setting_key", key)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("app_settings")
          .update({
            setting_value: value,
            updated_at: new Date().toISOString(),
          })
          .eq("setting_key", key);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("app_settings")
          .insert({
            setting_key: key,
            setting_value: value,
            updated_at: new Date().toISOString(),
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-settings-global"] });
      toast.success("Setting updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update setting: ${error.message}`);
    },
  });

  const handleChange = (key: string, value: string) => {
    setEditedSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = (key: string) => {
    const value = editedSettings[key];
    if (value !== undefined) {
      updateSetting.mutate({ key, value });
      setEditedSettings((prev) => {
        const newState = { ...prev };
        delete newState[key];
        return newState;
      });
    }
  };

  const getValue = (setting: AppSetting) => {
    return editedSettings[setting.setting_key] ?? setting.setting_value ?? "";
  };

  const hasChanges = (key: string) => {
    return editedSettings[key] !== undefined;
  };

  const formatLabel = (key: string) => {
    return key
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  // Group settings by category
  const emailSettings = settings?.filter((s) =>
    ["resend_from_email", "resend_from_name"].includes(s.setting_key)
  );

  const companySettings = settings?.filter((s) =>
    ["company_name", "company_address", "company_phone", "company_website", "license_type", "license_number", "license_holder_name"].includes(s.setting_key)
  );

  const portalSettings = settings?.filter((s) =>
    ["portal_upload_limit_mb", "app_base_url"].includes(s.setting_key)
  );

  const estimateSettings = settings?.filter((s) =>
    ["default_terms_and_conditions", "default_markup_percent", "default_deposit_percent", "default_deposit_max_amount"].includes(s.setting_key)
  );

  const apiKeySettings = settings?.filter((s) =>
    ["openai_api_key", "resend_api_key"].includes(s.setting_key)
  );

  const renderPasswordSettingField = (setting: AppSetting) => (
    <div key={setting.id} className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={setting.setting_key}>{formatLabel(setting.setting_key)}</Label>
        {hasChanges(setting.setting_key) && (
          <Button
            size="sm"
            onClick={() => handleSave(setting.setting_key)}
            disabled={updateSetting.isPending}
          >
            {updateSetting.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Save className="h-3 w-3 mr-1" />
            )}
            Save
          </Button>
        )}
      </div>
      <Input
        id={setting.setting_key}
        type="password"
        value={getValue(setting)}
        onChange={(e) => handleChange(setting.setting_key, e.target.value)}
        placeholder={setting.description || ""}
      />
      {setting.description && (
        <p className="text-xs text-muted-foreground">{setting.description}</p>
      )}
    </div>
  );

  const renderSettingField = (setting: AppSetting) => (
    <div key={setting.id} className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={setting.setting_key}>{formatLabel(setting.setting_key)}</Label>
        {hasChanges(setting.setting_key) && (
          <Button
            size="sm"
            onClick={() => handleSave(setting.setting_key)}
            disabled={updateSetting.isPending}
          >
            {updateSetting.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Save className="h-3 w-3 mr-1" />
            )}
            Save
          </Button>
        )}
      </div>
      <Input
        id={setting.setting_key}
        value={getValue(setting)}
        onChange={(e) => handleChange(setting.setting_key, e.target.value)}
        placeholder={setting.description || ""}
      />
      {setting.description && (
        <p className="text-xs text-muted-foreground">{setting.description}</p>
      )}
    </div>
  );

  const renderTextareaSettingField = (setting: AppSetting) => (
    <div key={setting.id} className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={setting.setting_key}>{formatLabel(setting.setting_key)}</Label>
        {hasChanges(setting.setting_key) && (
          <Button
            size="sm"
            onClick={() => handleSave(setting.setting_key)}
            disabled={updateSetting.isPending}
          >
            {updateSetting.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Save className="h-3 w-3 mr-1" />
            )}
            Save
          </Button>
        )}
      </div>
      <Textarea
        id={setting.setting_key}
        value={getValue(setting)}
        onChange={(e) => handleChange(setting.setting_key, e.target.value)}
        placeholder={setting.description || ""}
        rows={12}
        className="font-mono text-sm"
      />
      {setting.description && (
        <p className="text-xs text-muted-foreground">{setting.description}</p>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <SuperAdminLayout title="App Default Settings" description="Global default settings for new companies">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </SuperAdminLayout>
    );
  }

  return (
    <SuperAdminLayout 
      title="App Default Settings" 
      description="Global default settings used as fallback for new companies"
    >
      <div className="space-y-6 p-6 max-w-4xl">
        {/* Info Banner */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="flex items-start gap-3 pt-6">
            <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <strong>Note:</strong> These settings serve as defaults for new companies. 
              Existing companies can override these values in their own settings. 
              Changes here won't affect companies that have already customized their settings.
            </div>
          </CardContent>
        </Card>

        {/* Email Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Default Email Settings
            </CardTitle>
            <CardDescription>
              Default email sender configuration for new companies
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {emailSettings?.map(renderSettingField)}
          </CardContent>
        </Card>

        {/* Company Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Default Company Information
            </CardTitle>
            <CardDescription>
              Template company information for new tenants
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {companySettings?.map(renderSettingField)}
          </CardContent>
        </Card>

        {/* Portal Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Default Portal Settings
            </CardTitle>
            <CardDescription>
              Default customer portal configuration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {portalSettings?.map(renderSettingField)}
          </CardContent>
        </Card>

        {/* Estimate Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Default Estimate Settings
            </CardTitle>
            <CardDescription>
              Default values for new estimates across all companies
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {estimateSettings?.map((setting) =>
              setting.setting_key === "default_terms_and_conditions"
                ? renderTextareaSettingField(setting)
                : renderSettingField(setting)
            )}
          </CardContent>
        </Card>

        {/* API Keys Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Platform API Keys
            </CardTitle>
            <CardDescription>
              Default API keys for the platform. Companies can override these in their own settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {apiKeySettings && apiKeySettings.length > 0 ? (
              apiKeySettings.map(renderPasswordSettingField)
            ) : (
              <>
                {/* OpenAI API Key */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="openai_api_key">OpenAI API Key</Label>
                    {hasChanges("openai_api_key") && (
                      <Button
                        size="sm"
                        onClick={() => handleSave("openai_api_key")}
                        disabled={updateSetting.isPending}
                      >
                        {updateSetting.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Save className="h-3 w-3 mr-1" />
                        )}
                        Save
                      </Button>
                    )}
                  </div>
                  <Input
                    id="openai_api_key"
                    type="password"
                    value={editedSettings["openai_api_key"] ?? ""}
                    onChange={(e) => handleChange("openai_api_key", e.target.value)}
                    placeholder="sk-..."
                  />
                  <p className="text-xs text-muted-foreground">Platform-wide OpenAI API key for AI-powered features</p>
                </div>

                {/* Resend API Key */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="resend_api_key">Resend API Key</Label>
                    {hasChanges("resend_api_key") && (
                      <Button
                        size="sm"
                        onClick={() => handleSave("resend_api_key")}
                        disabled={updateSetting.isPending}
                      >
                        {updateSetting.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Save className="h-3 w-3 mr-1" />
                        )}
                        Save
                      </Button>
                    )}
                  </div>
                  <Input
                    id="resend_api_key"
                    type="password"
                    value={editedSettings["resend_api_key"] ?? ""}
                    onChange={(e) => handleChange("resend_api_key", e.target.value)}
                    placeholder="re_..."
                  />
                  <p className="text-xs text-muted-foreground">Platform-wide Resend API key for email delivery</p>
                </div>
              </>
            )}

            <div className="flex items-start gap-2 p-3 bg-muted border rounded-lg text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-muted-foreground">
                <strong>Note:</strong> These platform-level API keys serve as defaults. 
                Individual companies can override them by setting their own keys in Company Settings.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </SuperAdminLayout>
  );
}
