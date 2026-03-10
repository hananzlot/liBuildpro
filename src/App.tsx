import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { PortalChatProvider } from "@/contexts/PortalChatContext";
import { SubscriptionGuard } from "@/components/subscription/SubscriptionGuard";
import { AppRoutes } from "@/components/routing/AppRoutes";
import { createIDBPersister } from "@/lib/queryPersister";
import { usePreventSwipeNavigation } from "@/hooks/usePreventSwipeNavigation";
import { AppTabsProvider } from "@/contexts/AppTabsContext";

// Component to apply global hooks
function GlobalHooks() {
  usePreventSwipeNavigation();
  return null;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Prevent sheets from closing when switching tabs
      gcTime: 1000 * 60 * 60 * 24, // 24 hours - keep in cache for persistence
    },
  },
});

const persister = createIDBPersister();

const App = () => (
  <PersistQueryClientProvider
    client={queryClient}
    persistOptions={{
      persister,
      maxAge: 1000 * 60 * 60 * 24, // 24 hours max cache age
      // Cache busting is now driven by the app_version table in the database.
      // When a super_admin bumps the version via the UI, useAppVersion detects the
      // mismatch against localStorage and clears IDB + reloads for all users.
      // No hardcoded buster needed — the app-version query is excluded from
      // persistence below so it always fetches fresh from the DB.
      dehydrateOptions: {
        shouldDehydrateMutation: () => false,
        shouldDehydrateQuery: (query) => {
          // Don't persist the app-version query — it must always be fresh
          const queryKey = query.queryKey;
          if (Array.isArray(queryKey) && queryKey[0] === "app-version") return false;
          return true;
        },
      },
    }}
    onSuccess={() => {
      // If an older cache (created before the rule above) is restored,
      // clear any hydrated mutations so UI doesn't think something is still saving.
      queryClient.getMutationCache().clear();
    }}
  >
    <AuthProvider>
      <PortalChatProvider>
        <SubscriptionGuard>
          <TooltipProvider>
            <GlobalHooks />
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AppTabsProvider>
                <AppRoutes />
              </AppTabsProvider>
            </BrowserRouter>
          </TooltipProvider>
        </SubscriptionGuard>
      </PortalChatProvider>
    </AuthProvider>
  </PersistQueryClientProvider>
);

export default App;
