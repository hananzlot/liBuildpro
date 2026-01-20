export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired' | 'paused';
export type BillingCycle = 'monthly' | 'yearly';

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  max_users: number; // -1 means unlimited
  features: Record<string, boolean>;
  stripe_price_id_monthly: string | null;
  stripe_price_id_yearly: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CompanySubscription {
  id: string;
  company_id: string;
  plan_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: SubscriptionStatus;
  billing_cycle: BillingCycle;
  current_period_start: string;
  current_period_end: string;
  trial_ends_at: string | null;
  canceled_at: string | null;
  grace_period_ends_at: string | null;
  max_users_override: number | null; // Override plan's max_users for this company
  features_override: Record<string, boolean> | null; // Override plan's features for this company
  created_at: string;
  updated_at: string;
  // Joined data
  plan?: SubscriptionPlan;
}

export interface SubscriptionFeature {
  id: string;
  feature_key: string;
  name: string;
  description: string | null;
  category: string | null;
  created_at: string;
}

export interface BillingHistoryItem {
  id: string;
  company_id: string;
  subscription_id: string | null;
  stripe_invoice_id: string | null;
  amount: number;
  status: string;
  invoice_url: string | null;
  description: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface SubscriptionContext {
  subscription: CompanySubscription | null;
  plan: SubscriptionPlan | null;
  features: string[];
  canUseFeature: (featureKey: string) => boolean;
  isSubscriptionActive: boolean;
  isTrialing: boolean;
  isPastDue: boolean;
  daysUntilExpiration: number | null;
  userCount: number;
  userLimit: number;
  userLimitReached: boolean;
  isLoading: boolean;
  refetch: () => Promise<void>;
}
