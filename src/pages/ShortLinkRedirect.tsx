import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

export default function ShortLinkRedirect() {
  const { code } = useParams<{ code: string }>();

  useEffect(() => {
    if (!code) return;

    // Navigate directly to the edge function - it will handle the 302 redirect
    window.location.href = `https://mspujwrfhbobrxhofxzv.supabase.co/functions/v1/resolve-short-link/${code}`;
  }, [code]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        <p className="text-muted-foreground">Redirecting...</p>
      </div>
    </div>
  );
}
