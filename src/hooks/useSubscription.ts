import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { CompanySubscription, SubscriptionPlan, SubscriptionContext } from '@/types/subscription';

interface UseSubscriptionProps {
  companyId: string | null;
  isSuperAdmin: boolean;
}

export function useSubscription({ companyId, isSuperAdmin }: UseSubscriptionProps): SubscriptionContext {
  const [subscription, setSubscription] = useState<CompanySubscription | null>(null);
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [userCount, setUserCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSubscription = useCallback(async () => {
    if (!companyId) {
      setSubscription(null);
      setPlan(null);
      setUserCount(0);
      setIsLoading(false);
      return;
    }

    try {
      // Fetch subscription with plan
      const { data: subData, error: subError } = await supabase
        .from('company_subscriptions')
        .select(`
          *,
          plan:subscription_plans(*)
        `)
        .eq('company_id', companyId)
        .maybeSingle();

      if (subError) {
        console.error('Error fetching subscription:', subError);
      } else if (subData) {
        const planData = subData.plan as unknown as SubscriptionPlan;
        setSubscription({
          ...subData,
          status: subData.status as CompanySubscription['status'],
          billing_cycle: subData.billing_cycle as CompanySubscription['billing_cycle'],
          features_override: subData.features_override as Record<string, boolean> | null,
          plan: planData
        });
        setPlan(planData);
      } else {
        setSubscription(null);
        setPlan(null);
      }

      // Fetch user count for this company
      const { count, error: countError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId);

      if (!countError) {
        setUserCount(count || 0);
      }
    } catch (error) {
      console.error('Error in useSubscription:', error);
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // Calculate derived values - merge plan features with subscription overrides
  const features = useMemo(() => {
    const planFeatures = plan?.features || {};
    const overrides = subscription?.features_override || {};
    
    // Merge: start with plan features, apply overrides
    const mergedFeatures = { ...planFeatures, ...overrides };
    
    return Object.entries(mergedFeatures)
      .filter(([, enabled]) => enabled)
      .map(([key]) => key);
  }, [plan, subscription]);

  const isSubscriptionActive = useMemo(() => {
    // Super admins always have access
    if (isSuperAdmin) return true;
    // No subscription means no access (unless super admin)
    if (!subscription) return false;
    // Check status
    return subscription.status === 'active' || subscription.status === 'trialing';
  }, [subscription, isSuperAdmin]);

  const isTrialing = subscription?.status === 'trialing';
  const isPastDue = subscription?.status === 'past_due';

  const daysUntilExpiration = useMemo(() => {
    if (!subscription?.current_period_end) return null;
    const endDate = new Date(subscription.current_period_end);
    const now = new Date();
    const diffTime = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }, [subscription]);

  // Use override if set, otherwise use plan default
  const userLimit = subscription?.max_users_override ?? plan?.max_users ?? -1;
  const userLimitReached = userLimit !== -1 && userCount >= userLimit;

  const canUseFeature = useCallback((featureKey: string): boolean => {
    // Super admins can use all features
    if (isSuperAdmin) return true;
    // No active subscription means no features
    if (!isSubscriptionActive) return false;
    // Check if feature is in plan
    return features.includes(featureKey);
  }, [isSuperAdmin, isSubscriptionActive, features]);

  return {
    subscription,
    plan,
    features,
    canUseFeature,
    isSubscriptionActive,
    isTrialing,
    isPastDue,
    daysUntilExpiration,
    userCount,
    userLimit,
    userLimitReached,
    isLoading,
    refetch: fetchSubscription
  };
}
