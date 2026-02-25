import { useState, useCallback } from "react";
import { Download, Loader2 } from "lucide-react";
import html2canvas from "html2canvas";
import PptxGenJS from "pptxgenjs";

interface ExportDeckProps {
  slides: React.ReactElement[];
}

export function ExportDeckButton({ slides }: ExportDeckProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const pptx = new PptxGenJS();
      pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 inches (16:9)

      // Create a hidden container to render each slide at full resolution
      const container = document.createElement("div");
      container.style.cssText =
        "position:fixed;left:-9999px;top:0;width:1920px;height:1080px;overflow:hidden;z-index:-1;";
      document.body.appendChild(container);

      // We need to render each slide into the container and capture it
      // Use the existing slide elements that are already in the DOM
      const slideElements = document.querySelectorAll("[data-export-slide]");

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

        const imgData = canvas.toDataURL("image/png");
        const slide = pptx.addSlide();
        slide.addImage({
          data: imgData,
          x: 0,
          y: 0,
          w: "100%",
          h: "100%",
        });
      }

      document.body.removeChild(container);
      await pptx.writeFile({ fileName: "Marketing-Deck.pptx" });
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
      title="Download as PowerPoint"
    >
      {exporting ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Exporting…
        </>
      ) : (
        <>
          <Download className="w-3.5 h-3.5" />
          Export .pptx
        </>
      )}
    </button>
  );
}
