import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Mail, Lock, User, ArrowLeft } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const loginSchema = z.object({
  email: z.string().trim().email({ message: "Invalid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

const signupSchema = loginSchema.extend({
  fullName: z.string().trim().min(2, { message: "Name must be at least 2 characters" }),
});

const forgotSchema = z.object({
  email: z.string().trim().email({ message: "Invalid email address" }),
});

const resetSchema = z.object({
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
  confirmPassword: z.string().min(6, { message: "Password must be at least 6 characters" }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type AuthMode = "login" | "signup" | "forgot" | "reset";

export default function Auth() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; fullName?: string; confirmPassword?: string }>({});
  const [processingOAuth, setProcessingOAuth] = useState(false);

  const { signIn, signUp, resetPassword, updatePassword, user, isLoading, isSuperAdmin, setViewingCompanyId } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const oauthProcessedRef = useRef(false);

  // Check for reset mode from URL (when user clicks email link)
  useEffect(() => {
    const urlMode = searchParams.get("mode");
    if (urlMode === "reset") {
      setMode("reset");
    }
  }, [searchParams]);

  // Listen for PASSWORD_RECOVERY event from Supabase
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("reset");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Handle QuickBooks OAuth callback that landed on /auth due to ProtectedRoute redirect
  // This happens when the OAuth redirect comes back while the session is being restored
  useEffect(() => {
    const handleQuickBooksCallback = async () => {
      const code = searchParams.get("code");
      const realmId = searchParams.get("realmId");
      const state = searchParams.get("state");

      // Prevent double-submitting a single-use Intuit authorization code.
      // This can happen with strict-mode remounts or fast route redirects.
      const processedKey = code ? `qb_oauth_processed:${code}` : null;
      if (processedKey && sessionStorage.getItem(processedKey)) {
        return;
      }

      // Only process if we have QuickBooks OAuth params and haven't processed yet
      if (!code || !realmId || !state || oauthProcessedRef.current) {
        return;
      }

      // Wait for user to be available (session restored)
      if (isLoading || !user) {
        return;
      }

      oauthProcessedRef.current = true;
      setProcessingOAuth(true);
      if (processedKey) sessionStorage.setItem(processedKey, "1");

      try {
        // Parse state to get company ID
        const { companyId } = JSON.parse(atob(state));
        
        if (!companyId) {
          toast.error("Invalid OAuth state - missing company ID");
          navigate("/admin/settings", { replace: true });
          return;
        }

        console.log("Processing QuickBooks OAuth callback from /auth for company:", companyId);

        // Restore super admin company context
        if (isSuperAdmin && companyId) {
          setViewingCompanyId(companyId);
        }

        const { data, error } = await supabase.functions.invoke("quickbooks-auth", {
          body: {
            action: "exchange-code",
            code,
            realmId,
            companyId,
            redirectUri: `${window.location.origin}/admin/settings`,
          },
        });

        if (error || data?.error) {
          console.error("QuickBooks token exchange failed:", error || data?.error);
          toast.error(data?.error || "Failed to connect QuickBooks");
        } else {
          console.log("QuickBooks connected successfully!");
          toast.success("QuickBooks connected successfully!");
          queryClient.invalidateQueries({ queryKey: ["quickbooks-connection"] });
        }
      } catch (err) {
        console.error("OAuth callback error:", err);
        toast.error("Failed to process QuickBooks authorization");
      } finally {
        // Redirect to admin settings after processing
        navigate("/admin/settings?tab=integrations", { replace: true });
      }
    };

    handleQuickBooksCallback();
  }, [searchParams, user, isLoading, isSuperAdmin, setViewingCompanyId, queryClient, navigate]);

  useEffect(() => {
    // Don't redirect if we're processing OAuth callback
    if (processingOAuth) return;
    
    // Check if there are QuickBooks OAuth params - wait for those to be processed
    const hasOAuthParams = searchParams.get("code") && searchParams.get("realmId") && searchParams.get("state");
    if (hasOAuthParams) return;
    
    // Only redirect if user is logged in AND not in reset mode
    if (!isLoading && user && mode !== "reset") {
      navigate("/", { replace: true });
    }
  }, [user, isLoading, navigate, mode, processingOAuth, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate based on mode
    let result;
    if (mode === "login") {
      result = loginSchema.safeParse({ email, password });
    } else if (mode === "signup") {
      result = signupSchema.safeParse({ email, password, fullName });
    } else if (mode === "forgot") {
      result = forgotSchema.safeParse({ email });
    } else {
      result = resetSchema.safeParse({ password, confirmPassword });
    }

    if (!result.success) {
      const fieldErrors: typeof errors = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as keyof typeof fieldErrors;
        fieldErrors[field] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === "login") {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            toast.error("Invalid email or password");
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success("Welcome back!");
        }
      } else if (mode === "signup") {
        const { error } = await signUp(email, password, fullName);
        if (error) {
          if (error.message.includes("already registered")) {
            toast.error("This email is already registered. Please sign in.");
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success("Account created! Check your email to confirm.");
        }
      } else if (mode === "forgot") {
        const { error } = await resetPassword(email);
        if (error) {
          toast.error(error.message);
        } else {
          setResetEmailSent(true);
          toast.success("Password reset link sent to your email!");
        }
      } else if (mode === "reset") {
        const { error } = await updatePassword(password);
        if (error) {
          toast.error(error.message);
        } else {
          toast.success("Password updated successfully!");
          navigate("/", { replace: true });
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setErrors({});
    setResetEmailSent(false);
    setPassword("");
    setConfirmPassword("");
  };

  // Show loading state during auth loading or OAuth processing
  if (isLoading || processingOAuth) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        {processingOAuth && (
          <p className="text-sm text-muted-foreground">Connecting to QuickBooks...</p>
        )}
      </div>
    );
  }

  const getTitle = () => {
    switch (mode) {
      case "login": return "Welcome Back";
      case "signup": return "Create Account";
      case "forgot": return "Reset Password";
      case "reset": return "Set New Password";
    }
  };

  const getDescription = () => {
    switch (mode) {
      case "login": return "Sign in to access the dashboard";
      case "signup": return "Sign up to get started";
      case "forgot": return "Enter your email to receive a reset link";
      case "reset": return "Enter your new password below";
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{getTitle()}</CardTitle>
          <CardDescription>{getDescription()}</CardDescription>
        </CardHeader>

        {mode === "forgot" && resetEmailSent ? (
          <CardContent className="space-y-4">
            <div className="text-center py-4">
              <Mail className="h-12 w-12 mx-auto text-primary mb-4" />
              <p className="text-muted-foreground">
                Check your email for a password reset link. It may take a few minutes to arrive.
              </p>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => switchMode("login")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Sign In
            </Button>
          </CardContent>
        ) : (
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {mode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="fullName"
                      placeholder="John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className={`pl-10 ${errors.fullName ? "border-destructive" : ""}`}
                      disabled={isSubmitting}
                    />
                  </div>
                  {errors.fullName && (
                    <p className="text-xs text-destructive">{errors.fullName}</p>
                  )}
                </div>
              )}

              {(mode === "login" || mode === "signup" || mode === "forgot") && (
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`pl-10 ${errors.email ? "border-destructive" : ""}`}
                      disabled={isSubmitting}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-xs text-destructive">{errors.email}</p>
                  )}
                </div>
              )}

              {(mode === "login" || mode === "signup" || mode === "reset") && (
                <div className="space-y-2">
                  <Label htmlFor="password">
                    {mode === "reset" ? "New Password" : "Password"}
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`pl-10 ${errors.password ? "border-destructive" : ""}`}
                      disabled={isSubmitting}
                    />
                  </div>
                  {errors.password && (
                    <p className="text-xs text-destructive">{errors.password}</p>
                  )}
                </div>
              )}

              {mode === "reset" && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`pl-10 ${errors.confirmPassword ? "border-destructive" : ""}`}
                      disabled={isSubmitting}
                    />
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-xs text-destructive">{errors.confirmPassword}</p>
                  )}
                </div>
              )}
            </CardContent>

            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "login" && "Sign In"}
                {mode === "signup" && "Create Account"}
                {mode === "forgot" && "Send Reset Link"}
                {mode === "reset" && "Update Password"}
              </Button>

              {mode === "login" && (
                <>
                  <button
                    type="button"
                    className="text-sm text-muted-foreground hover:text-primary"
                    onClick={() => switchMode("forgot")}
                  >
                    Forgot your password?
                  </button>
                  <p className="text-sm text-muted-foreground text-center">
                    Don't have an account?{" "}
                    <button
                      type="button"
                      className="text-primary hover:underline font-medium"
                      onClick={() => switchMode("signup")}
                    >
                      Sign up
                    </button>
                  </p>
                </>
              )}

              {mode === "signup" && (
                <p className="text-sm text-muted-foreground text-center">
                  Already have an account?{" "}
                  <button
                    type="button"
                    className="text-primary hover:underline font-medium"
                    onClick={() => switchMode("login")}
                  >
                    Sign in
                  </button>
                </p>
              )}

              {mode === "forgot" && (
                <p className="text-sm text-muted-foreground text-center">
                  Remember your password?{" "}
                  <button
                    type="button"
                    className="text-primary hover:underline font-medium"
                    onClick={() => switchMode("login")}
                  >
                    Sign in
                  </button>
                </p>
              )}
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
