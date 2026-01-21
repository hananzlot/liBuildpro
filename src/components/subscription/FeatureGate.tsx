import { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lock, Sparkles, Crown, ArrowRight } from 'lucide-react';

interface FeatureGateProps {
  featureKey: string;
  featureName?: string;
  children: ReactNode;
  fallback?: ReactNode;
  showUpgradePrompt?: boolean;
  compact?: boolean;
}

export function FeatureGate({ 
  featureKey, 
  featureName,
  children, 
  fallback,
  showUpgradePrompt = true,
  compact = false
}: FeatureGateProps) {
  const { canUseFeature, isSubscriptionActive, plan, isTrialing, daysUntilExpiration } = useAuth();

  const hasAccess = canUseFeature(featureKey);

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (!showUpgradePrompt) {
    return null;
  }

  // Compact version for inline use
  if (compact) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-lg border border-dashed border-muted-foreground/25 bg-muted/30 animate-fade-in">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Lock className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{featureName || 'Premium Feature'}</p>
          <p className="text-xs text-muted-foreground">Upgrade to access this feature</p>
        </div>
        <Button size="sm" className="gap-1 flex-shrink-0">
          <Sparkles className="h-3 w-3" />
          Upgrade
        </Button>
      </div>
    );
  }

  return (
    <Card className="border-dashed border-2 border-muted-foreground/25 animate-fade-in">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 relative">
          <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
            <Lock className="h-7 w-7 text-primary" />
          </div>
          <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-amber-500/20 flex items-center justify-center">
            <Crown className="h-3 w-3 text-amber-500" />
          </div>
        </div>
        <CardTitle className="text-lg">{featureName || 'Feature Locked'}</CardTitle>
        <Badge variant="secondary" className="mx-auto mt-1">Premium</Badge>
        <CardDescription className="mt-2">
          {!isSubscriptionActive 
            ? "Your subscription has expired. Please renew to access this feature."
            : `This feature requires a higher plan. You're currently on the ${plan?.name || 'Free'} plan.`
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <Button className="gap-2 group">
          <Sparkles className="h-4 w-4 group-hover:animate-pulse" />
          Upgrade Plan
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Button>
        {isTrialing && daysUntilExpiration !== null && daysUntilExpiration > 0 && (
          <p className="mt-3 text-sm text-muted-foreground">
            {daysUntilExpiration} days left in your trial
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// Hook version for conditional rendering logic
export function useFeatureGate(featureKey: string) {
  const { canUseFeature, subscription, isSubscriptionActive } = useAuth();
  
  return {
    hasAccess: canUseFeature(featureKey),
    isTrialing: subscription?.status === 'trialing',
    upgradeRequired: !canUseFeature(featureKey),
    isSubscriptionActive
  };
}
