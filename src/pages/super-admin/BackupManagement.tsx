import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Database, 
  Download, 
  Cloud, 
  Key, 
  FileCode, 
  Settings, 
  Calendar,
  Clock,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  HardDrive,
  Archive
} from "lucide-react";
import { toast } from "sonner";

interface BackupConfig {
  enabled: boolean;
  frequency: "daily" | "weekly" | "monthly";
  time: string;
  retentionDays: number;
}

interface BackupItem {
  id: string;
  type: "database" | "storage" | "settings" | "full";
  createdAt: string;
  size: string;
  status: "completed" | "failed" | "in_progress";
  downloadUrl?: string;
}

export default function BackupManagement() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("manual");
  const [backupProgress, setBackupProgress] = useState<Record<string, number>>({});
  const [isBackingUp, setIsBackingUp] = useState<Record<string, boolean>>({});
  
  const [scheduleConfig, setScheduleConfig] = useState<BackupConfig>({
    enabled: false,
    frequency: "daily",
    time: "02:00",
    retentionDays: 30,
  });

  // Backup history is stored locally for now (no dedicated table)
  const [backupHistory, setBackupHistory] = useState<BackupItem[]>([]);
  const historyLoading = false;

  // Fetch schedule config
  const { data: savedConfig } = useQuery({
    queryKey: ["backup-schedule-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "backup_schedule_config")
        .single();
      
      if (error && error.code !== "PGRST116") return null;
      return data?.setting_value ? JSON.parse(data.setting_value) : null;
    },
  });

  // Generate pg_dump script
  const generatePgDumpScript = () => {
    const projectRef = "mspujwrfhbobrxhofxzv";
    const script = `#!/bin/bash
# Supabase Database Backup Script
# Generated: ${new Date().toISOString()}
# Project: ${projectRef}

# Prerequisites:
# 1. Install PostgreSQL client tools (pg_dump)
# 2. Set your database password as environment variable:
#    export PGPASSWORD="your-database-password"
#
# Get your database password from:
# Supabase Dashboard > Project Settings > Database > Connection string

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./supabase_backups"
BACKUP_FILE="\${BACKUP_DIR}/backup_\${TIMESTAMP}.sql"

# Create backup directory
mkdir -p "\${BACKUP_DIR}"

echo "Starting database backup..."

# Full database dump with all schemas
pg_dump \\
  --host=db.${projectRef}.supabase.co \\
  --port=5432 \\
  --username=postgres \\
  --dbname=postgres \\
  --format=plain \\
  --no-owner \\
  --no-privileges \\
  --schema=public \\
  --file="\${BACKUP_FILE}"

if [ $? -eq 0 ]; then
  echo "Backup completed successfully: \${BACKUP_FILE}"
  
  # Compress the backup
  gzip "\${BACKUP_FILE}"
  echo "Compressed backup: \${BACKUP_FILE}.gz"
  
  # Calculate size
  SIZE=$(ls -lh "\${BACKUP_FILE}.gz" | awk '{print $5}')
  echo "Backup size: \${SIZE}"
else
  echo "Backup failed!"
  exit 1
fi

echo ""
echo "To restore this backup, run:"
echo "psql --host=db.${projectRef}.supabase.co --port=5432 --username=postgres --dbname=postgres < \${BACKUP_FILE}"
`;

    // Download the script
    const blob = new Blob([script], { type: "text/x-shellscript" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `supabase_backup_script_${new Date().toISOString().split("T")[0]}.sh`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success("pg_dump script downloaded! Follow the instructions in the script.");
  };

  // Known tables in the system
  const knownTables = [
    "companies", "profiles", "projects", "opportunities", "contacts",
    "appointments", "estimates", "project_invoices", "project_payments",
    "app_settings", "company_settings", "subscription_plans", "company_subscriptions",
    "salespeople", "project_bills", "project_agreements", "client_portal_tokens",
    "user_roles", "banks", "audit_logs"
  ] as const;

  // Manual backup functions
  const backupDatabase = async () => {
    setIsBackingUp(prev => ({ ...prev, database: true }));
    setBackupProgress(prev => ({ ...prev, database: 0 }));
    
    try {
      const allData: Record<string, unknown[]> = {};
      let completed = 0;
      
      for (const table of knownTables) {
        try {
          const { data } = await supabase.from(table).select("*").limit(10000);
          if (data) allData[table] = data;
        } catch {
          // Table might not exist or no access
        }
        completed++;
        setBackupProgress(prev => ({ 
          ...prev, 
          database: Math.round((completed / knownTables.length) * 100) 
        }));
      }
      
      // Add to history
      const backupItem: BackupItem = {
        id: crypto.randomUUID(),
        type: "database",
        createdAt: new Date().toISOString(),
        size: `${Math.round(JSON.stringify(allData).length / 1024)} KB`,
        status: "completed"
      };
      setBackupHistory(prev => [backupItem, ...prev]);
      
      downloadJson(allData, "database_backup");
      toast.success("Database backup completed!");
    } catch (error) {
      console.error("Database backup error:", error);
      toast.error("Database backup failed. Use pg_dump script for complete backup.");
    } finally {
      setIsBackingUp(prev => ({ ...prev, database: false }));
    }
  };

  const backupEdgeFunctions = async () => {
    setIsBackingUp(prev => ({ ...prev, edgeFunctions: true }));
    
    try {
      // Edge functions are in the repo - provide instructions
      const info = {
        message: "Edge functions are stored in the repository under supabase/functions/",
        location: "supabase/functions/",
        note: "These are version-controlled in your git repository",
        functions: [
          "ai-check-never-answers",
          "archive-portal-chats",
          "auto-abandon-pns-opportunities",
          "auto-create-never-answers-tasks",
          "backfill-addresses",
          "backfill-scope-of-work",
          "bulk-update-source",
          "cancel-document-signature",
          "cleanup-junk-contacts",
          "cleanup-opportunity-names",
          "cleanup-orphaned-storage",
          "create-contact-note",
          "create-ghl-appointment",
          "create-ghl-entry",
          "create-ghl-task",
          "create-portal-estimate",
          "create-short-link",
          "create-user",
          "delete-ghl-appointment",
          "delete-ghl-contact",
          "delete-ghl-opportunity",
          "delete-ghl-task",
          "delete-quickbooks-record",
          "delete-user",
          "fetch-all-ghl-tasks",
          "fetch-contact-conversations",
          "fetch-contact-notes",
          "generate-compliance-documents",
          "generate-contract-pdf",
          "generate-estimate-scope",
          "generate-signed-document-pdf",
          "google-auth-callback",
          "list-short-links",
          "portal-compliance-enabled",
          "process-subscription-expirations",
          "quickbooks-auth",
          "quickbooks-fetch-bill",
          "quickbooks-fetch-bill-payment",
          "quickbooks-fetch-invoice",
          "quickbooks-fetch-payment",
          "quickbooks-list-entities",
          "quickbooks-webhook",
          "resolve-short-link",
          "send-appointment-reminders",
          "send-auth-email",
          "send-company-invite",
          "send-customer-confirmation",
          "send-daily-portal-updates",
          "send-document-signature",
          "send-portal-update-email",
          "send-proposal-email",
          "send-proposal-notification",
          "send-thank-you-email",
          "short-link-analytics",
          "sign-document",
          "store-ghl-integration",
          "store-resend-key",
          "sync-ghl-recent",
          "sync-ghl-tasks",
          "sync-google-calendar",
          "sync-lost-opportunity-stages",
          "sync-to-quickbooks",
          "test-api-key",
          "update-contact-address",
          "update-contact-email",
          "update-contact-name",
          "update-contact-phone",
          "update-contact-scope",
          "update-contact-source",
          "update-ghl-appointment",
          "update-ghl-opportunity",
          "update-ghl-task",
          "update-opportunity-address",
          "update-opportunity-scope",
          "update-user-password"
        ],
        exportedAt: new Date().toISOString()
      };
      
      downloadJson(info, "edge_functions_manifest");
      toast.success("Edge functions manifest downloaded!");
    } finally {
      setIsBackingUp(prev => ({ ...prev, edgeFunctions: false }));
    }
  };

  const backupSecrets = async () => {
    setIsBackingUp(prev => ({ ...prev, secrets: true }));
    
    try {
      // We can only list secret names, not values (security)
      const secretsList = {
        message: "Secret names only - values are securely stored in Supabase",
        secrets: [
          "GHL_API_KEY",
          "GHL_API_KEY_2",
          "GHL_API_KEY_V1",
          "GHL_LOCATION_ID",
          "GHL_LOCATION_ID_2",
          "LOVABLE_API_KEY",
          "OPENAI_API_KEY",
          "QUICKBOOKS_CLIENT_ID",
          "QUICKBOOKS_CLIENT_SECRET",
          "RESEND_API_KEY",
          "SEND_EMAIL_HOOK_SECRET",
          "SUPABASE_ANON_KEY",
          "SUPABASE_DB_URL",
          "SUPABASE_PUBLISHABLE_KEY",
          "SUPABASE_SERVICE_ROLE_KEY",
          "SUPABASE_URL"
        ],
        note: "To backup actual values, export them from: Supabase Dashboard > Project Settings > Edge Functions > Secrets",
        dashboardUrl: "https://supabase.com/dashboard/project/mspujwrfhbobrxhofxzv/settings/functions",
        exportedAt: new Date().toISOString()
      };
      
      downloadJson(secretsList, "secrets_manifest");
      toast.success("Secrets manifest downloaded (names only for security)!");
    } finally {
      setIsBackingUp(prev => ({ ...prev, secrets: false }));
    }
  };

  const backupStorage = async () => {
    setIsBackingUp(prev => ({ ...prev, storage: true }));
    setBackupProgress(prev => ({ ...prev, storage: 0 }));
    
    try {
      const buckets = [
        "project-attachments",
        "signature-documents", 
        "contracts",
        "estimate-plans",
        "compliance-templates"
      ];
      
      const storageManifest: Record<string, unknown[]> = {};
      let completed = 0;
      
      for (const bucket of buckets) {
        try {
          const { data: files } = await supabase.storage.from(bucket).list("", {
            limit: 1000,
            sortBy: { column: "created_at", order: "desc" }
          });
          
          if (files) {
            storageManifest[bucket] = files.map(f => ({
              name: f.name,
              size: f.metadata?.size,
              mimetype: f.metadata?.mimetype,
              created_at: f.created_at,
              updated_at: f.updated_at
            }));
          }
        } catch {
          storageManifest[bucket] = [];
        }
        
        completed++;
        setBackupProgress(prev => ({ 
          ...prev, 
          storage: Math.round((completed / buckets.length) * 100) 
        }));
      }
      
      const manifest = {
        buckets: storageManifest,
        totalFiles: Object.values(storageManifest).reduce((sum, files) => sum + files.length, 0),
        note: "This is a manifest of storage files. For actual file downloads, use the Supabase dashboard or CLI.",
        dashboardUrl: "https://supabase.com/dashboard/project/mspujwrfhbobrxhofxzv/storage/buckets",
        exportedAt: new Date().toISOString()
      };
      
      downloadJson(manifest, "storage_manifest");
      toast.success("Storage manifest downloaded!");
    } finally {
      setIsBackingUp(prev => ({ ...prev, storage: false }));
    }
  };

  const backupSettings = async () => {
    setIsBackingUp(prev => ({ ...prev, settings: true }));
    
    try {
      const settings: Record<string, unknown[]> = {};
      
      // Fetch each settings table
      const { data: appSettings } = await supabase.from("app_settings").select("*");
      if (appSettings) settings.app_settings = appSettings;
      
      const { data: companySettings } = await supabase.from("company_settings").select("*");
      if (companySettings) settings.company_settings = companySettings;
      
      const { data: plans } = await supabase.from("subscription_plans").select("*");
      if (plans) settings.subscription_plans = plans;
      
      const { data: companies } = await supabase.from("companies").select("*");
      if (companies) settings.companies = companies;
      
      downloadJson(settings, "project_settings");
      toast.success("Project settings backup completed!");
    } finally {
      setIsBackingUp(prev => ({ ...prev, settings: false }));
    }
  };

  const runFullBackup = async () => {
    toast.info("Starting full backup...");
    await Promise.all([
      backupDatabase(),
      backupEdgeFunctions(),
      backupSecrets(),
      backupStorage(),
      backupSettings()
    ]);
    toast.success("Full backup completed!");
  };

  // Save schedule configuration
  const saveScheduleMutation = useMutation({
    mutationFn: async (config: BackupConfig) => {
      const { error } = await supabase
        .from("app_settings")
        .upsert({
          setting_key: "backup_schedule_config",
          setting_value: JSON.stringify(config),
          setting_type: "json",
          description: "Backup schedule configuration"
        }, { onConflict: "setting_key" });
      
      if (error) throw error;
      return config;
    },
    onSuccess: () => {
      toast.success("Backup schedule saved!");
      queryClient.invalidateQueries({ queryKey: ["backup-schedule-config"] });
    },
    onError: (error) => {
      console.error("Save schedule error:", error);
      toast.error("Failed to save schedule");
    }
  });

  const downloadJson = (data: unknown, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <SuperAdminLayout 
      title="Backup Management" 
      description="Create and manage platform backups"
    >
      <div className="space-y-6 p-6">
        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Archive className="h-5 w-5 text-primary" />
                Full Backup
              </CardTitle>
              <CardDescription>
                Download all data, settings, and manifests
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full" 
                onClick={runFullBackup}
                disabled={Object.values(isBackingUp).some(Boolean)}
              >
                <Download className="h-4 w-4 mr-2" />
                Run Full Backup
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Database className="h-5 w-5" />
                pg_dump Script
              </CardTitle>
              <CardDescription>
                Complete database backup via command line
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={generatePgDumpScript}
              >
                <FileCode className="h-4 w-4 mr-2" />
                Download Script
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <HardDrive className="h-5 w-5" />
                Storage Dashboard
              </CardTitle>
              <CardDescription>
                Access Supabase storage buckets directly
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => window.open("https://supabase.com/dashboard/project/mspujwrfhbobrxhofxzv/storage/buckets", "_blank")}
              >
                <Cloud className="h-4 w-4 mr-2" />
                Open Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="manual">Manual Backup</TabsTrigger>
            <TabsTrigger value="schedule">Schedule & Retention</TabsTrigger>
            <TabsTrigger value="history">Backup History</TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Database Backup */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Database Export
                  </CardTitle>
                  <CardDescription>
                    Export table data as JSON (use pg_dump for complete backup)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isBackingUp.database && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Exporting tables...</span>
                        <span>{backupProgress.database || 0}%</span>
                      </div>
                      <Progress value={backupProgress.database || 0} />
                    </div>
                  )}
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={backupDatabase}
                    disabled={isBackingUp.database}
                  >
                    {isBackingUp.database ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Export Database
                  </Button>
                </CardContent>
              </Card>

              {/* Edge Functions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileCode className="h-5 w-5" />
                    Edge Functions
                  </CardTitle>
                  <CardDescription>
                    Download manifest of deployed functions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={backupEdgeFunctions}
                    disabled={isBackingUp.edgeFunctions}
                  >
                    {isBackingUp.edgeFunctions ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Export Manifest
                  </Button>
                </CardContent>
              </Card>

              {/* Secrets */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    Secrets List
                  </CardTitle>
                  <CardDescription>
                    Export secret names (values secured)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={backupSecrets}
                    disabled={isBackingUp.secrets}
                  >
                    {isBackingUp.secrets ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Export Secret Names
                  </Button>
                </CardContent>
              </Card>

              {/* Storage */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Cloud className="h-5 w-5" />
                    Storage Objects
                  </CardTitle>
                  <CardDescription>
                    Export storage file manifest
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isBackingUp.storage && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Scanning buckets...</span>
                        <span>{backupProgress.storage || 0}%</span>
                      </div>
                      <Progress value={backupProgress.storage || 0} />
                    </div>
                  )}
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={backupStorage}
                    disabled={isBackingUp.storage}
                  >
                    {isBackingUp.storage ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Export Manifest
                  </Button>
                </CardContent>
              </Card>

              {/* Settings */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Project Settings
                  </CardTitle>
                  <CardDescription>
                    Export app settings, company settings, and subscription plans
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    variant="outline"
                    onClick={backupSettings}
                    disabled={isBackingUp.settings}
                  >
                    {isBackingUp.settings ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Export Settings
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="schedule" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Automated Backup Schedule
                </CardTitle>
                <CardDescription>
                  Configure automatic backups stored in Supabase Storage
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Scheduled Backups</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically backup data on a schedule
                    </p>
                  </div>
                  <Switch 
                    checked={scheduleConfig.enabled}
                    onCheckedChange={(enabled) => 
                      setScheduleConfig(prev => ({ ...prev, enabled }))
                    }
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Frequency</Label>
                    <Select 
                      value={scheduleConfig.frequency}
                      onValueChange={(frequency: "daily" | "weekly" | "monthly") => 
                        setScheduleConfig(prev => ({ ...prev, frequency }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Time (UTC)</Label>
                    <Input 
                      type="time"
                      value={scheduleConfig.time}
                      onChange={(e) => 
                        setScheduleConfig(prev => ({ ...prev, time: e.target.value }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Retention (days)</Label>
                    <Input 
                      type="number"
                      min={1}
                      max={365}
                      value={scheduleConfig.retentionDays}
                      onChange={(e) => 
                        setScheduleConfig(prev => ({ 
                          ...prev, 
                          retentionDays: parseInt(e.target.value) || 30 
                        }))
                      }
                    />
                  </div>
                </div>

                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                    <ChevronDown className="h-4 w-4" />
                    Advanced: pg_cron Setup Instructions
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-4 p-4 bg-muted rounded-lg">
                    <p className="text-sm mb-3">
                      For automated backups via pg_cron, you'll need to set up a cron job 
                      that calls the backup edge function. Here's an example:
                    </p>
                    <pre className="text-xs bg-background p-3 rounded overflow-x-auto">
{`-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule ${scheduleConfig.frequency} backup at ${scheduleConfig.time} UTC
SELECT cron.schedule(
  'automated-backup',
  '${scheduleConfig.frequency === 'daily' ? '0 ' + scheduleConfig.time.split(':')[0] + ' * * *' : 
    scheduleConfig.frequency === 'weekly' ? '0 ' + scheduleConfig.time.split(':')[0] + ' * * 0' :
    '0 ' + scheduleConfig.time.split(':')[0] + ' 1 * *'}',
  $$
  SELECT net.http_post(
    url := 'https://mspujwrfhbobrxhofxzv.supabase.co/functions/v1/run-backup',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body := '{"type": "full"}'::jsonb
  );
  $$
);`}
                    </pre>
                  </CollapsibleContent>
                </Collapsible>

                <Button 
                  onClick={() => saveScheduleMutation.mutate(scheduleConfig)}
                  disabled={saveScheduleMutation.isPending}
                >
                  {saveScheduleMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Clock className="h-4 w-4 mr-2" />
                  )}
                  Save Schedule
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trash2 className="h-5 w-5" />
                  Retention Policy
                </CardTitle>
                <CardDescription>
                  Automatically delete old backups after {scheduleConfig.retentionDays} days
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                  <AlertCircle className="h-5 w-5 text-muted-foreground" />
                  <div className="text-sm">
                    <p className="font-medium">Retention applies to automated backups only</p>
                    <p className="text-muted-foreground">
                      Manual downloads to your local machine are not affected
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Backups</CardTitle>
                <CardDescription>
                  History of automated and manual backups
                </CardDescription>
              </CardHeader>
              <CardContent>
                {historyLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : backupHistory && backupHistory.length > 0 ? (
                  <div className="space-y-3">
                    {backupHistory.map((backup) => (
                      <div 
                        key={backup.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {backup.status === "completed" ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                          ) : backup.status === "failed" ? (
                            <AlertCircle className="h-5 w-5 text-destructive" />
                          ) : (
                            <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                          )}
                          <div>
                            <p className="font-medium capitalize">{backup.type} Backup</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(backup.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={backup.status === "completed" ? "default" : "destructive"}>
                            {backup.status}
                          </Badge>
                          {backup.size && (
                            <span className="text-sm text-muted-foreground">{backup.size}</span>
                          )}
                          {backup.downloadUrl && (
                            <Button variant="ghost" size="sm" asChild>
                              <a href={backup.downloadUrl} download>
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Archive className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No backup history yet</p>
                    <p className="text-sm">Run a manual backup to get started</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </SuperAdminLayout>
  );
}
