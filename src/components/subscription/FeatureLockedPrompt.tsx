import { Lock, Sparkles, ArrowRight, Crown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";

interface FeatureLockedPromptProps {
  featureKey?: string;
  featureName?: string;
}

const FEATURE_DETAILS: Record<string, { name: string; description: string; icon: React.ReactNode }> = {
  production: {
    name: "Production Management",
    description: "Track projects, manage subcontractors, and monitor outstanding AR/AP.",
    icon: <span className="text-2xl">🏗️</span>
  },
  analytics: {
    name: "Advanced Analytics",
    description: "Get deep insights into your business with cash flow charts, profitability reports, and more.",
    icon: <span className="text-2xl">📊</span>
  },
  documents: {
    name: "Document Signing",
    description: "Create and send documents for e-signature with built-in tracking.",
    icon: <span className="text-2xl">📝</span>
  },
  estimates: {
    name: "Estimates & Proposals",
    description: "Build professional estimates, send proposals, and manage contracts.",
    icon: <span className="text-2xl">💼</span>
  },
  magazine_sales: {
    name: "Magazine Sales",
    description: "Track magazine ad sales, page availability, and advertiser management.",
    icon: <span className="text-2xl">📚</span>
  },
  sales_portal: {
    name: "Sales Portal",
    description: "Dedicated portal for your sales team with lead tracking and commissions.",
    icon: <span className="text-2xl">💰</span>
  },
  ghl_integration: {
    name: "GHL Integration",
    description: "Sync contacts, opportunities, and appointments with GoHighLevel.",
    icon: <span className="text-2xl">🔗</span>
  },
  client_portal: {
    name: "Client Portal",
    description: "Give clients a branded portal to view their project progress and documents.",
    icon: <span className="text-2xl">👤</span>
  },
  multi_location: {
    name: "Multi-Location",
    description: "Manage multiple business locations from a single dashboard.",
    icon: <span className="text-2xl">🏢</span>
  }
};

export function FeatureLockedPrompt({ featureKey, featureName }: FeatureLockedPromptProps) {
  const { plan, isSubscriptionActive } = useAuth();
  
  const details = featureKey ? FEATURE_DETAILS[featureKey] : null;
  const displayName = featureName || details?.name || "This Feature";
  const description = details?.description || "This feature is not included in your current subscription plan.";

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full border-2 border-dashed border-muted-foreground/20 animate-fade-in">
        <CardHeader className="text-center pb-2">
          {/* Animated Lock Icon */}
          <div className="mx-auto mb-4 relative">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center animate-scale-in">
              <div className="h-14 w-14 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                <Lock className="h-7 w-7 text-primary" />
              </div>
            </div>
            <div className="absolute -top-1 -right-1 h-8 w-8 rounded-full bg-amber-500/20 flex items-center justify-center animate-scale-in" style={{ animationDelay: '0.1s' }}>
              <Crown className="h-4 w-4 text-amber-500" />
            </div>
          </div>

          {/* Feature Icon */}
          {details?.icon && (
            <div className="mb-2 animate-fade-in" style={{ animationDelay: '0.15s' }}>
              {details.icon}
            </div>
          )}

          <CardTitle className="text-xl animate-fade-in" style={{ animationDelay: '0.2s' }}>
            {displayName}
          </CardTitle>
          
          <Badge variant="secondary" className="mx-auto mt-2 animate-fade-in" style={{ animationDelay: '0.25s' }}>
            Premium Feature
          </Badge>
        </CardHeader>

        <CardContent className="text-center space-y-6">
          <CardDescription className="text-base animate-fade-in" style={{ animationDelay: '0.3s' }}>
            {description}
          </CardDescription>

          {/* Current Plan Info */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2 animate-fade-in" style={{ animationDelay: '0.35s' }}>
            {!isSubscriptionActive ? (
              <>
                <p className="text-sm font-medium text-destructive">
                  Your subscription has expired
                </p>
                <p className="text-xs text-muted-foreground">
                  Please renew your subscription to access this feature.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Your current plan:
                </p>
                <p className="font-semibold text-lg">{plan?.name || "Free"}</p>
                <p className="text-xs text-muted-foreground">
                  Upgrade to access {displayName.toLowerCase()} and more.
                </p>
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <Button className="w-full gap-2 group" size="lg">
              <Sparkles className="h-4 w-4 group-hover:animate-pulse" />
              Upgrade Plan
              <ArrowRight className="h-4 w-4 ml-auto transition-transform group-hover:translate-x-1" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
              Go Back
            </Button>
          </div>

          {/* Benefits Preview */}
          <div className="pt-4 border-t border-border animate-fade-in" style={{ animationDelay: '0.45s' }}>
            <p className="text-xs text-muted-foreground mb-3">What you'll get with an upgrade:</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-left">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                <span>All premium features</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                <span>Priority support</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                <span>Advanced analytics</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                <span>Unlimited users</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
