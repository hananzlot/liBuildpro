import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, CreditCard } from 'lucide-react';

export function SubscriptionExpiredBanner() {
  const { 
    isSubscriptionActive, 
    isPastDue, 
    isTrialing, 
    daysUntilExpiration, 
    subscription,
    isSuperAdmin 
  } = useAuth();

  // Super admins don't see this banner
  if (isSuperAdmin) return null;

  // Subscription is expired
  if (!isSubscriptionActive && subscription) {
    return (
      <Alert variant="destructive" className="mb-4 rounded-none border-x-0 border-t-0">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Subscription Expired</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span>Your subscription has expired. Please renew to continue using the application.</span>
          <Button size="sm" variant="outline" className="ml-4 gap-2">
            <CreditCard className="h-4 w-4" />
            Renew Now
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // Subscription is past due (payment failed)
  if (isPastDue) {
    return (
      <Alert variant="destructive" className="mb-4 rounded-none border-x-0 border-t-0">
        <CreditCard className="h-4 w-4" />
        <AlertTitle>Payment Failed</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span>Your last payment failed. Please update your payment method to avoid service interruption.</span>
          <Button size="sm" variant="outline" className="ml-4 gap-2">
            <CreditCard className="h-4 w-4" />
            Update Payment
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // Trial ending soon (within 7 days)
  if (isTrialing && daysUntilExpiration !== null && daysUntilExpiration <= 7) {
    return (
      <Alert className="mb-4 rounded-none border-x-0 border-t-0 border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100">
        <Clock className="h-4 w-4" />
        <AlertTitle>Trial Ending Soon</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span>Your trial ends in {daysUntilExpiration} day{daysUntilExpiration !== 1 ? 's' : ''}. Subscribe now to continue using all features.</span>
          <Button size="sm" variant="outline" className="ml-4 gap-2 border-amber-500 text-amber-900 hover:bg-amber-100">
            Subscribe Now
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
