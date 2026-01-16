import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut,
  CheckCircle,
  XCircle,
  PenTool,
  Calendar,
  User,
  Mail,
  Type,
  Loader2,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { SignatureCanvas } from "@/components/portal/SignatureCanvas";
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

interface DocumentSigningViewProps {
  documentUrl: string;
  documentName: string;
  fields: SignatureField[];
  currentSignerId: string | null;
  signerName: string;
  signerEmail: string;
  onSignerNameChange: (name: string) => void;
  onSignerEmailChange: (email: string) => void;
  onSign: (signatureData: { type: "typed" | "drawn"; data: string; font?: string }, textFieldValues: Record<string, string>) => void;
  onDecline: () => void;
  isSubmitting: boolean;
}

const FIELD_TYPE_ICONS: Record<string, React.ElementType> = {
  signature: PenTool,
  date: Calendar,
  name: User,
  email: Mail,
  text: Type,
};

const FIELD_TYPE_LABELS: Record<string, string> = {
  signature: "Signature",
  date: "Date Signed",
  name: "Full Name",
  email: "Email Address",
  text: "Text Field",
};

export function DocumentSigningView({
  documentUrl,
  documentName,
  fields,
  currentSignerId,
  signerName,
  signerEmail,
  onSignerNameChange,
  onSignerEmailChange,
  onSign,
  onDecline,
  isSubmitting,
}: DocumentSigningViewProps) {
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
  
  // Field completion state
  const [textFieldValues, setTextFieldValues] = useState<Record<string, string>>({});
  const [signatureData, setSignatureData] = useState<{ type: "typed" | "drawn"; data: string; font?: string } | null>(null);
  const [activeFieldIndex, setActiveFieldIndex] = useState(0);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Filter fields for current signer and sort by page, then y position (top to bottom)
  const myFields = useMemo(() => {
    const filtered = fields.filter(f => f.signer_id === currentSignerId || !currentSignerId);
    return filtered.sort((a, b) => {
      if (a.page_number !== b.page_number) return a.page_number - b.page_number;
      return a.y_position - b.y_position;
    });
  }, [fields, currentSignerId]);

  const requiredFields = useMemo(() => myFields.filter(f => f.is_required), [myFields]);
  
  // Calculate completion progress
  const completedFields = useMemo(() => {
    let count = 0;
    myFields.forEach(field => {
      if (field.field_type === "signature" && signatureData) count++;
      else if (field.field_type === "name" && signerName) count++;
      else if (field.field_type === "email" && signerEmail) count++;
      else if (field.field_type === "date") count++; // Auto-filled
      else if (field.field_type === "text" && textFieldValues[field.id]) count++;
    });
    return count;
  }, [myFields, signatureData, signerName, signerEmail, textFieldValues]);

  const progress = myFields.length > 0 ? (completedFields / myFields.length) * 100 : 0;

  // Current active field
  const activeField = myFields[activeFieldIndex];

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

  // Navigate to field's page when active field changes
  useEffect(() => {
    if (activeField && activeField.page_number !== currentPage) {
      setCurrentPage(activeField.page_number);
    }
  }, [activeField, currentPage]);

  // Scroll to active field
  useEffect(() => {
    if (!activeField || !overlayRef.current || !pageViewport) return;

    const fieldElement = overlayRef.current.querySelector(`[data-field-id="${activeField.id}"]`);
    if (fieldElement) {
      fieldElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeField, pageViewport]);

  // Get field value for display
  const getFieldValue = useCallback((field: SignatureField): string | null => {
    switch (field.field_type) {
      case "signature":
        return signatureData ? "✓ Signed" : null;
      case "name":
        return signerName || null;
      case "email":
        return signerEmail || null;
      case "date":
        return format(new Date(), "MM/dd/yyyy");
      case "text":
        return textFieldValues[field.id] || null;
      default:
        return null;
    }
  }, [signatureData, signerName, signerEmail, textFieldValues]);

  // Check if field is complete
  const isFieldComplete = useCallback((field: SignatureField): boolean => {
    const value = getFieldValue(field);
    return value !== null && value !== "";
  }, [getFieldValue]);

  // Handle field click - navigate to it and show input
  const handleFieldClick = useCallback((fieldIndex: number) => {
    setActiveFieldIndex(fieldIndex);
    const field = myFields[fieldIndex];
    
    if (field.field_type === "signature") {
      setShowSignatureModal(true);
    }
  }, [myFields]);

  // Auto-advance to next incomplete field
  const advanceToNextField = useCallback(() => {
    const nextIncompleteIndex = myFields.findIndex((f, i) => i > activeFieldIndex && !isFieldComplete(f) && f.is_required);
    if (nextIncompleteIndex !== -1) {
      setActiveFieldIndex(nextIncompleteIndex);
      const nextField = myFields[nextIncompleteIndex];
      if (nextField.field_type === "signature") {
        setShowSignatureModal(true);
      }
    } else {
      // All done - find first incomplete if any
      const firstIncomplete = myFields.findIndex(f => !isFieldComplete(f) && f.is_required);
      if (firstIncomplete !== -1 && firstIncomplete !== activeFieldIndex) {
        setActiveFieldIndex(firstIncomplete);
      }
    }
  }, [myFields, activeFieldIndex, isFieldComplete]);

  // Handle input change and auto-advance
  const handleInputChange = useCallback((field: SignatureField, value: string) => {
    if (field.field_type === "name") {
      onSignerNameChange(value);
    } else if (field.field_type === "email") {
      onSignerEmailChange(value);
    } else if (field.field_type === "text") {
      setTextFieldValues(prev => ({ ...prev, [field.id]: value }));
    }
  }, [onSignerNameChange, onSignerEmailChange]);

  // Handle input blur - auto-advance
  const handleInputBlur = useCallback(() => {
    setTimeout(() => {
      advanceToNextField();
    }, 100);
  }, [advanceToNextField]);

  // Handle signature complete
  const handleSignatureComplete = useCallback((data: { type: "typed" | "drawn"; data: string; font?: string }) => {
    setSignatureData(data);
    setShowSignatureModal(false);
    advanceToNextField();
  }, [advanceToNextField]);

  // Validate and submit
  const handleSubmit = useCallback(() => {
    const errors: string[] = [];

    // Check required fields
    requiredFields.forEach(field => {
      if (!isFieldComplete(field)) {
        errors.push(`${FIELD_TYPE_LABELS[field.field_type] || field.field_label || "Field"} is required`);
      }
    });

    // Must have signature
    if (!signatureData) {
      errors.push("Signature is required");
    }

    // Must have name
    if (!signerName) {
      errors.push("Full Name is required");
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      // Navigate to first incomplete required field
      const firstIncomplete = myFields.findIndex(f => !isFieldComplete(f) && f.is_required);
      if (firstIncomplete !== -1) {
        setActiveFieldIndex(firstIncomplete);
        if (myFields[firstIncomplete].field_type === "signature") {
          setShowSignatureModal(true);
        }
      }
      toast.error("Please complete all required fields");
      return;
    }

    setValidationErrors([]);
    onSign(signatureData!, textFieldValues);
  }, [requiredFields, isFieldComplete, signatureData, signerName, myFields, onSign, textFieldValues]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab" && !e.shiftKey) {
        e.preventDefault();
        advanceToNextField();
      } else if (e.key === "Tab" && e.shiftKey) {
        e.preventDefault();
        const prevIndex = Math.max(0, activeFieldIndex - 1);
        setActiveFieldIndex(prevIndex);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeFieldIndex, advanceToNextField]);

  if (pdfError) {
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader className="text-center">
          <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <CardTitle>Error Loading Document</CardTitle>
          <CardDescription>{pdfError}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress Bar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              Signing Progress: {completedFields} of {myFields.length} fields
            </span>
            <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </CardContent>
      </Card>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Please complete required fields:</p>
                <ul className="list-disc list-inside text-sm text-destructive/80 mt-1">
                  {validationErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Document Viewer with Overlay */}
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
              
              {/* Field Overlay */}
              {pageViewport && (
                <div
                  ref={overlayRef}
                  className="absolute top-0 left-0"
                  style={{
                    width: pageViewport.width,
                    height: pageViewport.height,
                  }}
                >
                  {myFields
                    .filter(f => f.page_number === currentPage)
                    .map((field, idx) => {
                      const globalIdx = myFields.findIndex(f => f.id === field.id);
                      const isActive = globalIdx === activeFieldIndex;
                      const isComplete = isFieldComplete(field);
                      const Icon = FIELD_TYPE_ICONS[field.field_type] || Type;
                      const value = getFieldValue(field);

                      // Scale field position and size
                      const left = field.x_position * pageViewport.scale;
                      const top = field.y_position * pageViewport.scale;
                      const width = field.width * pageViewport.scale;
                      const height = field.height * pageViewport.scale;

                      return (
                        <div
                          key={field.id}
                          data-field-id={field.id}
                          className={`
                            absolute border-2 rounded cursor-pointer transition-all
                            ${isActive ? "border-primary ring-2 ring-primary/30 z-20" : "border-blue-400/70"}
                            ${isComplete ? "bg-green-50/80 border-green-500" : "bg-blue-50/80"}
                            hover:border-primary hover:z-10
                          `}
                          style={{
                            left,
                            top,
                            width,
                            height,
                            minWidth: 100,
                            minHeight: 30,
                          }}
                          onClick={() => handleFieldClick(globalIdx)}
                        >
                          <div className="absolute inset-0 p-1 flex flex-col">
                            {/* Field header */}
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Icon className="h-3 w-3" />
                              <span className="truncate">
                                {field.field_label || FIELD_TYPE_LABELS[field.field_type]}
                              </span>
                              {field.is_required && <span className="text-destructive">*</span>}
                              {isComplete && <CheckCircle className="h-3 w-3 text-green-600 ml-auto" />}
                            </div>

                            {/* Field value or input */}
                            {isActive && !isComplete && field.field_type !== "signature" && field.field_type !== "date" ? (
                              <Input
                                autoFocus
                                value={
                                  field.field_type === "name" ? signerName :
                                  field.field_type === "email" ? signerEmail :
                                  textFieldValues[field.id] || ""
                                }
                                onChange={(e) => handleInputChange(field, e.target.value)}
                                onBlur={handleInputBlur}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    advanceToNextField();
                                  }
                                }}
                                className="h-6 text-sm mt-1"
                                placeholder={`Enter ${FIELD_TYPE_LABELS[field.field_type].toLowerCase()}`}
                              />
                            ) : (
                              <div className="flex-1 flex items-center justify-center text-sm">
                                {value ? (
                                  field.field_type === "signature" && signatureData ? (
                                    signatureData.type === "drawn" ? (
                                      <img src={signatureData.data} alt="Signature" className="max-h-full max-w-full object-contain" />
                                    ) : (
                                      <span style={{ fontFamily: signatureData.font || "cursive" }} className="text-lg">
                                        {signatureData.data}
                                      </span>
                                    )
                                  ) : (
                                    <span className="text-gray-700">{value}</span>
                                  )
                                ) : (
                                  <span className="text-muted-foreground italic">
                                    {field.field_type === "signature" ? "Click to sign" : "Click to enter"}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Signature Modal */}
      {showSignatureModal && (
        <Card className="fixed inset-4 md:inset-auto md:fixed md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[500px] z-50 shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PenTool className="h-5 w-5" />
              Add Your Signature
            </CardTitle>
            <CardDescription>
              Draw or type your signature below
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Your Name</Label>
              <Input
                value={signerName}
                onChange={(e) => onSignerNameChange(e.target.value)}
                placeholder="Enter your full name"
              />
            </div>
            <SignatureCanvas
              onSignatureComplete={handleSignatureComplete}
              signerName={signerName}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowSignatureModal(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Backdrop for signature modal */}
      {showSignatureModal && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setShowSignatureModal(false)}
        />
      )}

      {/* Navigation and Action Buttons */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-3 justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                {activeField && (
                  <span>
                    Field {activeFieldIndex + 1} of {myFields.length}: <strong>{FIELD_TYPE_LABELS[activeField.field_type] || activeField.field_label}</strong>
                    {activeField.is_required && <Badge variant="outline" className="ml-2">Required</Badge>}
                  </span>
                )}
              </div>
              
              {/* Navigation Buttons */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveFieldIndex(Math.max(0, activeFieldIndex - 1))}
                  disabled={activeFieldIndex <= 0}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    const nextField = myFields[activeFieldIndex + 1];
                    if (nextField) {
                      setActiveFieldIndex(activeFieldIndex + 1);
                      if (nextField.field_type === "signature") {
                        setShowSignatureModal(true);
                      }
                    }
                  }}
                  disabled={activeFieldIndex >= myFields.length - 1}
                >
                  Next Field
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
            
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={onDecline}
                className="text-destructive hover:text-destructive"
              >
                <XCircle className="mr-2 h-4 w-4" />
                Decline
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="bg-green-600 hover:bg-green-700"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Complete & Sign
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
