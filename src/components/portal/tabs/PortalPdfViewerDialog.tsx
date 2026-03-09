import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, ZoomIn, ZoomOut, RotateCw, X, ChevronLeft, ChevronRight, Loader2, AlertCircle } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist/build/pdf.mjs";
import pdfjsWorkerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerSrc;

interface PortalPdfViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileUrl: string;
  fileName?: string;
}

export function PortalPdfViewerDialog({ open, onOpenChange, fileUrl, fileName }: PortalPdfViewerDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageRendering, setPageRendering] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !fileUrl) return;
    let cancelled = false;
    setLoading(true);
    const loadPdf = async () => {
      try {
        const pdf = await pdfjsLib.getDocument({ url: fileUrl }).promise;
        if (cancelled) return;
        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
        setCurrentPage(1);
      } catch (err) {
        console.error("Failed to load PDF:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadPdf();
    return () => { cancelled = true; };
  }, [open, fileUrl]);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let cancelled = false;
    setPageRendering(true);
    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(currentPage);
        const viewport = page.getViewport({ scale: 1.5 * zoom });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        await page.render({ canvasContext: ctx, viewport }).promise;
      } catch (err) {
        console.error("Failed to render page:", err);
      } finally {
        if (!cancelled) setPageRendering(false);
      }
    };
    renderPage();
    return () => { cancelled = true; };
  }, [pdfDoc, currentPage, zoom]);

  useEffect(() => {
    if (!open) {
      setPdfDoc(null);
      setCurrentPage(1);
      setZoom(1);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0" hideCloseButton>
        <DialogHeader className="px-4 py-3 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-sm font-medium truncate flex-1 pr-4">
              {fileName || "Document"}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {totalPages > 1 && (
                <div className="flex items-center gap-1 border rounded-md p-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs w-16 text-center">{currentPage} / {totalPages}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <div className="flex items-center gap-1 border rounded-md p-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} disabled={zoom <= 0.5}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-xs w-12 text-center">{Math.round(zoom * 100)}%</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.min(2, z + 0.25))} disabled={zoom >= 2}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(1)}>
                  <RotateCw className="h-3 w-3" />
                </Button>
              </div>
              <Button variant="outline" size="sm" onClick={() => window.open(fileUrl, "_blank")}>
                <ExternalLink className="h-4 w-4 mr-1" />
                Open
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-auto bg-muted/30 flex justify-center p-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <canvas ref={canvasRef} className="shadow-md rounded bg-white max-w-full" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}