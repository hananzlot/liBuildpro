/**
 * Opens a file in a new browser tab using an in-app route.
 * The /view-file route fetches the PDF via JS fetch() and renders it inline,
 * keeping navigation on the app's own domain to bypass ad blockers
 * that block supabase.co.
 */
export function openFileInNewTab(url: string, fileName?: string): void {
  const params = new URLSearchParams({ url });
  if (fileName) params.set("name", fileName);
  window.open(`/view-file?${params.toString()}`, "_blank");
}

/**
 * Downloads a file by fetching it as a blob and triggering
 * a programmatic download via an anchor tag.
 */
export async function downloadOrOpenBlob(url: string, fileName?: string): Promise<void> {
  try {
    const res = await fetch(url);
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
    // Fallback to in-app viewer
    openFileInNewTab(url, fileName);
  }
}
