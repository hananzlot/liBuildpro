import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOnboardingProgress, ONBOARDING_PHASES, OnboardingStep } from "@/hooks/useOnboardingProgress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Building, 
  Mail, 
  FileText, 
  Settings, 
  Link, 
  Check, 
  ChevronRight, 
  ChevronLeft,
  Clock,
  Sparkles,
  SkipForward,
  Loader2,
  PartyPopper
} from "lucide-react";
import { cn } from "@/lib/utils";
import { OnboardingStepContent } from "./OnboardingStepContent";

const ICON_MAP: Record<string, React.ElementType> = {
  Building,
  Mail,
  FileText,
  Settings,
  Link,
};

export function OnboardingWizard() {
  const navigate = useNavigate();
  const {
    progress,
    phases,
    isStepComplete,
    calculateProgress,
    completeStep,
    skipStep,
    completeOnboarding,
    goToNext,
    goToPrevious,
    goToStep,
    isSaving,
    isLoading,
  } = useOnboardingProgress();

  const [useDefaults, setUseDefaults] = useState<Record<string, boolean>>({});

  const { progressPercent, remainingMinutes, completedSteps, totalSteps } = calculateProgress();

  const currentPhase = phases[progress.currentPhaseIndex];
  const currentStep = currentPhase?.steps[progress.currentStepIndex];

  const isFirstStep = progress.currentPhaseIndex === 0 && progress.currentStepIndex === 0;
  const isLastStep = 
    progress.currentPhaseIndex === phases.length - 1 && 
    progress.currentStepIndex === (phases[phases.length - 1]?.steps.length || 1) - 1;

  const handleNext = async () => {
    if (currentStep) {
      await completeStep(currentStep.id);
    }
    
    if (isLastStep) {
      await completeOnboarding();
      navigate("/admin?tab=settings");
    } else {
      await goToNext();
    }
  };

  const handleSkip = async () => {
    if (currentStep) {
      await skipStep(currentStep.id);
    }
    await goToNext();
  };

  const handleFinishLater = async () => {
    navigate("/admin?tab=settings");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (progress.isComplete) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <PartyPopper className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl">Setup Complete!</CardTitle>
          <CardDescription>
            Your company is ready to use. You can always modify these settings later.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button onClick={() => navigate("/admin?tab=settings")}>
            Go to Admin Settings
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Progress */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              Company Setup
            </h1>
            <p className="text-muted-foreground">
              Let's get your company configured for success
            </p>
          </div>
          <Button variant="ghost" onClick={handleFinishLater}>
            Finish Later
          </Button>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {completedSteps} of {totalSteps} steps complete
            </span>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>~{remainingMinutes} min remaining</span>
            </div>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>
      </div>

      <div className="grid lg:grid-cols-[280px_1fr] gap-6">
        {/* Phase Sidebar */}
        <div className="space-y-2">
          {phases.map((phase, phaseIndex) => {
            const PhaseIcon = ICON_MAP[phase.icon] || Settings;
            const phaseComplete = phase.steps.every(
              (step) => isStepComplete(step) || progress.completedSteps.includes(step.id) || progress.skippedSteps.includes(step.id)
            );
            const isCurrentPhase = phaseIndex === progress.currentPhaseIndex;
            const isPastPhase = phaseIndex < progress.currentPhaseIndex;

            return (
              <Card
                key={phase.id}
                className={cn(
                  "cursor-pointer transition-all",
                  isCurrentPhase && "ring-2 ring-primary",
                  !isCurrentPhase && "opacity-70 hover:opacity-100"
                )}
                onClick={() => goToStep(phaseIndex, 0)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div
                    className={cn(
                      "p-2 rounded-lg",
                      phaseComplete || isPastPhase
                        ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                        : isCurrentPhase
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {phaseComplete ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <PhaseIcon className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-medium text-sm truncate">{phase.title}</h3>
                        {isCurrentPhase && (
                          <Badge variant="secondary" className="text-xs">
                            Current
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {phase.steps.length} step{phase.steps.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>

                  {/* Step indicators */}
                  {isCurrentPhase && (
                    <div className="flex gap-1 mt-3">
                      {phase.steps.map((step, stepIndex) => {
                        const stepComplete = isStepComplete(step) || 
                          progress.completedSteps.includes(step.id) || 
                          progress.skippedSteps.includes(step.id);
                        const isCurrentStep = stepIndex === progress.currentStepIndex;

                        return (
                          <button
                            key={step.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              goToStep(phaseIndex, stepIndex);
                            }}
                            className={cn(
                              "flex-1 h-1.5 rounded-full transition-colors",
                              stepComplete
                                ? "bg-emerald-500 dark:bg-emerald-400"
                                : isCurrentStep
                                ? "bg-primary"
                                : "bg-muted"
                            )}
                          />
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Main Content */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <span>Phase {progress.currentPhaseIndex + 1}</span>
              <ChevronRight className="h-3 w-3" />
              <span>Step {progress.currentStepIndex + 1} of {currentPhase?.steps.length}</span>
            </div>
            <CardTitle className="text-xl">{currentStep?.title}</CardTitle>
            <CardDescription className="flex items-center gap-2">
              {currentStep?.description}
              <Badge variant="outline" className="ml-2">
                <Clock className="h-3 w-3 mr-1" />
                ~{currentStep?.estimatedMinutes} min
              </Badge>
              {!currentStep?.isRequired && (
                <Badge variant="secondary">Optional</Badge>
              )}
            </CardDescription>
          </CardHeader>

          <Separator />

          <CardContent className="pt-6">
            {currentStep && (
              <OnboardingStepContent
                step={currentStep}
                useDefault={useDefaults[currentStep.id] || false}
                onUseDefaultChange={(value) => 
                  setUseDefaults(prev => ({ ...prev, [currentStep.id]: value }))
                }
              />
            )}
          </CardContent>

          <Separator />

          {/* Navigation Footer */}
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={goToPrevious}
                disabled={isFirstStep || isSaving}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>

              <div className="flex items-center gap-2">
                {!currentStep?.isRequired && !isLastStep && (
                  <Button
                    variant="ghost"
                    onClick={handleSkip}
                    disabled={isSaving}
                  >
                    <SkipForward className="h-4 w-4 mr-1" />
                    Skip
                  </Button>
                )}
                <Button onClick={handleNext} disabled={isSaving}>
                  {isSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  {isLastStep ? "Complete Setup" : "Continue"}
                  {!isLastStep && <ChevronRight className="h-4 w-4 ml-1" />}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
