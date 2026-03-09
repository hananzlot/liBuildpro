/**
 * Builds a proxy URL for a Supabase storage file.
 * This routes through our edge function to bypass ad blockers
 * that block direct supabase.co domain navigation.
 */
function getProxyUrl(originalUrl: string): string {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "mspujwrfhbobrxhofxzv";
  const encodedUrl = encodeURIComponent(originalUrl);
  return `https://${projectId}.supabase.co/functions/v1/file-proxy?url=${encodedUrl}`;
}

/**
 * Opens a file in a new browser tab using our proxy edge function.
 * This bypasses ad blockers that block supabase.co storage URLs.
 */
export function openFileInNewTab(url: string): void {
  if (url.includes("supabase.co/storage/")) {
    window.open(getProxyUrl(url), "_blank");
  } else {
    window.open(url, "_blank");
  }
}

/**
 * Downloads a file by fetching it as a blob and triggering
 * a programmatic download via an anchor tag.
 */
export async function downloadOrOpenBlob(url: string, fileName?: string): Promise<void> {
  try {
    // Use proxy URL for supabase storage files
    const fetchUrl = url.includes("supabase.co/storage/") ? getProxyUrl(url) : url;
    const res = await fetch(fetchUrl);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName || "document.pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  } catch {
    // Fallback: try proxy URL directly
    openFileInNewTab(url);
  }
}
