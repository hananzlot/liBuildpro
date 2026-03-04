import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, ZoomIn, ZoomOut, RotateCw, X, Shield, User, Mail, Clock, Globe, Monitor, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { format } from "date-fns";
import * as pdfjsLib from "pdfjs-dist/build/pdf.mjs";
import pdfjsWorkerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerSrc;

interface ComplianceDocData {
  id: string;
  document_name: string;
  file_url: string;
  signed_file_url: string | null;
  signature_data: string | null;
  signature_type: string | null;
  signature_font: string | null;
  signed_at: string | null;
  signer_name: string | null;
  signer_email: string | null;
  ip_address: string | null;
  user_agent: string | null;
  status: string;
}

interface ComplianceDocViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doc: ComplianceDocData;
}

export function ComplianceDocViewerDialog({ open, onOpenChange, doc }: ComplianceDocViewerDialogProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageRendering, setPageRendering] = useState(false);
  const [zoom, setZoom] = useState(1);

  const pdfUrl = doc.signed_file_url || doc.file_url;
  const isSigned = doc.status === "signed" && doc.signature_data;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const loadPdf = async () => {
      try {
        const pdf = await pdfjsLib.getDocument({ url: pdfUrl }).promise;
        if (cancelled) return;
        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
        setCurrentPage(1);
      } catch (err) {
        console.error("Error loading compliance PDF:", err);
      }
    };
    loadPdf();
    return () => { cancelled = true; };
  }, [pdfUrl, open]);

  useEffect(() => {
    const renderPage = async () => {
      if (!pdfDoc || !canvasRef.current) return;
      setPageRendering(true);
      try {
        const page = await pdfDoc.getPage(currentPage);
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        if (!context) return;
        const containerWidth = containerRef.current?.clientWidth || 800;
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = ((containerWidth - 40) / baseViewport.width) * zoom;
        const viewport = page.getViewport({ scale });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: context, viewport }).promise;
      } catch (err) {
        console.error("Error rendering page:", err);
      } finally {
        setPageRendering(false);
      }
    };
    renderPage();
  }, [pdfDoc, currentPage, zoom]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0" hideCloseButton>
        <DialogHeader className="px-4 py-3 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-sm font-medium truncate">{doc.document_name}</DialogTitle>
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
              <Button variant="outline" size="sm" onClick={() => window.open(pdfUrl, "_blank")}>
                <ExternalLink className="h-4 w-4 mr-1" /> Open
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto bg-muted/30">
          <div ref={containerRef} className="flex flex-col items-center p-4 gap-6">
            {/* PDF Canvas */}
            <div className="relative">
              {pageRendering && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
              <canvas ref={canvasRef} className="block shadow-sm rounded" />
            </div>

            {/* Signature Certificate */}
            {isSigned && (
              <div className="w-full max-w-2xl border rounded-lg bg-muted/30 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="h-5 w-5 text-green-600" />
                  <h3 className="font-semibold text-lg">Digital Signature Certificate</h3>
                  <Badge variant="outline" className="ml-auto bg-green-50 text-green-700 border-green-200">
                    Verified
                  </Badge>
                </div>

                <div className="bg-background rounded-lg p-4 border">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{doc.signer_name}</p>
                      <p className="text-sm text-muted-foreground">Signer</p>
                    </div>
                  </div>

                  {/* Signature Preview */}
                  <div className="my-3 p-3 bg-muted/50 rounded border flex items-center justify-center min-h-[60px]">
                    {doc.signature_type === "drawn" ? (
                      <img
                        src={doc.signature_data!}
                        alt={`Signature by ${doc.signer_name}`}
                        className="max-h-16 max-w-full object-contain"
                      />
                    ) : (
                      <span
                        style={{ fontFamily: doc.signature_font || "cursive" }}
                        className="text-2xl text-foreground"
                      >
                        {doc.signature_data}
                      </span>
                    )}
                  </div>

                  <Separator className="my-3" />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    {doc.signer_email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Email:</span>
                        <span className="font-medium">{doc.signer_email}</span>
                      </div>
                    )}
                    {doc.signed_at && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Signed:</span>
                        <span className="font-medium">
                          {format(new Date(doc.signed_at), "MMM d, yyyy 'at' h:mm:ss a")}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Signature Type:</span>
                      <span className="font-medium capitalize">
                        {doc.signature_type === "drawn" ? "Hand-drawn" : "Typed"}
                      </span>
                    </div>
                    {doc.ip_address && (
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">IP Address:</span>
                        <span className="font-medium font-mono text-xs">{doc.ip_address}</span>
                      </div>
                    )}
                  </div>

                  {doc.user_agent && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-start gap-2 text-sm">
                        <Monitor className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <span className="text-muted-foreground">Device:</span>
                          <p className="font-medium text-xs font-mono break-all mt-1 text-muted-foreground">
                            {doc.user_agent.length > 100 ? doc.user_agent.substring(0, 100) + "..." : doc.user_agent}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <p className="text-xs text-muted-foreground mt-4 text-center">
                  This document was electronically signed using a secure digital signature platform.
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
