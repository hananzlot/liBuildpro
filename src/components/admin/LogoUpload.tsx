import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, Loader2, Trash2, Image, Link, Save } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function LogoUpload() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [hasUrlChanges, setHasUrlChanges] = useState(false);

  // Fetch current logo URL from settings
  const { data: logoSetting, isLoading } = useQuery({
    queryKey: ["company-logo-setting"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .eq("setting_key", "company_logo_url")
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
  });

  const currentLogoUrl = logoSetting?.setting_value || "";

  const updateLogoUrl = useMutation({
    mutationFn: async (url: string) => {
      const { error } = await supabase
        .from("app_settings")
        .update({ 
          setting_value: url, 
          updated_at: new Date().toISOString() 
        })
        .eq("setting_key", "company_logo_url");

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-logo-setting"] });
      queryClient.invalidateQueries({ queryKey: ["app-settings"] });
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

  const handleUrlChange = (value: string) => {
    setUrlInput(value);
    setHasUrlChanges(value !== currentLogoUrl);
  };

  // Initialize URL input when data loads
  if (logoSetting && urlInput === "" && currentLogoUrl && !hasUrlChanges) {
    setUrlInput(currentLogoUrl);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Image className="h-5 w-5" />
          Company Logo
        </CardTitle>
        <CardDescription>
          Upload your company logo. It will be displayed in the customer portal, emails, and as the site favicon.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
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
              <Button 
                variant="destructive" 
                size="sm"
                onClick={handleRemoveLogo}
                disabled={updateLogoUrl.isPending}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remove Logo
              </Button>
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
    </Card>
  );
}
