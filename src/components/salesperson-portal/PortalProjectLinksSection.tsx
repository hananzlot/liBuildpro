import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Link, ExternalLink, Loader2, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface PortalProjectLinksSectionProps {
  salespersonName: string;
  salespersonId: string;
  salespersonGhlUserId?: string;
  companyId: string;
}

interface ProjectWithPortal {
  id: string;
  project_number: number | null;
  project_name: string | null;
  project_address: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  project_status: string | null;
  portal_token: string | null;
}

export function PortalProjectLinksSection({ 
  salespersonName, 
  salespersonId,
  salespersonGhlUserId,
  companyId 
}: PortalProjectLinksSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  // Fetch app base URL setting
  const { data: appBaseUrl } = useQuery({
    queryKey: ["app-base-url-setting", companyId],
    queryFn: async () => {
      const { data: companySettings } = await supabase
        .from("company_settings")
        .select("setting_value")
        .eq("company_id", companyId)
        .eq("setting_key", "app_base_url")
        .maybeSingle();

      if (companySettings?.setting_value) {
        return companySettings.setting_value;
      }

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
    queryKey: ["salesperson-portal-project-links", salespersonName, salespersonId, salespersonGhlUserId, companyId],
    queryFn: async () => {
      if (!salespersonName || !companyId) return [];

      // Step 1: Get projects directly assigned to salesperson by name
      const { data: directProjects, error: directError } = await supabase
        .from("projects")
        .select("id, project_number, project_name, project_address, customer_first_name, customer_last_name, project_status")
        .eq("company_id", companyId)
        .or(`primary_salesperson.eq.${salespersonName},secondary_salesperson.eq.${salespersonName},tertiary_salesperson.eq.${salespersonName},quaternary_salesperson.eq.${salespersonName}`)
        .is("deleted_at", null);

      if (directError) throw directError;

      // Step 2: Get projects linked via opportunity assignment ONLY if no salesperson is assigned
      let opportunityProjects: typeof directProjects = [];
      
      if (salespersonGhlUserId) {
        const { data: opportunities } = await supabase
          .from("opportunities")
          .select("id, ghl_id")
          .eq("company_id", companyId)
          .eq("assigned_to", salespersonGhlUserId);

        if (opportunities?.length) {
          const oppUuids = opportunities.map(o => o.id);
          const oppGhlIds = opportunities.map(o => o.ghl_id).filter(Boolean) as string[];

          const uuidFilters = oppUuids.map(id => `opportunity_uuid.eq.${id}`).join(',');
          const ghlIdFilters = oppGhlIds.length ? oppGhlIds.map(id => `opportunity_id.eq.${id}`).join(',') : '';
          const combinedFilter = ghlIdFilters ? `${uuidFilters},${ghlIdFilters}` : uuidFilters;

          const { data: linkedProjects } = await supabase
            .from("projects")
            .select("id, project_number, project_name, project_address, customer_first_name, customer_last_name, project_status, primary_salesperson, secondary_salesperson, tertiary_salesperson, quaternary_salesperson")
            .eq("company_id", companyId)
            .is("deleted_at", null)
            .or(combinedFilter);

          opportunityProjects = (linkedProjects || [])
            .filter(p => 
              !p.primary_salesperson && 
              !p.secondary_salesperson && 
              !p.tertiary_salesperson && 
              !p.quaternary_salesperson
            )
            .map(({ primary_salesperson, secondary_salesperson, tertiary_salesperson, quaternary_salesperson, ...rest }) => rest);
        }
      }

      // Step 3: Merge and deduplicate
      const projectMap = new Map<string, (typeof directProjects)[0]>();
      [...(directProjects || []), ...opportunityProjects].forEach(p => {
        if (!projectMap.has(p.id)) {
          projectMap.set(p.id, p);
        }
      });

      const allProjects = Array.from(projectMap.values())
        .sort((a, b) => (b.project_number || 0) - (a.project_number || 0));

      if (!allProjects.length) return [];

      // Step 4: Get portal tokens for all projects
      const projectIds = allProjects.map((p) => p.id);
      const { data: tokensData } = await supabase
        .from("client_portal_tokens")
        .select("project_id, token")
        .in("project_id", projectIds)
        .eq("is_active", true);

      const tokenMap = new Map<string, string>();
      tokensData?.forEach((t) => {
        if (t.project_id) tokenMap.set(t.project_id, t.token);
      });

      return allProjects.map((p) => ({
        ...p,
        portal_token: tokenMap.get(p.id) || null,
      })) as ProjectWithPortal[];
    },
    enabled: !!salespersonName && !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  const projectsWithPortals = projects.filter((p) => p.portal_token);

  // Separate completed vs active
  const completedProjects = useMemo(
    () => projectsWithPortals.filter(p => p.project_status?.toLowerCase() === "completed"),
    [projectsWithPortals]
  );
  const activeProjects = useMemo(
    () => projectsWithPortals.filter(p => p.project_status?.toLowerCase() !== "completed"),
    [projectsWithPortals]
  );

  // Visible list based on toggle
  const visibleProjects = showCompleted ? completedProjects : activeProjects;

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
    <Card className="border border-border/50 shadow-md rounded-xl overflow-hidden">
      <CardHeader
        className="pb-3 pt-4 px-4 cursor-pointer bg-gradient-to-r from-primary/5 to-transparent"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Link className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Projects & Customer Portals</CardTitle>
              <p className="text-xs text-muted-foreground">
                {activeProjects.length > 0 ? `${activeProjects.length} active` : "Share project portals"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeProjects.length > 0 && (
              <Badge variant="secondary" className="font-medium">{activeProjects.length}</Badge>
            )}
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          {/* Completed toggle */}
          {completedProjects.length > 0 && (
            <div className="flex items-center gap-2 pb-3 pt-1" onClick={e => e.stopPropagation()}>
              <Switch
                id="show-completed-projects"
                checked={showCompleted}
                onCheckedChange={setShowCompleted}
                className="scale-90"
              />
              <Label htmlFor="show-completed-projects" className="text-xs text-muted-foreground cursor-pointer">
                Show completed ({completedProjects.length})
              </Label>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : visibleProjects.length === 0 ? (
            <div className="text-center py-8">
              <Link className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {showCompleted ? "No completed projects" : "No active customer portals available"}
              </p>
              {!showCompleted && (
                <p className="text-xs text-muted-foreground mt-1">
                  Portals are created when proposals are sent
                </p>
              )}
            </div>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-2">
                {visibleProjects.map((project) => (
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
