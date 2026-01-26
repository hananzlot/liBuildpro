import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { PortalChatProvider } from "@/contexts/PortalChatContext";
import { SubscriptionGuard } from "@/components/subscription/SubscriptionGuard";
import { AppRoutes } from "@/components/routing/AppRoutes";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Prevent sheets from closing when switching tabs
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
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
  </QueryClientProvider>
);

export default App;
