import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  settingsKeys: string[];
  isRequired: boolean;
}

export interface OnboardingPhase {
  id: string;
  title: string;
  description: string;
  icon: string;
  steps: OnboardingStep[];
}

// Define all onboarding phases and steps
export const ONBOARDING_PHASES: OnboardingPhase[] = [
  {
    id: "company",
    title: "Company Information",
    description: "Set up your company profile and branding",
    icon: "Building",
    steps: [
      {
        id: "logo",
        title: "Company Logo",
        description: "Upload your company logo for branding",
        estimatedMinutes: 1,
        settingsKeys: ["company_logo_url"],
        isRequired: false,
      },
      {
        id: "company_info",
        title: "Business Details",
        description: "Company name, address, phone, and website",
        estimatedMinutes: 2,
        settingsKeys: ["company_name", "company_address", "company_phone", "company_website"],
        isRequired: true,
      },
      {
        id: "license",
        title: "License Information",
        description: "License type, number, and holder name",
        estimatedMinutes: 1,
        settingsKeys: ["license_type", "license_number", "license_holder_name"],
        isRequired: false,
      },
    ],
  },
  {
    id: "email",
    title: "Email Configuration",
    description: "Configure email delivery settings",
    icon: "Mail",
    steps: [
      {
        id: "email_sender",
        title: "Email Sender",
        description: "From name and email for outgoing messages",
        estimatedMinutes: 1,
        settingsKeys: ["resend_from_email", "resend_from_name"],
        isRequired: true,
      },
      {
        id: "notification_email",
        title: "Notification Email",
        description: "Where to receive system notifications",
        estimatedMinutes: 1,
        settingsKeys: ["notification_email"],
        isRequired: false,
      },
    ],
  },
  {
    id: "estimates",
    title: "Estimate Defaults",
    description: "Set default values for estimates and proposals",
    icon: "FileText",
    steps: [
      {
        id: "estimate_terms",
        title: "Terms & Conditions",
        description: "Default terms for your estimates",
        estimatedMinutes: 3,
        settingsKeys: ["default_terms_and_conditions"],
        isRequired: true,
      },
      {
        id: "estimate_financials",
        title: "Financial Defaults",
        description: "Markup percentage, deposit amount, expiration days",
        estimatedMinutes: 2,
        settingsKeys: ["default_markup_percent", "default_deposit_percent", "default_deposit_max_amount", "estimate_expiration_days"],
        isRequired: false,
      },
    ],
  },
  {
    id: "portal",
    title: "Customer Portal",
    description: "Configure customer-facing portal settings",
    icon: "Settings",
    steps: [
      {
        id: "portal_settings",
        title: "Portal Configuration",
        description: "Upload limits and base URL",
        estimatedMinutes: 1,
        settingsKeys: ["portal_upload_limit_mb", "app_base_url"],
        isRequired: false,
      },
    ],
  },
  {
    id: "integrations",
    title: "Integrations (Optional)",
    description: "Connect external services",
    icon: "Link",
    steps: [
      {
        id: "ghl_integration",
        title: "GoHighLevel",
        description: "Connect your CRM for lead sync",
        estimatedMinutes: 5,
        settingsKeys: ["ghl_integration_enabled"],
        isRequired: false,
      },
      {
        id: "quickbooks",
        title: "QuickBooks",
        description: "Connect for accounting sync",
        estimatedMinutes: 5,
        settingsKeys: [],
        isRequired: false,
      },
    ],
  },
];

export interface OnboardingProgress {
  completedSteps: string[];
  skippedSteps: string[];
  currentPhaseIndex: number;
  currentStepIndex: number;
  isComplete: boolean;
  startedAt: string | null;
  completedAt: string | null;
}

const DEFAULT_PROGRESS: OnboardingProgress = {
  completedSteps: [],
  skippedSteps: [],
  currentPhaseIndex: 0,
  currentStepIndex: 0,
  isComplete: false,
  startedAt: null,
  completedAt: null,
};

export function useOnboardingProgress() {
  const { companyId, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  // Fetch onboarding progress
  const { data: progress, isLoading } = useQuery({
    queryKey: ["onboarding-progress", companyId],
    queryFn: async () => {
      if (!companyId) return DEFAULT_PROGRESS;

      const { data } = await supabase
        .from("company_settings")
        .select("setting_value")
        .eq("company_id", companyId)
        .eq("setting_key", "onboarding_progress")
        .maybeSingle();

      if (data?.setting_value) {
        try {
          return JSON.parse(data.setting_value) as OnboardingProgress;
        } catch {
          return DEFAULT_PROGRESS;
        }
      }
      return DEFAULT_PROGRESS;
    },
    enabled: !!companyId && isAdmin,
  });

  // Fetch current company settings to check completion
  const { data: settings } = useQuery({
    queryKey: ["company-settings-onboarding", companyId],
    queryFn: async () => {
      if (!companyId) return {};

      // Fetch company settings
      const { data: companyData } = await supabase
        .from("company_settings")
        .select("setting_key, setting_value")
        .eq("company_id", companyId);

      // Fetch app settings (defaults)
      const { data: appData } = await supabase
        .from("app_settings")
        .select("setting_key, setting_value");

      const settingsMap: Record<string, string | null> = {};
      
      // First add app settings as defaults
      appData?.forEach((s) => {
        settingsMap[s.setting_key] = s.setting_value;
      });
      
      // Then override with company settings
      companyData?.forEach((s) => {
        settingsMap[s.setting_key] = s.setting_value;
      });

      return settingsMap;
    },
    enabled: !!companyId && isAdmin,
  });

  // Save progress mutation
  const saveProgress = useMutation({
    mutationFn: async (newProgress: OnboardingProgress) => {
      if (!companyId) throw new Error("No company ID");

      const { error } = await supabase
        .from("company_settings")
        .upsert({
          company_id: companyId,
          setting_key: "onboarding_progress",
          setting_value: JSON.stringify(newProgress),
          setting_type: "json",
          description: "Company onboarding wizard progress",
          updated_at: new Date().toISOString(),
        }, { onConflict: "company_id,setting_key" });

      if (error) throw error;
      return newProgress;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-progress", companyId] });
    },
  });

  // Check if a step is complete based on settings
  const isStepComplete = (step: OnboardingStep): boolean => {
    if (!settings) return false;
    if (step.settingsKeys.length === 0) return false;
    
    return step.settingsKeys.every((key) => {
      const value = settings[key];
      return value !== null && value !== undefined && value !== "";
    });
  };

  // Calculate overall progress
  const calculateProgress = () => {
    let totalSteps = 0;
    let completedSteps = 0;
    let totalMinutes = 0;
    let remainingMinutes = 0;

    ONBOARDING_PHASES.forEach((phase) => {
      phase.steps.forEach((step) => {
        totalSteps++;
        totalMinutes += step.estimatedMinutes;
        
        const isComplete = isStepComplete(step) || 
          progress?.completedSteps.includes(step.id) || 
          progress?.skippedSteps.includes(step.id);
        
        if (isComplete) {
          completedSteps++;
        } else {
          remainingMinutes += step.estimatedMinutes;
        }
      });
    });

    return {
      totalSteps,
      completedSteps,
      progressPercent: totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0,
      totalMinutes,
      remainingMinutes,
    };
  };

  // Mark step as complete
  const completeStep = async (stepId: string) => {
    const currentProgress = progress || DEFAULT_PROGRESS;
    const newCompletedSteps = [...new Set([...currentProgress.completedSteps, stepId])];
    
    await saveProgress.mutateAsync({
      ...currentProgress,
      completedSteps: newCompletedSteps,
      startedAt: currentProgress.startedAt || new Date().toISOString(),
    });
  };

  // Skip step
  const skipStep = async (stepId: string) => {
    const currentProgress = progress || DEFAULT_PROGRESS;
    const newSkippedSteps = [...new Set([...currentProgress.skippedSteps, stepId])];
    
    await saveProgress.mutateAsync({
      ...currentProgress,
      skippedSteps: newSkippedSteps,
      startedAt: currentProgress.startedAt || new Date().toISOString(),
    });
  };

  // Mark onboarding complete
  const completeOnboarding = async () => {
    const currentProgress = progress || DEFAULT_PROGRESS;
    
    await saveProgress.mutateAsync({
      ...currentProgress,
      isComplete: true,
      completedAt: new Date().toISOString(),
    });
  };

  // Reset onboarding
  const resetOnboarding = async () => {
    await saveProgress.mutateAsync({
      ...DEFAULT_PROGRESS,
      startedAt: new Date().toISOString(),
    });
  };

  // Navigate to next step/phase
  const goToNext = async () => {
    const currentProgress = progress || DEFAULT_PROGRESS;
    let { currentPhaseIndex, currentStepIndex } = currentProgress;
    
    const currentPhase = ONBOARDING_PHASES[currentPhaseIndex];
    if (!currentPhase) return;
    
    if (currentStepIndex < currentPhase.steps.length - 1) {
      currentStepIndex++;
    } else if (currentPhaseIndex < ONBOARDING_PHASES.length - 1) {
      currentPhaseIndex++;
      currentStepIndex = 0;
    }
    
    await saveProgress.mutateAsync({
      ...currentProgress,
      currentPhaseIndex,
      currentStepIndex,
    });
  };

  // Navigate to previous step/phase
  const goToPrevious = async () => {
    const currentProgress = progress || DEFAULT_PROGRESS;
    let { currentPhaseIndex, currentStepIndex } = currentProgress;
    
    if (currentStepIndex > 0) {
      currentStepIndex--;
    } else if (currentPhaseIndex > 0) {
      currentPhaseIndex--;
      currentStepIndex = ONBOARDING_PHASES[currentPhaseIndex].steps.length - 1;
    }
    
    await saveProgress.mutateAsync({
      ...currentProgress,
      currentPhaseIndex,
      currentStepIndex,
    });
  };

  // Jump to specific phase/step
  const goToStep = async (phaseIndex: number, stepIndex: number) => {
    const currentProgress = progress || DEFAULT_PROGRESS;
    
    await saveProgress.mutateAsync({
      ...currentProgress,
      currentPhaseIndex: phaseIndex,
      currentStepIndex: stepIndex,
    });
  };

  return {
    progress: progress || DEFAULT_PROGRESS,
    settings: settings || {},
    isLoading,
    phases: ONBOARDING_PHASES,
    isStepComplete,
    calculateProgress,
    completeStep,
    skipStep,
    completeOnboarding,
    resetOnboarding,
    goToNext,
    goToPrevious,
    goToStep,
    isSaving: saveProgress.isPending,
  };
}
