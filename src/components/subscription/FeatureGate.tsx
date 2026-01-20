import { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, Sparkles } from 'lucide-react';

interface FeatureGateProps {
  featureKey: string;
  children: ReactNode;
  fallback?: ReactNode;
  showUpgradePrompt?: boolean;
}

export function FeatureGate({ 
  featureKey, 
  children, 
  fallback,
  showUpgradePrompt = true 
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

  return (
    <Card className="border-dashed border-2 border-muted-foreground/25">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Lock className="h-6 w-6 text-muted-foreground" />
        </div>
        <CardTitle className="text-lg">Feature Locked</CardTitle>
        <CardDescription>
          {!isSubscriptionActive 
            ? "Your subscription has expired. Please renew to access this feature."
            : `This feature requires a higher plan. You're currently on the ${plan?.name || 'Free'} plan.`
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <Button className="gap-2">
          <Sparkles className="h-4 w-4" />
          Upgrade Plan
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
