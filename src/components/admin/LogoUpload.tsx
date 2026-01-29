import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, Loader2, Trash2, Image, Link, Save, Download, ChevronDown } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
export function LogoUpload() {
  const { company } = useAuth();
  const companyId = company?.id;
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [hasUrlChanges, setHasUrlChanges] = useState(false);

  // Fetch current logo URL from company_settings first, fallback to app_settings
  const { data: logoSetting, isLoading } = useQuery({
    queryKey: ["company-logo-setting", companyId],
    queryFn: async () => {
      // Try company_settings first if we have a companyId
      if (companyId) {
        const { data: companyData } = await supabase
          .from("company_settings")
          .select("*")
          .eq("company_id", companyId)
          .eq("setting_key", "company_logo_url")
          .maybeSingle();

        if (companyData) {
          return { ...companyData, source: 'company' as const };
        }
      }

      // Fallback to app_settings
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .eq("setting_key", "company_logo_url")
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;
      return data ? { ...data, source: 'app' as const } : null;
    },
  });

  const currentLogoUrl = logoSetting?.setting_value || "";

  const updateLogoUrl = useMutation({
    mutationFn: async (url: string) => {
      // Save to company_settings if we have a companyId
      if (companyId) {
        // Check if setting exists
        const { data: existing } = await supabase
          .from("company_settings")
          .select("id")
          .eq("company_id", companyId)
          .eq("setting_key", "company_logo_url")
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from("company_settings")
            .update({ 
              setting_value: url, 
              updated_at: new Date().toISOString() 
            })
            .eq("company_id", companyId)
            .eq("setting_key", "company_logo_url");
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("company_settings")
            .insert({ 
              company_id: companyId,
              setting_key: "company_logo_url",
              setting_value: url
            });
          if (error) throw error;
        }
      } else {
        // Fallback to app_settings
        const { error } = await supabase
          .from("app_settings")
          .update({ 
            setting_value: url, 
            updated_at: new Date().toISOString() 
          })
          .eq("setting_key", "company_logo_url");
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-logo-setting"] });
      queryClient.invalidateQueries({ queryKey: ["app-settings"] });
      queryClient.invalidateQueries({ queryKey: ["company-settings"] });
      toast.success("Logo updated successfully");
      setHasUrlChanges(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to update logo: ${error.message}`);
    },
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    // Validate file size (max 2MB for logos)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be less than 2MB");
      return;
    }

    setUploading(true);

    try {
      // Generate unique filename
      const fileExt = file.name.split(".").pop();
      const fileName = `company-logo-${Date.now()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("project-attachments")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("project-attachments")
        .getPublicUrl(filePath);

      // Update the setting
      await updateLogoUrl.mutateAsync(urlData.publicUrl);
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(`Failed to upload logo: ${error.message}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleUrlSave = () => {
    updateLogoUrl.mutate(urlInput || "");
  };

  const handleRemoveLogo = () => {
    updateLogoUrl.mutate("");
  };

  const handleDownloadLogo = async () => {
    if (!currentLogoUrl) return;
    
    try {
      const response = await fetch(currentLogoUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      // Extract filename from URL or use default
      const urlParts = currentLogoUrl.split('/');
      const filename = urlParts[urlParts.length - 1] || 'company-logo.png';
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success("Logo downloaded successfully");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download logo");
    }
  };

  const handleUrlChange = (value: string) => {
    setUrlInput(value);
    setHasUrlChanges(value !== currentLogoUrl);
  };

  // Initialize URL input when data loads
  if (logoSetting && urlInput === "" && currentLogoUrl && !hasUrlChanges) {
    setUrlInput(currentLogoUrl);
  }

  return (
    <Collapsible defaultOpen={false} className="group">
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Image className="h-5 w-5" />
                Company Logo
              </span>
              <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </CardTitle>
            <CardDescription>
              Upload your company logo. It will be displayed in the customer portal, emails, and as the site favicon.
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-6 pt-0">
        {/* Current Logo Preview */}
        {currentLogoUrl && (
          <div className="space-y-3">
            <Label>Current Logo</Label>
            <div className="flex items-center gap-4">
              <div className="relative w-24 h-24 rounded-xl border-2 border-dashed border-muted-foreground/25 flex items-center justify-center bg-muted/50 overflow-hidden">
                <img 
                  src={currentLogoUrl} 
                  alt="Company Logo" 
                  className="max-w-full max-h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/placeholder.svg";
                  }}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleDownloadLogo}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={handleRemoveLogo}
                  disabled={updateLogoUrl.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Upload Options */}
        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload File
            </TabsTrigger>
            <TabsTrigger value="url" className="flex items-center gap-2">
              <Link className="h-4 w-4" />
              Enter URL
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-4">
            <div className="space-y-3">
              <Label>Upload Logo Image</Label>
              <div className="flex items-center gap-3">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="flex-1"
                />
                {uploading && (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Recommended: Square image, PNG or SVG format, max 2MB. Ideal size: 512x512px.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="url" className="mt-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Logo URL</Label>
                {hasUrlChanges && (
                  <Button
                    size="sm"
                    onClick={handleUrlSave}
                    disabled={updateLogoUrl.isPending}
                  >
                    {updateLogoUrl.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Save className="h-3 w-3 mr-1" />
                    )}
                    Save
                  </Button>
                )}
              </div>
              <Input
                type="url"
                value={urlInput}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="https://example.com/logo.png"
              />
              <p className="text-xs text-muted-foreground">
                Enter the URL of your logo image hosted elsewhere.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Preview Area for New Upload */}
        {!currentLogoUrl && (
          <div className="w-24 h-24 rounded-xl border-2 border-dashed border-muted-foreground/25 flex items-center justify-center bg-muted/50">
            <Image className="h-8 w-8 text-muted-foreground/50" />
          </div>
        )}

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading current logo...
          </div>
        )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
