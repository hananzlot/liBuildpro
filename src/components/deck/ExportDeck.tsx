import { useState, useCallback } from "react";
import { Download, Loader2 } from "lucide-react";
import html2canvas from "html2canvas";

export function ExportDeckButton() {
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const slideElements = document.querySelectorAll("[data-export-slide]");
      if (slideElements.length === 0) return;

      // Capture all slides as canvas images
      const canvases: HTMLCanvasElement[] = [];
      for (let i = 0; i < slideElements.length; i++) {
        const el = slideElements[i] as HTMLElement;
        const canvas = await html2canvas(el, {
          width: 1920,
          height: 1080,
          scale: 1,
          useCORS: true,
          allowTaint: true,
          backgroundColor: null,
        });
        canvases.push(canvas);
      }

      // Open a new window with all slides laid out for print
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        alert("Please allow popups to export the PDF.");
        return;
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Marketing Deck</title>
          <style>
            @page { size: landscape; margin: 0; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { background: white; }
            .slide-page {
              width: 100vw;
              height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              page-break-after: always;
              background: black;
            }
            .slide-page:last-child { page-break-after: avoid; }
            .slide-page img {
              width: 100%;
              height: 100%;
              object-fit: contain;
            }
          </style>
        </head>
        <body></body>
        </html>
      `);

      for (const canvas of canvases) {
        const div = printWindow.document.createElement("div");
        div.className = "slide-page";
        const img = printWindow.document.createElement("img");
        img.src = canvas.toDataURL("image/png");
        div.appendChild(img);
        printWindow.document.body.appendChild(div);
      }

      // Wait for images to load then trigger print
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  }, []);

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
      title="Export as PDF"
    >
      {exporting ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Exporting…
        </>
      ) : (
        <>
          <Download className="w-3.5 h-3.5" />
          Export PDF
        </>
      )}
    </button>
  );
}
