import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Save, Loader2, ChevronDown, Share2 } from "lucide-react";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const SOCIAL_PLATFORMS = [
  { key: "facebook", label: "Facebook", placeholder: "https://facebook.com/yourpage" },
  { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/yourhandle" },
  { key: "twitter", label: "X (Twitter)", placeholder: "https://x.com/yourhandle" },
  { key: "linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/company/yourcompany" },
  { key: "youtube", label: "YouTube", placeholder: "https://youtube.com/@yourchannel" },
  { key: "google", label: "Google Business", placeholder: "https://g.page/yourbusiness" },
  { key: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/@yourhandle" },
  { key: "pinterest", label: "Pinterest", placeholder: "https://pinterest.com/yourpage" },
  { key: "yelp", label: "Yelp", placeholder: "https://yelp.com/biz/yourbusiness" },
  { key: "nextdoor", label: "Nextdoor", placeholder: "https://nextdoor.com/pages/yourbusiness" },
];

export function SocialMediaLinks() {
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();
  const [editedLinks, setEditedLinks] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const { data: savedLinks, isLoading } = useQuery({
    queryKey: ["social-media-links", companyId],
    queryFn: async () => {
      if (!companyId) return {};
      const { data, error } = await supabase
        .from("company_settings")
        .select("setting_key, setting_value")
        .eq("company_id", companyId)
        .like("setting_key", "social_%");
      if (error) throw error;
      const result: Record<string, string> = {};
      (data || []).forEach((s) => {
        const platform = s.setting_key.replace("social_", "");
        result[platform] = s.setting_value || "";
      });
      return result;
    },
    enabled: !!companyId,
  });

  useEffect(() => {
    if (savedLinks) {
      setEditedLinks(savedLinks);
      setHasChanges(false);
    }
  }, [savedLinks]);

  const handleChange = (key: string, value: string) => {
    setEditedLinks((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No company");
      const upserts = SOCIAL_PLATFORMS.map((p) => ({
        company_id: companyId,
        setting_key: `social_${p.key}`,
        setting_value: editedLinks[p.key]?.trim() || "",
        setting_type: "text",
        description: `${p.label} URL`,
      }));
      for (const upsert of upserts) {
        const { error } = await supabase
          .from("company_settings")
          .upsert(upsert, { onConflict: "company_id,setting_key" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Social media links saved");
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["social-media-links"] });
      queryClient.invalidateQueries({ queryKey: ["company-info-header"] });
    },
    onError: () => toast.error("Failed to save social media links"),
  });

  const filledCount = Object.values(editedLinks).filter((v) => v?.trim()).length;

  return (
    <Collapsible defaultOpen={false} className="group">
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Share2 className="h-5 w-5" />
                Social Media Links
                {filledCount > 0 && (
                  <span className="text-xs font-normal text-muted-foreground">
                    ({filledCount} configured)
                  </span>
                )}
              </span>
              <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </CardTitle>
            <CardDescription>
              Add your social media links — they'll appear on customer proposals
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {SOCIAL_PLATFORMS.map((p) => (
                    <div key={p.key} className="space-y-1">
                      <Label htmlFor={`social-${p.key}`} className="text-xs">
                        {p.label}
                      </Label>
                      <Input
                        id={`social-${p.key}`}
                        type="url"
                        value={editedLinks[p.key] || ""}
                        onChange={(e) => handleChange(p.key, e.target.value)}
                        placeholder={p.placeholder}
                        className="h-9 text-sm"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-end pt-2">
                  <Button
                    onClick={() => saveMutation.mutate()}
                    disabled={!hasChanges || saveMutation.isPending}
                    size="sm"
                  >
                    {saveMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <Save className="h-3 w-3 mr-1" />
                    )}
                    Save Social Links
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
