import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = 'super_admin' | 'admin' | 'magazine' | 'production' | 'dispatch' | 'sales' | 'contract_manager' | 'corp_admin' | 'corp_viewer';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  ghl_user_id: string | null;
  company_id: string | null;
}

interface Company {
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
  // Role simulation for admins
  simulatedRole: AppRole | null;
  isSimulating: boolean;
  setSimulatedRole: (role: AppRole | null) => void;
  availableRoles: AppRole[];
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
  const [simulatedRole, setSimulatedRole] = useState<AppRole | null>(null);

  // Derive company and corporation IDs
  const companyId = profile?.company_id ?? null;
  const corporationId = company?.corporation_id ?? null;

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

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer profile fetch to avoid deadlock
        if (session?.user) {
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
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchProfileAndCompany(session.user.id);
        checkUserRoles(session.user.id);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfileAndCompany = async (userId: string) => {
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
          setCompany(companyData as Company);

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
      company,
      corporation,
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
      // Role simulation
      simulatedRole,
      isSimulating,
      setSimulatedRole: actualIsAdmin ? setSimulatedRole : () => {}, // Only admins can simulate
      availableRoles: ALL_ROLES,
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
