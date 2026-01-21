import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import type { CompanySubscription, SubscriptionPlan } from "@/types/subscription";

export type AppRole = 'super_admin' | 'admin' | 'magazine' | 'production' | 'dispatch' | 'sales' | 'contract_manager' | 'corp_admin' | 'corp_viewer';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  ghl_user_id: string | null;
  company_id: string | null;
}

export interface Company {
  id: string;
  corporation_id: string | null;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  is_active: boolean;
}

interface Corporation {
  id: string;
  name: string;
  slug: string;
  settings: Record<string, unknown>;
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  // Multi-tenancy context
  companyId: string | null;
  corporationId: string | null;
  company: Company | null;
  corporation: Corporation | null;
  // Super admin company switching
  viewingCompanyId: string | null;
  viewingCompany: Company | null;
  setViewingCompanyId: (companyId: string | null) => void;
  isViewingOtherCompany: boolean;
  // Role checks
  isSuperAdmin: boolean;
  isAdmin: boolean; // true if super_admin OR admin
  isCorpAdmin: boolean;
  isCorpViewer: boolean;
  isMagazine: boolean;
  isProduction: boolean;
  isDispatch: boolean;
  isSales: boolean;
  isContractManager: boolean;
  userRoles: AppRole[];
  isLoading: boolean;
  isProfileLoading: boolean;
  isSubscriptionLoading: boolean;
  // Role simulation for admins
  simulatedRole: AppRole | null;
  isSimulating: boolean;
  setSimulatedRole: (role: AppRole | null) => void;
  availableRoles: AppRole[];
  // Subscription context
  subscription: CompanySubscription | null;
  plan: SubscriptionPlan | null;
  subscriptionFeatures: string[];
  canUseFeature: (featureKey: string) => boolean;
  isSubscriptionActive: boolean;
  isTrialing: boolean;
  isPastDue: boolean;
  daysUntilExpiration: number | null;
  userCount: number;
  userLimit: number;
  userLimitReached: boolean;
  refetchSubscription: () => Promise<void>;
  // Auth methods
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  // Helper to refresh company context
  refreshCompanyContext: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ALL_ROLES: AppRole[] = ['super_admin', 'corp_admin', 'admin', 'corp_viewer', 'magazine', 'production', 'dispatch', 'sales', 'contract_manager'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [corporation, setCorporation] = useState<Corporation | null>(null);
  const [actualRoles, setActualRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [simulatedRole, setSimulatedRole] = useState<AppRole | null>(null);
  
  // Super admin company switching
  const [viewingCompanyId, setViewingCompanyIdState] = useState<string | null>(null);
  const [viewingCompany, setViewingCompany] = useState<Company | null>(null);

  // Derive base company and corporation IDs from profile
  const baseCompanyId = profile?.company_id ?? null;
  const baseCorporationId = company?.corporation_id ?? null;

  // Calculate actual role flags
  const actualIsSuperAdmin = actualRoles.includes('super_admin');
  const actualIsCorpAdmin = actualRoles.includes('corp_admin') || actualIsSuperAdmin;
  const actualIsCorpViewer = actualRoles.includes('corp_viewer');
  const actualIsAdmin = actualRoles.includes('admin') || actualIsSuperAdmin || actualIsCorpAdmin;
  const actualIsMagazine = actualRoles.includes('magazine');
  const actualIsProduction = actualRoles.includes('production');
  const actualIsDispatch = actualRoles.includes('dispatch');
  const actualIsSales = actualRoles.includes('sales');
  const actualIsContractManager = actualRoles.includes('contract_manager');

  // Calculate effective roles based on simulation
  const isSimulating = actualIsAdmin && simulatedRole !== null;
  
  const isSuperAdmin = isSimulating 
    ? simulatedRole === 'super_admin' 
    : actualIsSuperAdmin;
  
  const isCorpAdmin = isSimulating
    ? (simulatedRole === 'super_admin' || simulatedRole === 'corp_admin')
    : actualIsCorpAdmin;

  const isCorpViewer = isSimulating
    ? simulatedRole === 'corp_viewer'
    : actualIsCorpViewer;
  
  const isAdmin = isSimulating 
    ? (simulatedRole === 'super_admin' || simulatedRole === 'admin' || simulatedRole === 'corp_admin')
    : actualIsAdmin;
  
  const isMagazine = isSimulating 
    ? simulatedRole === 'magazine' 
    : actualIsMagazine;
  
  const isProduction = isSimulating 
    ? simulatedRole === 'production' 
    : actualIsProduction;

  const isDispatch = isSimulating 
    ? simulatedRole === 'dispatch' 
    : actualIsDispatch;

  const isSales = isSimulating 
    ? simulatedRole === 'sales' 
    : actualIsSales;

  const isContractManager = isSimulating 
    ? simulatedRole === 'contract_manager' 
    : actualIsContractManager;

  const userRoles = isSimulating 
    ? [simulatedRole!] 
    : actualRoles;

  // Determine effective company context
  // Super admins: companyId comes ONLY from the switcher (viewingCompanyId)
  // Regular users: companyId comes from their profile
  const isViewingOtherCompany = actualIsSuperAdmin && viewingCompanyId !== null;
  const companyId = actualIsSuperAdmin ? viewingCompanyId : baseCompanyId;
  const corporationId = actualIsSuperAdmin 
    ? (viewingCompany?.corporation_id ?? null) 
    : baseCorporationId;
  const effectiveCompany = actualIsSuperAdmin ? viewingCompany : company;

  // Use subscription hook with the effective company
  const subscriptionData = useSubscription({ companyId, isSuperAdmin });
  
  // Fetch company data when super admin selects a company
  const fetchViewingCompany = useCallback(async (targetCompanyId: string) => {
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .eq("id", targetCompanyId)
      .single();
    
    if (!error && data) {
      // Also fetch logo from company_settings if not set in companies table
      let logoUrl = data.logo_url;
      if (!logoUrl) {
        const { data: logoSetting } = await supabase
          .from("company_settings")
          .select("setting_value")
          .eq("company_id", targetCompanyId)
          .eq("setting_key", "company_logo_url")
          .maybeSingle();
        
        if (logoSetting?.setting_value) {
          logoUrl = logoSetting.setting_value;
        }
      }
      
      setViewingCompany({ ...data, logo_url: logoUrl } as Company);
    } else {
      console.error("Failed to fetch viewing company:", error);
      setViewingCompany(null);
    }
  }, []);

  const setViewingCompanyId = useCallback((newCompanyId: string | null) => {
    if (!actualIsSuperAdmin) return; // Only super admins can switch
    
    setViewingCompanyIdState(newCompanyId);
    
    if (newCompanyId) {
      fetchViewingCompany(newCompanyId);
    } else {
      setViewingCompany(null);
    }
  }, [actualIsSuperAdmin, fetchViewingCompany]);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer profile fetch to avoid deadlock
        if (session?.user) {
          // Set profile loading BEFORE setTimeout so there's no gap
          setIsProfileLoading(true);
          setTimeout(() => {
            fetchProfileAndCompany(session.user.id);
            checkUserRoles(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setCompany(null);
          setCorporation(null);
          setActualRoles([]);
          setSimulatedRole(null);
          setIsProfileLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        setIsProfileLoading(true);
        fetchProfileAndCompany(session.user.id);
        checkUserRoles(session.user.id);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfileAndCompany = async (userId: string) => {
    // Note: isProfileLoading is set to true by the caller before this runs
    try {
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, email, full_name, ghl_user_id, company_id")
        .eq("id", userId)
        .single();

      if (!profileError && profileData) {
        setProfile(profileData as Profile);

        // Fetch company if profile has company_id
        if (profileData.company_id) {
          const { data: companyData, error: companyError } = await supabase
            .from("companies")
            .select("*")
            .eq("id", profileData.company_id)
            .single();

          if (!companyError && companyData) {
            // Also fetch logo from company_settings if not set in companies table
            let logoUrl = companyData.logo_url;
            if (!logoUrl) {
              const { data: logoSetting } = await supabase
                .from("company_settings")
                .select("setting_value")
                .eq("company_id", profileData.company_id)
                .eq("setting_key", "company_logo_url")
                .maybeSingle();
              
              if (logoSetting?.setting_value) {
                logoUrl = logoSetting.setting_value;
              }
            }
            
            setCompany({ ...companyData, logo_url: logoUrl } as Company);

            // Fetch corporation if company has corporation_id
            if (companyData.corporation_id) {
              const { data: corpData, error: corpError } = await supabase
                .from("corporations")
                .select("*")
                .eq("id", companyData.corporation_id)
                .single();

              if (!corpError && corpData) {
                setCorporation(corpData as Corporation);
              }
            }
          }
        }
      }
    } finally {
      setIsProfileLoading(false);
    }
  };

  const checkUserRoles = async (userId: string) => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (!error && data) {
      const roles = data.map(r => r.role as AppRole);
      setActualRoles(roles);
    } else {
      setActualRoles([]);
    }
  };

  const refreshCompanyContext = async () => {
    if (user?.id) {
      setIsProfileLoading(true);
      await fetchProfileAndCompany(user.id);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? new Error(error.message) : null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    return { error: error ? new Error(error.message) : null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setCompany(null);
    setCorporation(null);
    setActualRoles([]);
    setSimulatedRole(null);
  };

  const resetPassword = async (email: string) => {
    // IMPORTANT: Lovable preview URLs can be gated behind lovable.dev auth.
    // When sending password reset emails, always redirect to a public app URL.
    const hostname = window.location.hostname;
    const isLovablePreview =
      hostname.endsWith(".lovableproject.com") ||
      hostname.startsWith("id-preview--") ||
      hostname === "localhost";

    // If you change your primary public domain, update this fallback.
    const fallbackPublicUrl = "https://crm.ca-probuilders.com";
    const baseUrl = isLovablePreview ? fallbackPublicUrl : window.location.origin;

    const redirectUrl = `${baseUrl}/auth?mode=reset`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    return { error: error ? new Error(error.message) : null };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error ? new Error(error.message) : null };
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      profile,
      // Multi-tenancy context
      companyId,
      corporationId,
      company: effectiveCompany,
      corporation,
      // Super admin company switching
      viewingCompanyId,
      viewingCompany,
      setViewingCompanyId,
      isViewingOtherCompany,
      // Role checks
      isSuperAdmin,
      isCorpAdmin,
      isCorpViewer,
      isAdmin, 
      isMagazine,
      isProduction,
      isDispatch,
      isSales,
      isContractManager,
      userRoles,
      isLoading,
      isProfileLoading,
      isSubscriptionLoading: subscriptionData.isLoading,
      // Role simulation
      simulatedRole,
      isSimulating,
      setSimulatedRole: actualIsAdmin ? setSimulatedRole : () => {}, // Only admins can simulate
      availableRoles: ALL_ROLES,
      // Subscription context
      subscription: subscriptionData.subscription,
      plan: subscriptionData.plan,
      subscriptionFeatures: subscriptionData.features,
      canUseFeature: subscriptionData.canUseFeature,
      isSubscriptionActive: subscriptionData.isSubscriptionActive,
      isTrialing: subscriptionData.isTrialing,
      isPastDue: subscriptionData.isPastDue,
      daysUntilExpiration: subscriptionData.daysUntilExpiration,
      userCount: subscriptionData.userCount,
      userLimit: subscriptionData.userLimit,
      userLimitReached: subscriptionData.userLimitReached,
      refetchSubscription: subscriptionData.refetch,
      // Auth methods
      signIn, 
      signUp, 
      signOut,
      resetPassword,
      updatePassword,
      refreshCompanyContext
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
