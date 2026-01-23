import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { PortalChatProvider } from "@/contexts/PortalChatContext";
import { SubscriptionGuard } from "@/components/subscription/SubscriptionGuard";
import { FeatureLockedPrompt } from "@/components/subscription/FeatureLockedPrompt";
import { ThemeProvider } from "@/theme";
import Home from "./pages/Home";
import Dashboard from "./pages/Index";
import Auth from "./pages/Auth";
import Production from "./pages/Production";
import AuditLog from "./pages/AuditLog";
import FollowUp from "./pages/FollowUp";
import MagazineSales from "./pages/MagazineSales";
import Estimates from "./pages/Estimates";
import Documents from "./pages/Documents";
import ClientPortal from "./pages/ClientPortal";
import DocumentPortal from "./pages/DocumentPortal";
import AdminSettings from "./pages/AdminSettings";
import SalesPortal from "./pages/SalesPortal";
import Opportunities from "./pages/Opportunities";
import Appointments from "./pages/Appointments";
import NotFound from "./pages/NotFound";
import ThemePreview from "./pages/admin/ThemePreview";
import SuperAdminDashboard from "./pages/super-admin/SuperAdminDashboard";
import SuperAdminTenants from "./pages/super-admin/SuperAdminTenants";
import AppDefaultSettings from "./pages/super-admin/AppDefaultSettings";
import PlatformAdmins from "./pages/super-admin/PlatformAdmins";
import SubscriptionPlans from "./pages/super-admin/SubscriptionPlans";
import PlatformEmailSettingsPage from "./pages/super-admin/PlatformEmailSettings";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();


function ProtectedRoute({ 
  children, 
  requiredRole,
  allowedRoles,
  blockSalesOnly = false,
  requiredFeature
}: { 
  children: React.ReactNode; 
  requiredRole?: 'admin' | 'production' | 'contract_manager';
  allowedRoles?: ('admin' | 'magazine' | 'contract_manager' | 'sales')[];
  blockSalesOnly?: boolean;
  requiredFeature?: string;
}) {
  const { user, isLoading, isAdmin, isProduction, isMagazine, isContractManager, isDispatch, isSales, canUseFeature, isSuperAdmin } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If a Supabase recovery link lands on "/" (site url), redirect into the reset screen
  // while preserving the URL hash so Supabase can complete the recovery session.
  if (location.hash.includes("type=recovery") && location.pathname !== "/auth") {
    return (
      <Navigate
        replace
        to={{ pathname: "/auth", search: "?mode=reset", hash: location.hash }}
      />
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Check subscription feature access (super admins bypass this check)
  if (requiredFeature && !isSuperAdmin && !canUseFeature(requiredFeature)) {
    return <FeatureLockedPrompt featureKey={requiredFeature} />;
  }

  // Sales-only users (no other roles) can only access sales-portal
  const isSalesOnly = isSales && !isAdmin && !isDispatch && !isProduction && !isMagazine && !isContractManager;
  if (isSalesOnly && blockSalesOnly) {
    return <Navigate to="/sales-portal" replace />;
  }

  // Check role-based access
  if (requiredRole === 'production' && !isProduction && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  if (requiredRole === 'contract_manager' && !isContractManager && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  // Check allowed roles
  if (allowedRoles && allowedRoles.length > 0) {
    const hasAccess = allowedRoles.some(role => {
      switch (role) {
        case 'admin': return isAdmin;
        case 'magazine': return isMagazine;
        case 'contract_manager': return isContractManager;
        case 'sales': return isSales;
        default: return false;
      }
    });
    if (!hasAccess) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}

// Component to handle role-based default page routing
function DefaultPageRedirect() {
  const { user, isLoading, isSuperAdmin, isAdmin, isDispatch, isProduction, isMagazine, isContractManager, isSales } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Handle recovery links
  if (location.hash.includes("type=recovery") && location.pathname !== "/auth") {
    return (
      <Navigate
        replace
        to={{ pathname: "/auth", search: "?mode=reset", hash: location.hash }}
      />
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // All authenticated users go to the Home page
  // The Home page will show role-appropriate quick access cards
  // Super admins, admins, and dispatch all see the home selector
  if (isSuperAdmin || isAdmin || isDispatch) {
    return <Home />;
  }

  // Production role goes to production page
  if (isProduction) {
    return <Navigate to="/production" replace />;
  }

  // Magazine role goes to magazine sales
  if (isMagazine) {
    return <Navigate to="/magazine-sales" replace />;
  }

  // Contract manager goes to estimates
  if (isContractManager) {
    return <Navigate to="/estimates" replace />;
  }

  // Sales-only users go to sales portal
  if (isSales) {
    return <Navigate to="/sales-portal" replace />;
  }

  // User is logged in but has no recognized role - show access denied
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-md">
        <h1 className="text-2xl font-bold">No Access</h1>
        <p className="text-muted-foreground">
          Your account doesn't have any roles assigned. Please contact an administrator to get access to the system.
        </p>
      </div>
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <PortalChatProvider>
          <SubscriptionGuard>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Routes>
                  <Route path="/auth" element={<Auth />} />
              <Route
                path="/"
                element={<DefaultPageRedirect />}
              />
              {/* Dispatch Dashboard */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute blockSalesOnly requiredFeature="dashboard">
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              {/* Sales portal - sales only */}
              <Route
                path="/sales-portal"
                element={
                  <ProtectedRoute allowedRoles={['sales', 'admin']} requiredFeature="sales_portal">
                    <SalesPortal />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/opportunities"
                element={
                  <ProtectedRoute blockSalesOnly requiredFeature="ghl_integration">
                    <Opportunities />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/appointments"
                element={
                  <ProtectedRoute blockSalesOnly requiredFeature="ghl_integration">
                    <Appointments />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/follow-up"
                element={
                  <ProtectedRoute blockSalesOnly requiredFeature="ghl_integration">
                    <FollowUp />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/magazine-sales"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'magazine']} requiredFeature="magazine_sales">
                    <MagazineSales />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/production"
                element={
                  <ProtectedRoute requiredRole="production" requiredFeature="production">
                    <Production />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/audit-log"
                element={
                  <ProtectedRoute requiredRole="production" requiredFeature="production">
                    <AuditLog />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/estimates"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'contract_manager']} requiredFeature="estimates">
                    <Estimates />
                  </ProtectedRoute>
                }
              />
              {/* Admin settings - admin only */}
              <Route
                path="/admin/settings"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminSettings />
                  </ProtectedRoute>
                }
              />
              {/* Theme preview - admin only */}
              <Route
                path="/admin/theme-preview"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <ThemePreview />
                  </ProtectedRoute>
                }
              />
              {/* Documents - admin and contract_manager */}
              <Route
                path="/documents"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'contract_manager']} requiredFeature="documents">
                    <Documents />
                  </ProtectedRoute>
                }
              />
              {/* Public client portal - no auth required */}
              <Route path="/portal" element={<ClientPortal />} />
              {/* Public document portal - no auth required */}
              <Route path="/document-portal" element={<DocumentPortal />} />
              
              {/* Super Admin Portal Routes */}
              <Route path="/super-admin" element={<SuperAdminDashboard />} />
              <Route path="/super-admin/tenants" element={<SuperAdminTenants />} />
              <Route path="/super-admin/app-settings" element={<AppDefaultSettings />} />
              <Route path="/super-admin/admins" element={<PlatformAdmins />} />
              <Route path="/super-admin/plans" element={<SubscriptionPlans />} />
              <Route path="/super-admin/email-settings" element={<PlatformEmailSettingsPage />} />
              
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </SubscriptionGuard>
        </PortalChatProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
