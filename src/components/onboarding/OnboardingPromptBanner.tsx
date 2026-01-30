import { useNavigate } from "react-router-dom";
import { useOnboardingProgress } from "@/hooks/useOnboardingProgress";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sparkles, ArrowRight, X } from "lucide-react";
import { useState } from "react";

interface OnboardingPromptBannerProps {
  variant?: "default" | "dashboard";
}

export function OnboardingPromptBanner({ variant = "default" }: OnboardingPromptBannerProps) {
  const navigate = useNavigate();
  const { isAdmin, companyId } = useAuth();
  const { progress, calculateProgress, isLoading } = useOnboardingProgress();
  const [isDismissed, setIsDismissed] = useState(false);

  // Don't show for non-admins, if loading, if dismissed, or if onboarding is complete
  if (!isAdmin || !companyId || isLoading || isDismissed || progress.isComplete) {
    return null;
  }

  const { progressPercent, remainingMinutes, completedSteps, totalSteps } = calculateProgress();

  // If no progress has been made yet, show a welcome message
  const isNewCompany = progressPercent === 0;

  if (variant === "dashboard") {
    return (
      <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-accent/5 p-6">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-accent/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative flex items-center justify-between gap-6 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-foreground">
                {isNewCompany ? "Welcome! Complete Your Setup" : "Continue Your Setup"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {isNewCompany 
                  ? "Configure your company account to unlock all features"
                  : "Finish configuring your company account"}
              </p>
              {!isNewCompany && (
                <div className="flex items-center gap-3 pt-1">
                  <Progress value={progressPercent} className="w-32 h-2" />
                  <span className="text-xs font-medium text-muted-foreground">
                    {Math.round(progressPercent)}% complete
                  </span>
                  <span className="text-xs text-muted-foreground">
                    • ~{remainingMinutes} min left
                  </span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsDismissed(true)}
            >
              <X className="h-4 w-4" />
            </Button>
            <Button onClick={() => navigate("/onboarding")} className="gap-2">
              {isNewCompany ? "Start Setup" : "Continue Setup"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Default variant
  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div className="p-2 rounded-lg bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm">
                  {isNewCompany ? "Welcome! Let's set up your company" : "Continue Company Setup"}
                </h3>
                {!isNewCompany && (
                  <span className="text-xs text-muted-foreground">
                    {completedSteps}/{totalSteps} steps • ~{remainingMinutes} min left
                  </span>
                )}
              </div>
              {!isNewCompany && (
                <Progress value={progressPercent} className="h-1.5 mt-2 max-w-xs" />
              )}
              {isNewCompany && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Complete the setup wizard to configure your company settings (~15 min)
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => navigate("/onboarding")}
            >
              {isNewCompany ? "Start Setup" : "Continue"}
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => setIsDismissed(true)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
