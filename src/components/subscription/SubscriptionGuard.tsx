import { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CreditCard, LogOut, Mail } from 'lucide-react';

interface SubscriptionGuardProps {
  children: ReactNode;
}

export function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  const { 
    user,
    profile,
    company,
    subscription,
    isSubscriptionActive,
    isPastDue,
    isSuperAdmin,
    isLoading,
    isProfileLoading,
    signOut,
    daysUntilExpiration
  } = useAuth();

  // Still loading auth or profile - show nothing (loading state handled elsewhere)
  if (isLoading || isProfileLoading) {
    return <>{children}</>;
  }

  // Not logged in - let normal auth flow handle it
  if (!user) {
    return <>{children}</>;
  }

  // Profile exists but company still loading - wait a bit more
  // This handles the race condition where profile is set but company fetch is still in progress
  if (user && !profile) {
    return <>{children}</>;
  }

  // Super admins always have access
  if (isSuperAdmin) {
    return <>{children}</>;
  }

  // No company assigned - this is a configuration issue
  if (!company) {
    return (
      <SubscriptionBlockedScreen
        title="No Company Assigned"
        description="Your account is not associated with any company. Please contact your administrator to get access."
        showContactAdmin
        onSignOut={signOut}
      />
    );
  }

  // No subscription at all
  if (!subscription) {
    return (
      <SubscriptionBlockedScreen
        title="No Active Subscription"
        description={`${company.name} does not have an active subscription. Please contact your administrator to activate your subscription.`}
        showContactAdmin
        onSignOut={signOut}
      />
    );
  }

  // Subscription expired (by status or past end date)
  const isExpiredByDate = subscription.current_period_end && new Date(subscription.current_period_end) < new Date();
  
  if (subscription.status === 'expired' || (subscription.status === 'active' && isExpiredByDate)) {
    return (
      <SubscriptionBlockedScreen
        title="Subscription Expired"
        description={`Your subscription for ${company.name} has expired. Please renew to continue using the application.`}
        showPaymentButton
        onSignOut={signOut}
      />
    );
  }

  // Subscription canceled
  if (subscription.status === 'canceled') {
    return (
      <SubscriptionBlockedScreen
        title="Subscription Canceled"
        description={`Your subscription for ${company.name} has been canceled. Please contact your administrator to reactivate.`}
        showContactAdmin
        onSignOut={signOut}
      />
    );
  }

  // Past due - show warning but allow limited access for grace period
  // Note: You might want to block access after grace period ends
  if (isPastDue && subscription.grace_period_ends_at) {
    const graceEnds = new Date(subscription.grace_period_ends_at);
    const now = new Date();
    if (graceEnds < now) {
      // Grace period ended
      return (
        <SubscriptionBlockedScreen
          title="Payment Required"
          description={`Your payment is overdue and the grace period has ended. Please update your payment method to continue using the application.`}
          showPaymentButton
          onSignOut={signOut}
        />
      );
    }
  }

  // Active or trialing - allow access
  return <>{children}</>;
}

interface SubscriptionBlockedScreenProps {
  title: string;
  description: string;
  showPaymentButton?: boolean;
  showContactAdmin?: boolean;
  onSignOut: () => void;
}

function SubscriptionBlockedScreen({
  title,
  description,
  showPaymentButton,
  showContactAdmin,
  onSignOut
}: SubscriptionBlockedScreenProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription className="text-base">
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {showPaymentButton && (
            <Button className="w-full gap-2" size="lg">
              <CreditCard className="h-4 w-4" />
              Update Payment Method
            </Button>
          )}
          
          {showContactAdmin && (
            <Button variant="outline" className="w-full gap-2" size="lg" asChild>
              <a href="mailto:admin@example.com">
                <Mail className="h-4 w-4" />
                Contact Administrator
              </a>
            </Button>
          )}
          
          <Button 
            variant="ghost" 
            className="w-full gap-2" 
            onClick={onSignOut}
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
