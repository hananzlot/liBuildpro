/**
 * Downloads a file from a URL by fetching it as a blob and triggering
 * a programmatic download via an anchor tag. This bypasses ad blockers
 * that block window.open() and blob: URL navigation.
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
    // Revoke after a short delay to allow download to start
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  } catch {
    // Last resort fallback
    window.open(url, "_blank");
  }
}
