import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

export default function ShortLinkRedirect() {
  const { code } = useParams<{ code: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) {
      setError("Invalid short link");
      return;
    }

    // Call the edge function to resolve and get redirect URL
    const resolveLink = async () => {
      try {
        const response = await fetch(
          `https://mspujwrfhbobrxhofxzv.supabase.co/functions/v1/resolve-short-link/${code}`,
          {
            method: "GET",
            redirect: "manual", // Don't follow redirects automatically
          }
        );

        if (response.status === 302) {
          // Get the Location header and redirect
          const location = response.headers.get("Location");
          if (location) {
            window.location.href = location;
            return;
          }
        }

        // Handle error responses
        if (response.status === 404) {
          setError("Link not found");
        } else if (response.status === 410) {
          const text = await response.text();
          setError(text || "This link is no longer available");
        } else {
          setError("Failed to resolve link");
        }
      } catch (err) {
        console.error("Error resolving short link:", err);
        setError("Failed to resolve link");
      }
    };

    resolveLink();
  }, [code]);

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <h1 className="text-2xl font-bold text-destructive">Link Error</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        <p className="text-muted-foreground">Redirecting...</p>
      </div>
    </div>
  );
}
