import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = 'admin' | 'user' | 'magazine_editor' | 'production';

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
  isAdmin: boolean;
  isMagazineEditor: boolean;
  isProduction: boolean;
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

const ALL_ROLES: AppRole[] = ['admin', 'user', 'magazine_editor', 'production'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [actualIsAdmin, setActualIsAdmin] = useState(false);
  const [actualIsMagazineEditor, setActualIsMagazineEditor] = useState(false);
  const [actualIsProduction, setActualIsProduction] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [simulatedRole, setSimulatedRole] = useState<AppRole | null>(null);

  // Calculate effective roles based on simulation
  const isSimulating = actualIsAdmin && simulatedRole !== null;
  
  const isAdmin = isSimulating 
    ? simulatedRole === 'admin' 
    : actualIsAdmin;
  
  const isMagazineEditor = isSimulating 
    ? simulatedRole === 'magazine_editor' 
    : actualIsMagazineEditor;
  
  const isProduction = isSimulating 
    ? simulatedRole === 'production' 
    : actualIsProduction;

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
          setActualIsAdmin(false);
          setActualIsMagazineEditor(false);
          setActualIsProduction(false);
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
      const roles = data.map(r => r.role);
      setActualIsAdmin(roles.includes("admin"));
      setActualIsMagazineEditor(roles.includes("magazine_editor"));
      setActualIsProduction(roles.includes("production"));
    } else {
      setActualIsAdmin(false);
      setActualIsMagazineEditor(false);
      setActualIsProduction(false);
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
    setActualIsAdmin(false);
    setActualIsMagazineEditor(false);
    setActualIsProduction(false);
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
      isAdmin, 
      isMagazineEditor,
      isProduction,
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
