import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/**
 * Hook to handle QuickBooks OAuth callback at a high level.
 * This runs independently of company context to ensure the callback
 * is processed even before company selection is restored.
 */
export function useQuickBooksCallback() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const processingRef = useRef(false);

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
      const realmId = searchParams.get("realmId");
      const state = searchParams.get("state");

      // Only process if we have all OAuth params and haven't already processed
      if (!code || !realmId || !state || processingRef.current) {
        return;
      }

      processingRef.current = true;

      try {
        // Parse state to get company ID
        const { companyId } = JSON.parse(atob(state));
        
        if (!companyId) {
          toast.error("Invalid OAuth state - missing company ID");
          return;
        }

        console.log("Processing QuickBooks OAuth callback for company:", companyId);

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
          console.log("QuickBooks connected successfully!");
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
  }, [searchParams, setSearchParams, queryClient]);
}
