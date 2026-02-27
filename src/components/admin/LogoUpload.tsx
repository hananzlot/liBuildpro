import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, Loader2, Trash2, Image, Link, Save, Download, ChevronDown, Palette } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// Helper to determine if a color is dark (for text contrast)
function isColorDark(color: string): boolean {
  if (!color) return false;
  
  let r = 0, g = 0, b = 0;
  
  if (color.startsWith('#')) {
    const hex = color.replace('#', '');
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    }
  } else if (color.startsWith('rgb')) {
    const match = color.match(/\d+/g);
    if (match && match.length >= 3) {
      r = parseInt(match[0]);
      g = parseInt(match[1]);
      b = parseInt(match[2]);
    }
  }
  
  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5;
}

const PRESET_COLORS = [
  { name: "Default", value: "" },
  { name: "White", value: "#ffffff" },
  { name: "Light Gray", value: "#f8f9fa" },
  { name: "Slate", value: "#f1f5f9" },
  { name: "Blue", value: "#eff6ff" },
  { name: "Green", value: "#f0fdf4" },
  { name: "Purple", value: "#faf5ff" },
  { name: "Amber", value: "#fffbeb" },
  { name: "Rose", value: "#fff1f2" },
  { name: "Dark", value: "#1e293b" },
  { name: "Navy", value: "#1e3a5f" },
];

export function LogoUpload({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const { company } = useAuth();
  const companyId = company?.id;
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [hasUrlChanges, setHasUrlChanges] = useState(false);
  const [customColor, setCustomColor] = useState("");
  const [hasColorChanges, setHasColorChanges] = useState(false);
  const [customFontColor, setCustomFontColor] = useState("");
  const [hasFontColorChanges, setHasFontColorChanges] = useState(false);
  const [customSubtextColor, setCustomSubtextColor] = useState("");
  const [hasSubtextColorChanges, setHasSubtextColorChanges] = useState(false);

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

  // Fetch header background color setting
  const { data: bgColorSetting } = useQuery({
    queryKey: ["company-header-bg-color", companyId],
    queryFn: async () => {
      if (companyId) {
        const { data: companyData } = await supabase
          .from("company_settings")
          .select("*")
          .eq("company_id", companyId)
          .eq("setting_key", "company_header_bg_color")
          .maybeSingle();

        if (companyData) {
          return companyData.setting_value || "";
        }
      }

      const { data } = await supabase
        .from("app_settings")
        .select("*")
        .eq("setting_key", "company_header_bg_color")
        .maybeSingle();

      return data?.setting_value || "";
    },
  });

  // Fetch header font color setting
  const { data: fontColorSetting } = useQuery({
    queryKey: ["company-header-font-color", companyId],
    queryFn: async () => {
      if (companyId) {
        const { data: companyData } = await supabase
          .from("company_settings")
          .select("*")
          .eq("company_id", companyId)
          .eq("setting_key", "company_header_font_color")
          .maybeSingle();

        if (companyData) {
          return companyData.setting_value || "";
        }
      }

      const { data } = await supabase
        .from("app_settings")
        .select("*")
        .eq("setting_key", "company_header_font_color")
        .maybeSingle();

      return data?.setting_value || "";
    },
  });

  // Fetch header subtext color setting
  const { data: subtextColorSetting } = useQuery({
    queryKey: ["company-header-subtext-color", companyId],
    queryFn: async () => {
      if (companyId) {
        const { data: companyData } = await supabase
          .from("company_settings")
          .select("*")
          .eq("company_id", companyId)
          .eq("setting_key", "company_header_subtext_color")
          .maybeSingle();

        if (companyData) {
          return companyData.setting_value || "";
        }
      }

      const { data } = await supabase
        .from("app_settings")
        .select("*")
        .eq("setting_key", "company_header_subtext_color")
        .maybeSingle();

      return data?.setting_value || "";
    },
  });

  const currentBgColor = bgColorSetting || "";
  const currentFontColor = fontColorSetting || "";
  const currentSubtextColor = subtextColorSetting || "";

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

    // Validate file size (max 5MB for logos)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Logo must be less than 5MB");
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

  // Initialize custom color input when data loads
  if (bgColorSetting !== undefined && customColor === "" && currentBgColor && !hasColorChanges) {
    setCustomColor(currentBgColor);
  }

  // Initialize font color input when data loads
  if (fontColorSetting !== undefined && customFontColor === "" && currentFontColor && !hasFontColorChanges) {
    setCustomFontColor(currentFontColor);
  }

  // Initialize subtext color input when data loads
  if (subtextColorSetting !== undefined && customSubtextColor === "" && currentSubtextColor && !hasSubtextColorChanges) {
    setCustomSubtextColor(currentSubtextColor);
  }

  const updateBgColor = useMutation({
    mutationFn: async (color: string) => {
      if (companyId) {
        const { data: existing } = await supabase
          .from("company_settings")
          .select("id")
          .eq("company_id", companyId)
          .eq("setting_key", "company_header_bg_color")
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from("company_settings")
            .update({ 
              setting_value: color, 
              updated_at: new Date().toISOString() 
            })
            .eq("company_id", companyId)
            .eq("setting_key", "company_header_bg_color");
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("company_settings")
            .insert({ 
              company_id: companyId,
              setting_key: "company_header_bg_color",
              setting_value: color
            });
          if (error) throw error;
        }
      } else {
        const { error } = await supabase
          .from("app_settings")
          .upsert({ 
            setting_key: "company_header_bg_color",
            setting_value: color, 
            updated_at: new Date().toISOString() 
          }, { onConflict: 'setting_key' });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-header-bg-color"] });
      queryClient.invalidateQueries({ queryKey: ["company-info-header"] });
      toast.success("Header background color updated");
      setHasColorChanges(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to update color: ${error.message}`);
    },
  });

  const handleColorSelect = (color: string) => {
    setCustomColor(color);
    updateBgColor.mutate(color);
  };

  const handleCustomColorChange = (value: string) => {
    setCustomColor(value);
    setHasColorChanges(value !== currentBgColor);
  };

  const handleCustomColorSave = () => {
    updateBgColor.mutate(customColor);
  };

  // Font color mutation
  const updateFontColor = useMutation({
    mutationFn: async (color: string) => {
      if (companyId) {
        const { data: existing } = await supabase
          .from("company_settings")
          .select("id")
          .eq("company_id", companyId)
          .eq("setting_key", "company_header_font_color")
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from("company_settings")
            .update({ 
              setting_value: color, 
              updated_at: new Date().toISOString() 
            })
            .eq("company_id", companyId)
            .eq("setting_key", "company_header_font_color");
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("company_settings")
            .insert({ 
              company_id: companyId,
              setting_key: "company_header_font_color",
              setting_value: color
            });
          if (error) throw error;
        }
      } else {
        const { error } = await supabase
          .from("app_settings")
          .upsert({ 
            setting_key: "company_header_font_color",
            setting_value: color, 
            updated_at: new Date().toISOString() 
          }, { onConflict: 'setting_key' });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-header-font-color"] });
      queryClient.invalidateQueries({ queryKey: ["company-info-header"] });
      toast.success("Header font color updated");
      setHasFontColorChanges(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to update font color: ${error.message}`);
    },
  });

  const handleFontColorChange = (value: string) => {
    setCustomFontColor(value);
    setHasFontColorChanges(value !== currentFontColor);
  };

  const handleFontColorSave = () => {
    updateFontColor.mutate(customFontColor);
  };

  const handleFontColorReset = () => {
    setCustomFontColor("");
    updateFontColor.mutate("");
  };

  // Subtext color mutation
  const updateSubtextColor = useMutation({
    mutationFn: async (color: string) => {
      if (companyId) {
        const { data: existing } = await supabase
          .from("company_settings")
          .select("id")
          .eq("company_id", companyId)
          .eq("setting_key", "company_header_subtext_color")
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from("company_settings")
            .update({ setting_value: color, updated_at: new Date().toISOString() })
            .eq("company_id", companyId)
            .eq("setting_key", "company_header_subtext_color");
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("company_settings")
            .insert({ company_id: companyId, setting_key: "company_header_subtext_color", setting_value: color });
          if (error) throw error;
        }
      } else {
        const { error } = await supabase
          .from("app_settings")
          .upsert({ setting_key: "company_header_subtext_color", setting_value: color, updated_at: new Date().toISOString() }, { onConflict: 'setting_key' });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-header-subtext-color"] });
      queryClient.invalidateQueries({ queryKey: ["company-info-header"] });
      toast.success("Header subtext color updated");
      setHasSubtextColorChanges(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to update subtext color: ${error.message}`);
    },
  });

  const handleSubtextColorChange = (value: string) => {
    setCustomSubtextColor(value);
    setHasSubtextColorChanges(value !== currentSubtextColor);
  };

  const handleSubtextColorSave = () => {
    updateSubtextColor.mutate(customSubtextColor);
  };

  const handleSubtextColorReset = () => {
    setCustomSubtextColor("");
    updateSubtextColor.mutate("");
  };

  return (
    <Collapsible defaultOpen={defaultOpen} className="group">
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
                Recommended: Square image, PNG or SVG format, max 5MB. Ideal size: 512x512px.
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

        {/* Header Background Color */}
        <div className="space-y-3 pt-4 border-t">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-muted-foreground" />
            <Label>Header Background Color</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Choose a background color for the company header in proposals and estimates.
          </p>
          
          {/* Preset Colors */}
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => handleColorSelect(preset.value)}
                className={`
                  w-8 h-8 rounded-md border-2 transition-all
                  ${currentBgColor === preset.value ? 'ring-2 ring-primary ring-offset-2' : 'hover:scale-110'}
                  ${preset.value === '' ? 'bg-gradient-to-br from-gray-100 to-gray-300' : ''}
                `}
                style={{ backgroundColor: preset.value || undefined }}
                title={preset.name}
              />
            ))}
          </div>

          {/* Custom Color Input */}
          <div className="flex items-center gap-2">
            <Input
              type="color"
              value={customColor || "#ffffff"}
              onChange={(e) => handleCustomColorChange(e.target.value)}
              className="w-12 h-10 p-1 cursor-pointer"
            />
            <Input
              type="text"
              value={customColor}
              onChange={(e) => handleCustomColorChange(e.target.value)}
              placeholder="#ffffff or rgb(255,255,255)"
              className="flex-1"
            />
            {hasColorChanges && (
              <Button
                size="sm"
                onClick={handleCustomColorSave}
                disabled={updateBgColor.isPending}
              >
                {updateBgColor.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Save className="h-3 w-3 mr-1" />
                )}
                Save
              </Button>
            )}
          </div>

          {/* Header Font Color */}
          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-muted-foreground" />
              <Label>Header Font Color</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Choose a custom font color for the header text. Leave empty to auto-detect based on background.
            </p>
            
            <div className="flex items-center gap-2">
              <Input
                type="color"
                value={customFontColor || "#000000"}
                onChange={(e) => handleFontColorChange(e.target.value)}
                className="w-12 h-10 p-1 cursor-pointer"
              />
              <Input
                type="text"
                value={customFontColor}
                onChange={(e) => handleFontColorChange(e.target.value)}
                placeholder="Auto (based on background)"
                className="flex-1"
              />
              {currentFontColor && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleFontColorReset}
                  disabled={updateFontColor.isPending}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Reset
                </Button>
              )}
              {hasFontColorChanges && (
                <Button
                  size="sm"
                  onClick={handleFontColorSave}
                  disabled={updateFontColor.isPending}
                >
                  {updateFontColor.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Save className="h-3 w-3 mr-1" />
                  )}
                  Save
                </Button>
              )}
            </div>
          </div>

          {/* Header Subtext Color */}
          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-muted-foreground" />
              <Label>Header Subtext Color</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Choose a custom color for license info, contact details, and social links. Leave empty to derive from header font color.
            </p>
            
            <div className="flex items-center gap-2">
              <Input
                type="color"
                value={customSubtextColor || "#666666"}
                onChange={(e) => handleSubtextColorChange(e.target.value)}
                className="w-12 h-10 p-1 cursor-pointer"
              />
              <Input
                type="text"
                value={customSubtextColor}
                onChange={(e) => handleSubtextColorChange(e.target.value)}
                placeholder="Auto (from header font color)"
                className="flex-1"
              />
              {currentSubtextColor && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSubtextColorReset}
                  disabled={updateSubtextColor.isPending}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Reset
                </Button>
              )}
              {hasSubtextColorChanges && (
                <Button
                  size="sm"
                  onClick={handleSubtextColorSave}
                  disabled={updateSubtextColor.isPending}
                >
                  {updateSubtextColor.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Save className="h-3 w-3 mr-1" />
                  )}
                  Save
                </Button>
              )}
            </div>
          </div>

          {/* Live Preview */}
          {(currentLogoUrl || currentBgColor) && (
            <div className="mt-4">
              <Label className="text-xs text-muted-foreground">Preview</Label>
              <div 
                className="mt-2 p-4 rounded-lg border"
                style={{ backgroundColor: currentBgColor || undefined }}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    {currentLogoUrl && (
                      <img 
                        src={currentLogoUrl} 
                        alt="Logo preview" 
                        className="h-12 w-auto object-contain"
                      />
                    )}
                    <span 
                      className="font-semibold"
                      style={{ 
                        color: currentFontColor || (currentBgColor && isColorDark(currentBgColor) ? '#ffffff' : undefined)
                      }}
                    >
                      {company?.name || "Company Name"}
                    </span>
                  </div>
                  <p
                    className="text-sm"
                    style={{
                      color: currentSubtextColor || (currentFontColor ? undefined : (currentBgColor && isColorDark(currentBgColor) ? 'rgba(255,255,255,0.7)' : undefined))
                    }}
                  >
                    License info, address, phone, website
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

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
