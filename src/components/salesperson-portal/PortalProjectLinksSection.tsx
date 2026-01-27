import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Link, ExternalLink, Loader2, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface PortalProjectLinksSectionProps {
  salespersonName: string;
  companyId: string;
}

interface ProjectWithPortal {
  id: string;
  project_number: number | null;
  project_name: string | null;
  project_address: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  portal_token: string | null;
}

export function PortalProjectLinksSection({ salespersonName, companyId }: PortalProjectLinksSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch app base URL setting
  const { data: appBaseUrl } = useQuery({
    queryKey: ["app-base-url-setting", companyId],
    queryFn: async () => {
      // First try company settings
      const { data: companySettings } = await supabase
        .from("company_settings")
        .select("setting_value")
        .eq("company_id", companyId)
        .eq("setting_key", "app_base_url")
        .maybeSingle();

      if (companySettings?.setting_value) {
        return companySettings.setting_value;
      }

      // Fallback to app settings
      const { data: appSettings } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "app_base_url")
        .maybeSingle();

      return appSettings?.setting_value || window.location.origin;
    },
    staleTime: 30 * 60 * 1000,
  });

  // Fetch projects with their portal tokens
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["salesperson-portal-project-links", salespersonName, companyId],
    queryFn: async () => {
      if (!salespersonName || !companyId) return [];

      // Get projects for this salesperson
      const { data: projectsData, error: projectsError } = await supabase
        .from("projects")
        .select("id, project_number, project_name, project_address, customer_first_name, customer_last_name")
        .eq("company_id", companyId)
        .or(`primary_salesperson.eq.${salespersonName},secondary_salesperson.eq.${salespersonName},tertiary_salesperson.eq.${salespersonName},quaternary_salesperson.eq.${salespersonName}`)
        .is("deleted_at", null)
        .order("project_number", { ascending: false });

      if (projectsError) throw projectsError;
      if (!projectsData?.length) return [];

      // Get portal tokens for these projects
      const projectIds = projectsData.map((p) => p.id);
      const { data: tokensData } = await supabase
        .from("client_portal_tokens")
        .select("project_id, token")
        .in("project_id", projectIds)
        .eq("is_active", true);

      const tokenMap = new Map<string, string>();
      tokensData?.forEach((t) => {
        if (t.project_id) tokenMap.set(t.project_id, t.token);
      });

      return projectsData.map((p) => ({
        ...p,
        portal_token: tokenMap.get(p.id) || null,
      })) as ProjectWithPortal[];
    },
    enabled: !!salespersonName && !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  const projectsWithPortals = projects.filter((p) => p.portal_token);

  const getPortalUrl = (token: string) => {
    const baseUrl = appBaseUrl || window.location.origin;
    return `${baseUrl}/portal/${token}`;
  };

  const handleCopyLink = async (projectId: string, token: string) => {
    try {
      await navigator.clipboard.writeText(getPortalUrl(token));
      setCopiedId(projectId);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      toast.error("Failed to copy link");
    }
  };

  const handleOpenPortal = (token: string) => {
    window.open(getPortalUrl(token), "_blank");
  };

  const getCustomerName = (project: ProjectWithPortal) => {
    if (project.customer_first_name || project.customer_last_name) {
      return `${project.customer_first_name || ""} ${project.customer_last_name || ""}`.trim();
    }
    return null;
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader
        className="pb-2 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Link className="h-5 w-5 text-primary" />
            Customer Portals
            {projectsWithPortals.length > 0 && (
              <Badge variant="secondary" className="ml-1">{projectsWithPortals.length}</Badge>
            )}
          </CardTitle>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : projectsWithPortals.length === 0 ? (
            <div className="text-center py-8">
              <Link className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No customer portals available</p>
              <p className="text-xs text-muted-foreground mt-1">
                Portals are created when proposals are sent
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-2">
                {projectsWithPortals.map((project) => (
                  <div
                    key={project.id}
                    className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">
                          #{project.project_number} - {project.project_name || "Untitled Project"}
                        </p>
                        {getCustomerName(project) && (
                          <p className="text-xs text-muted-foreground truncate">
                            {getCustomerName(project)}
                          </p>
                        )}
                        {project.project_address && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            📍 {project.project_address}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={(e) => { e.stopPropagation(); handleCopyLink(project.id, project.portal_token!); }}
                        >
                          {copiedId === project.id ? (
                            <Check className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={() => handleOpenPortal(project.portal_token!)}
                        >
                          <ExternalLink className="h-3.5 w-3.5 mr-1" />
                          Open
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      )}
    </Card>
  );
}
