import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Index from "./pages/Index";
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
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();


function ProtectedRoute({ 
  children, 
  requiredRole,
  allowedRoles 
}: { 
  children: React.ReactNode; 
  requiredRole?: 'admin' | 'production' | 'contract_manager';
  allowedRoles?: ('admin' | 'magazine' | 'contract_manager')[];
}) {
  const { user, isLoading, isAdmin, isProduction, isMagazine, isContractManager } = useAuth();
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
        default: return false;
      }
    });
    if (!hasAccess) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Index />
                </ProtectedRoute>
              }
            />
            <Route
              path="/follow-up"
              element={
                <ProtectedRoute>
                  <FollowUp />
                </ProtectedRoute>
              }
            />
            <Route
              path="/magazine-sales"
              element={
                <ProtectedRoute allowedRoles={['admin', 'magazine']}>
                  <MagazineSales />
                </ProtectedRoute>
              }
            />
            <Route
              path="/production"
              element={
                <ProtectedRoute requiredRole="production">
                  <Production />
                </ProtectedRoute>
              }
            />
            <Route
              path="/audit-log"
              element={
                <ProtectedRoute requiredRole="production">
                  <AuditLog />
                </ProtectedRoute>
              }
            />
            <Route
              path="/estimates"
              element={
                <ProtectedRoute allowedRoles={['admin', 'contract_manager']}>
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
            {/* Documents - admin and contract_manager */}
            <Route
              path="/documents"
              element={
                <ProtectedRoute allowedRoles={['admin', 'contract_manager']}>
                  <Documents />
                </ProtectedRoute>
              }
            />
            {/* Public client portal - no auth required */}
            <Route path="/portal" element={<ClientPortal />} />
            {/* Public document portal - no auth required */}
            <Route path="/document-portal" element={<DocumentPortal />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
