import { useNavigate } from "react-router-dom";
import { useOnboardingProgress } from "@/hooks/useOnboardingProgress";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sparkles, ArrowRight, Clock, X } from "lucide-react";
import { useState } from "react";

export function OnboardingPromptBanner() {
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
