import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = 'super_admin' | 'admin' | 'magazine' | 'production' | 'dispatch' | 'sales';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  ghl_user_id: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  // Role checks
  isSuperAdmin: boolean;
  isAdmin: boolean; // true if super_admin OR admin
  isMagazine: boolean;
  isProduction: boolean;
  isDispatch: boolean;
  isSales: boolean;
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ALL_ROLES: AppRole[] = ['super_admin', 'admin', 'magazine', 'production', 'dispatch', 'sales'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [actualRoles, setActualRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [simulatedRole, setSimulatedRole] = useState<AppRole | null>(null);

  // Calculate actual role flags
  const actualIsSuperAdmin = actualRoles.includes('super_admin');
  const actualIsAdmin = actualRoles.includes('admin') || actualIsSuperAdmin;
  const actualIsMagazine = actualRoles.includes('magazine');
  const actualIsProduction = actualRoles.includes('production');
  const actualIsDispatch = actualRoles.includes('dispatch');
  const actualIsSales = actualRoles.includes('sales');

  // Calculate effective roles based on simulation
  const isSimulating = actualIsAdmin && simulatedRole !== null;
  
  const isSuperAdmin = isSimulating 
    ? simulatedRole === 'super_admin' 
    : actualIsSuperAdmin;
  
  const isAdmin = isSimulating 
    ? (simulatedRole === 'super_admin' || simulatedRole === 'admin')
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
            fetchProfile(session.user.id);
            checkUserRoles(session.user.id);
          }, 0);
        } else {
          setProfile(null);
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
        fetchProfile(session.user.id);
        checkUserRoles(session.user.id);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (!error && data) {
      setProfile(data as Profile);
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
      isSuperAdmin,
      isAdmin, 
      isMagazine,
      isProduction,
      isDispatch,
      isSales,
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
      updatePassword
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
