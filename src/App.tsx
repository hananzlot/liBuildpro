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
      buster: "v3", // Bump to invalidate all stale IDB caches
      // IMPORTANT: Don't persist mutations or the app-version query.
      // Mutations: Persisted mutation state can get stuck as "pending" across refresh/tab close.
      // app-version: Must always fetch fresh to trigger cache-clearing on deploys.
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
