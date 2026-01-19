import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2, Shield, User, Mail, Clock, Globe, Monitor } from "lucide-react";
import { format } from "date-fns";
import * as pdfjsLib from "pdfjs-dist/build/pdf.mjs";
import pdfjsWorkerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerSrc;

interface SignatureField {
  id: string;
  page_number: number;
  x_position: number;
  y_position: number;
  width: number;
  height: number;
  field_type: string;
  signer_id: string | null;
  is_required: boolean;
  field_label: string | null;
}

interface DocumentSignature {
  id: string;
  signer_id: string | null;
  signer_name: string;
  signer_email: string | null;
  signature_type: string;
  signature_data: string;
  signature_font: string | null;
  signed_at: string;
  ip_address?: string | null;
  user_agent?: string | null;
  field_values?: Record<string, string>;
}

interface SignedDocumentViewProps {
  documentUrl: string;
  documentName: string;
  fields: SignatureField[];
  signatures: DocumentSignature[];
}

export function SignedDocumentView({
  documentUrl,
  documentName,
  fields,
  signatures,
}: SignedDocumentViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageRendering, setPageRendering] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pageViewport, setPageViewport] = useState<{ width: number; height: number; scale: number } | null>(null);

  // Map signatures by signer_id for quick lookup
  const signatureMap = new Map<string | null, DocumentSignature>();
  signatures.forEach(sig => {
    signatureMap.set(sig.signer_id, sig);
  });

  // Load PDF
  useEffect(() => {
    let cancelled = false;

    const loadPdf = async () => {
      try {
        setPdfError(null);
        const task = pdfjsLib.getDocument({ url: documentUrl });
        const pdf = await task.promise;

        if (cancelled) return;

        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
      } catch (error) {
        console.error("Error loading PDF:", error);
        if (!cancelled) {
          setPdfError(error instanceof Error ? error.message : "Failed to load PDF");
        }
      }
    };

    if (documentUrl) {
      loadPdf();
    }

    return () => {
      cancelled = true;
    };
  }, [documentUrl]);

  // Render PDF page
  useEffect(() => {
    const renderPage = async () => {
      if (!pdfDoc || !canvasRef.current) return;

      setPageRendering(true);

      try {
        const page = await pdfDoc.getPage(currentPage);
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        if (!context) return;

        // Calculate scale to fit container width
        const containerWidth = containerRef.current?.clientWidth || 800;
        const baseViewport = page.getViewport({ scale: 1 });
        const baseScale = (containerWidth - 40) / baseViewport.width;
        const scale = baseScale * zoom;
        
        const viewport = page.getViewport({ scale });

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
          canvasContext: context,
          viewport,
        }).promise;

        setPageViewport({
          width: viewport.width,
          height: viewport.height,
          scale,
        });
      } catch (error) {
        console.error("Error rendering page:", error);
      } finally {
        setPageRendering(false);
      }
    };

    renderPage();
  }, [pdfDoc, currentPage, zoom]);

  // Get the rendered content for a field
  const getFieldContent = (field: SignatureField) => {
    const signature = signatureMap.get(field.signer_id);
    const fieldValues = signature?.field_values || {};
    
    switch (field.field_type) {
      case "signature":
        if (signature) {
          if (signature.signature_type === "drawn") {
            return (
              <img 
                src={signature.signature_data} 
                alt={`Signature by ${signature.signer_name}`} 
                className="max-h-full max-w-full object-contain"
              />
            );
          } else {
            return (
              <span 
                style={{ fontFamily: signature.signature_font || "cursive" }} 
                className="text-lg text-gray-800"
              >
                {signature.signature_data}
              </span>
            );
          }
        }
        return null;
      
      case "initials":
        if (signature) {
          // Use the separate initials data from field_values
          const initialsType = fieldValues._initialsType || 'typed';
          const initialsData = fieldValues._initialsData || '';
          const initialsFont = fieldValues._initialsFont;
          
          if (initialsType === "drawn" && initialsData && typeof initialsData === 'string' && initialsData.startsWith('data:image')) {
            return (
              <img 
                src={initialsData} 
                alt={`Initials by ${signature.signer_name}`} 
                className="max-h-full max-w-full object-contain"
              />
            );
          } else {
            // Extract first letters from each word for typed initials
            const displayText = (initialsData || signature.signer_name || '')
              .split(' ')
              .filter((w: string) => w.length > 0)
              .map((w: string) => w[0])
              .join('')
              .toUpperCase();
            return (
              <span 
                style={{ fontFamily: initialsFont || signature.signature_font || "cursive" }} 
                className="text-lg text-gray-800"
              >
                {displayText}
              </span>
            );
          }
        }
        return null;
      
      case "date":
        if (signature?.signed_at) {
          return (
            <span className="text-sm text-gray-700">
              {format(new Date(signature.signed_at), "MM/dd/yyyy")}
            </span>
          );
        }
        return null;
      
      case "name":
        // Use the stored signer name
        if (signature) {
          return (
            <span className="text-sm text-gray-700">{signature.signer_name}</span>
          );
        }
        return null;
      
      case "email":
        // Use the stored signer email
        if (signature?.signer_email) {
          return (
            <span className="text-sm text-gray-700">{signature.signer_email}</span>
          );
        }
        return null;
      
      case "text":
        // Use the field_values for text fields
        const textValue = fieldValues[field.id];
        if (textValue) {
          return (
            <span className="text-sm text-gray-700">{textValue}</span>
          );
        }
        return null;
      
      default:
        return null;
    }
  };

  if (pdfError) {
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="text-destructive">Error Loading Document</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground">{pdfError}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{documentName}</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
              disabled={zoom <= 0.5}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm w-16 text-center">{Math.round(zoom * 100)}%</span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setZoom(z => Math.min(2, z + 0.25))}
              disabled={zoom >= 2}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div
          ref={containerRef}
          className="relative overflow-auto border rounded-lg bg-gray-100"
          style={{ maxHeight: "70vh" }}
        >
          {pageRendering && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          
          <div className="relative inline-block">
            <canvas ref={canvasRef} className="block" />
            
            {/* Signature Overlays */}
            {pageViewport && (
              <div
                ref={overlayRef}
                className="absolute top-0 left-0 pointer-events-none"
                style={{
                  width: pageViewport.width,
                  height: pageViewport.height,
                }}
              >
                {fields
                  .filter(f => f.page_number === currentPage)
                  .map((field) => {
                    const content = getFieldContent(field);
                    if (!content) return null;

                    // Scale field position and size
                    // Fields are stored in PDF coordinates (scale 1)
                    const left = field.x_position * pageViewport.scale;
                    const top = field.y_position * pageViewport.scale;
                    const width = field.width * pageViewport.scale;
                    const height = field.height * pageViewport.scale;

                    return (
                      <div
                        key={field.id}
                        className="absolute flex items-center justify-center"
                        style={{
                          left,
                          top,
                          width,
                          height,
                        }}
                      >
                        {content}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>

        {/* Digital Signature Certificate */}
        {signatures.length > 0 && (
          <div className="mt-6 border rounded-lg bg-muted/30 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-5 w-5 text-green-600" />
              <h3 className="font-semibold text-lg">Digital Signature Certificate</h3>
              <Badge variant="outline" className="ml-auto bg-green-50 text-green-700 border-green-200">
                Verified
              </Badge>
            </div>
            
            <div className="space-y-4">
              {signatures.map((sig, index) => (
                <div key={sig.id} className="bg-background rounded-lg p-4 border">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{sig.signer_name}</p>
                      <p className="text-sm text-muted-foreground">Signer {index + 1}</p>
                    </div>
                  </div>
                  
                  <Separator className="my-3" />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    {sig.signer_email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Email:</span>
                        <span className="font-medium">{sig.signer_email}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Signed:</span>
                      <span className="font-medium">
                        {format(new Date(sig.signed_at), "MMM d, yyyy 'at' h:mm:ss a")}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Signature Type:</span>
                      <span className="font-medium capitalize">
                        {sig.signature_type === "drawn" ? "Hand-drawn" : "Typed"}
                      </span>
                    </div>
                    
                    {sig.ip_address && (
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">IP Address:</span>
                        <span className="font-medium font-mono text-xs">{sig.ip_address}</span>
                      </div>
                    )}
                  </div>
                  
                  {sig.user_agent && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-start gap-2 text-sm">
                        <Monitor className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <span className="text-muted-foreground">Device:</span>
                          <p className="font-medium text-xs font-mono break-all mt-1 text-muted-foreground">
                            {sig.user_agent.length > 100 
                              ? sig.user_agent.substring(0, 100) + "..." 
                              : sig.user_agent}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <p className="text-xs text-muted-foreground mt-4 text-center">
              This document was electronically signed using a secure digital signature platform.
              The signatures are legally binding and comply with electronic signature laws.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
