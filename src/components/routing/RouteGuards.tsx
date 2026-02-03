import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { FeatureLockedPrompt } from "@/components/subscription/FeatureLockedPrompt";
import { Loader2 } from "lucide-react";
import Home from "@/pages/Home";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'production' | 'contract_manager';
  allowedRoles?: ('admin' | 'magazine' | 'contract_manager' | 'sales')[];
  blockSalesOnly?: boolean;
  requiredFeature?: string;
}

export function ProtectedRoute({ 
  children, 
  requiredRole,
  allowedRoles,
  blockSalesOnly = false,
  requiredFeature
}: ProtectedRouteProps) {
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
    // IMPORTANT: Preserve OAuth callback params when a protected route redirects to /auth.
    // Otherwise we lose the `code/realmId/state` needed to exchange tokens.
    const isQuickBooksOAuthCallback =
      location.search.includes("code=") &&
      location.search.includes("realmId=") &&
      location.search.includes("state=");

    if (isQuickBooksOAuthCallback) {
      return <Navigate to={{ pathname: "/auth", search: location.search }} replace />;
    }

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
  if (requiredRole === 'production' && !isProduction && !isAdmin && !isDispatch) {
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
export function DefaultPageRedirect() {
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

  // Magazine role (without super_admin) - redirect to home since Magazine Sales is super admin only now
  if (isMagazine && !isSuperAdmin) {
    return <Home />;
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
