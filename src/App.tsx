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
      buster: "v2", // Changed to bust stale mutation cache
      // IMPORTANT: Don't persist mutations.
      // Persisted mutation state can get stuck as "pending" across refresh/tab close,
      // which incorrectly shows loading spinners (e.g., "Save Estimate").
      dehydrateOptions: {
        shouldDehydrateMutation: () => false,
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
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </TooltipProvider>
        </SubscriptionGuard>
      </PortalChatProvider>
    </AuthProvider>
  </PersistQueryClientProvider>
);

export default App;
