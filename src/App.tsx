import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { MemoryRouter } from "react-router-dom";
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

// MemoryRouter doesn't reflect navigation in the URL, so if the browser reloads
// (common when a tab is backgrounded/suspended), we must restore the last active
// in-app tab ourselves.
const INNER_TABS_STORAGE_KEY = "app-inner-tabs";

function getInitialEntries(): string[] {
  if (typeof window === "undefined") return ["/"];
  try {
    const savedTabs = window.localStorage.getItem(INNER_TABS_STORAGE_KEY);
    const savedActiveId = window.localStorage.getItem(`${INNER_TABS_STORAGE_KEY}-active`);
    const tabs = savedTabs ? (JSON.parse(savedTabs) as Array<{ id: string; path: string }>) : [];

    const activeTab =
      (savedActiveId ? tabs.find((t) => t.id === savedActiveId) : null) ||
      (tabs.length ? tabs[tabs.length - 1] : null);

    return [activeTab?.path || "/"];
  } catch {
    return ["/"];
  }
}

const INITIAL_ENTRIES = getInitialEntries();

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
            <GlobalHooks />
            <Toaster />
            <Sonner />
            <MemoryRouter initialEntries={INITIAL_ENTRIES}>
              <AppTabsProvider>
                <AppRoutes />
              </AppTabsProvider>
            </MemoryRouter>
          </TooltipProvider>
        </SubscriptionGuard>
      </PortalChatProvider>
    </AuthProvider>
  </PersistQueryClientProvider>
);

export default App;
