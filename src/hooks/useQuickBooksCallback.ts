import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Hook to handle QuickBooks OAuth callback at a high level.
 * This runs independently of company context to ensure the callback
 * is processed even before company selection is restored.
 * 
 * IMPORTANT: This also restores the super admin's company context
 * from the OAuth state, since the redirect loses sessionStorage context.
 */
export function useQuickBooksCallback() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const processingRef = useRef(false);
  const { isSuperAdmin, setViewingCompanyId } = useAuth();

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
      const realmId = searchParams.get("realmId");
      const state = searchParams.get("state");

      // In development (React strict mode) effects can run twice due to mount/unmount.
      // Intuit auth codes are single-use; double-submitting causes `invalid_grant`.
      const processedKey = code ? `qb_oauth_processed:${code}` : null;
      if (processedKey && sessionStorage.getItem(processedKey)) {
        return;
      }

      // Only process if we have all OAuth params and haven't already processed
      if (!code || !realmId || !state || processingRef.current) {
        return;
      }

      processingRef.current = true;
      if (processedKey) sessionStorage.setItem(processedKey, "1");

      try {
        // Parse state to get company ID
        const { companyId } = JSON.parse(atob(state));
        
        if (!companyId) {
          toast.error("Invalid OAuth state - missing company ID");
          return;
        }

        // CRITICAL: Restore super admin company context from OAuth state
        // This ensures the admin is switched back to the company they were working on
        // before the OAuth redirect took them away from the app
        if (isSuperAdmin && companyId) {
          setViewingCompanyId(companyId);
        }

        const { data, error } = await supabase.functions.invoke("quickbooks-auth", {
          body: {
            action: "exchange-code",
            code,
            realmId,
            companyId,
            redirectUri: `${window.location.origin}/admin/settings`,
          },
        });

        if (error || data?.error) {
          console.error("QuickBooks token exchange failed:", error || data?.error);
          toast.error(data?.error || "Failed to connect QuickBooks");
        } else {
          toast.success("QuickBooks connected successfully!");
          queryClient.invalidateQueries({ queryKey: ["quickbooks-connection"] });
        }
      } catch (err) {
        console.error("OAuth callback error:", err);
        toast.error("Failed to process QuickBooks authorization");
      } finally {
        // Clean up URL parameters - preserve tab if present
        const newParams = new URLSearchParams();
        const tab = searchParams.get("tab");
        if (tab) {
          newParams.set("tab", tab);
        }
        setSearchParams(newParams, { replace: true });
      }
    };

    handleCallback();
  }, [searchParams, setSearchParams, queryClient, isSuperAdmin, setViewingCompanyId]);
}
