import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, AlertCircle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Public route that fetches a file from any URL via JS fetch()
 * and renders it inline (PDF) or triggers download.
 * This bypasses ad blockers because navigation stays on our own domain.
 */
export default function ViewFile() {
  const [searchParams] = useSearchParams();
  const fileUrl = searchParams.get("url") || "";
  const fileName = searchParams.get("name") || "document.pdf";
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!fileUrl) {
      setError("No file URL provided");
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchFile = async () => {
      try {
        const res = await fetch(fileUrl);
        if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
        const blob = await res.blob();
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
      } catch (err: any) {
        if (!cancelled) setError(err.message || "Failed to load file");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchFile();
    return () => {
      cancelled = true;
    };
  }, [fileUrl]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  const handleDownload = () => {
    if (!blobUrl) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background gap-4">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-card">
        <span className="text-sm font-medium truncate">{fileName}</span>
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="h-4 w-4 mr-1" />
          Download
        </Button>
      </div>
      <div className="flex-1">
        {blobUrl && (
          <iframe
            src={blobUrl}
            className="w-full h-full border-0"
            title={fileName}
          />
        )}
      </div>
    </div>
  );
}
