import { useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Loader2 } from "lucide-react";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface UUIDRouteGuardProps {
  children: React.ReactNode;
  /** The route param name containing the ID (default: "id") */
  paramName?: string;
  /** The Supabase table to resolve against */
  table: "opportunities" | "appointments" | "projects" | "estimates" | "contacts";
  /** The column that holds the legacy external ID (default: "ghl_id") */
  externalIdColumn?: string;
}

/**
 * Intercepts routes where the URL param might be a legacy GHL ID
 * instead of a UUID. Resolves it to the internal UUID and redirects,
 * so all downstream components can rely on UUID-based lookups.
 */
export function UUIDRouteGuard({
  children,
  paramName = "id",
  table,
  externalIdColumn = "ghl_id",
}: UUIDRouteGuardProps) {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { companyId } = useCompanyContext();

  const rawId = params[paramName];
  const isUUID = rawId ? UUID_REGEX.test(rawId) : false;

  // Only resolve when the param is NOT already a UUID
  const { data: resolvedId, isLoading, isError } = useQuery({
    queryKey: ["uuid-resolve", table, rawId, companyId],
    queryFn: async () => {
      if (!rawId || !companyId) return null;

      const { data, error } = await (supabase
        .from(table)
        .select("id")
        .eq("company_id", companyId) as any)
        .eq(externalIdColumn, rawId)
        .maybeSingle();

      if (error) throw error;
      return data?.id ?? null;
    },
    enabled: !!rawId && !isUUID && !!companyId,
    staleTime: 1000 * 60 * 5, // cache resolved IDs for 5 min
    retry: 1,
  });

  useEffect(() => {
    if (!rawId || isUUID || isLoading) return;

    if (resolvedId) {
      // Replace the legacy ID in the current path with the UUID
      const newPath = location.pathname.replace(rawId, resolvedId);
      navigate(newPath + location.search + location.hash, { replace: true });
    }
  }, [resolvedId, rawId, isUUID, isLoading, location, navigate]);

  // If it's already a UUID, render children immediately
  if (isUUID) return <>{children}</>;

  // Still resolving
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Could not resolve — let the child page handle the "not found" case
  if (isError || !resolvedId) {
    return <>{children}</>;
  }

  // Redirect is pending (useEffect will fire)
  return null;
}
