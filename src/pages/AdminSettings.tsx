import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Settings, Mail, Building, Save, Loader2, AlertTriangle } from "lucide-react";
import { Navigate } from "react-router-dom";

interface AppSetting {
  id: string;
  setting_key: string;
  setting_value: string | null;
  setting_type: string | null;
  description: string | null;
  updated_at: string;
}

export default function AdminSettings() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [editedSettings, setEditedSettings] = useState<Record<string, string>>({});

  const { data: settings, isLoading } = useQuery({
    queryKey: ["app-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .order("setting_key");

      if (error) throw error;
      return data as AppSetting[];
    },
    enabled: isAdmin,
  });

  const updateSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { error } = await supabase
        .from("app_settings")
        .update({ 
          setting_value: value, 
          updated_at: new Date().toISOString() 
        })
        .eq("setting_key", key);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-settings"] });
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

  if (authLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const emailSettings = settings?.filter((s) =>
    ["resend_from_email", "resend_from_name"].includes(s.setting_key)
  );

  const companySettings = settings?.filter((s) =>
    ["company_name"].includes(s.setting_key)
  );

  const formatLabel = (key: string) => {
    return key
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

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

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Settings className="h-8 w-8" />
            Admin Settings
          </h1>
          <p className="text-muted-foreground">
            Configure application settings and integrations
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Email Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Email Settings (Resend)
                </CardTitle>
                <CardDescription>
                  Configure email sending for proposals and notifications. Make sure your domain is verified at{" "}
                  <a
                    href="https://resend.com/domains"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    resend.com/domains
                  </a>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {emailSettings?.map(renderSettingField)}

                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="text-amber-800">
                    <strong>Important:</strong> The "From Email" must use a domain you've verified in Resend.
                    For example, if you verified <code>caprobuilders.com</code>, use an email like{" "}
                    <code>proposals@caprobuilders.com</code>.
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Company Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Company Settings
                </CardTitle>
                <CardDescription>
                  General company information used in emails and documents
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {companySettings?.map(renderSettingField)}
              </CardContent>
            </Card>

            <Separator />

            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="text-muted-foreground">API Keys</CardTitle>
                <CardDescription>
                  API keys are stored securely as Supabase secrets and cannot be viewed or edited here.
                  To update the Resend API key, contact your administrator or update it directly in the{" "}
                  <a
                    href="https://supabase.com/dashboard/project/mspujwrfhbobrxhofxzv/settings/functions"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    Supabase dashboard
                  </a>
                  .
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
