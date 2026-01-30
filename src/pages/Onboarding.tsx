import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { Loader2 } from "lucide-react";

export default function Onboarding() {
  const { isAdmin, isLoading: authLoading, companyId } = useAuth();

  if (authLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  // Only admins can access onboarding
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  // Must have a company context
  if (!companyId) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[50vh]">
          <p className="text-muted-foreground">
            Please select a company to continue with onboarding.
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <OnboardingWizard />
      </div>
    </AppLayout>
  );
}
