import { useState, useEffect, useRef, useCallback } from "react";
import * as fabric from "fabric";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, PenTool, Calendar, User, Mail, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import * as pdfjsLib from "pdfjs-dist";

// Set PDF.js worker - use unpkg with exact version match
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs`;

interface Signer {
  id: string;
  name: string;
  email: string;
  order: number;
  color: string;
}

interface SignatureField {
  id: string;
  signerId: string;
  signerName: string;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fieldType: "signature" | "date" | "name" | "email";
}

interface SignatureFieldEditorProps {
  documentUrl: string;
  signers: Signer[];
  onFieldsChange: (fields: SignatureField[]) => void;
  initialFields?: SignatureField[];
}

const FIELD_COLORS = [
  "#3b82f6", // blue
  "#10b981", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
];

const FIELD_TYPE_CONFIG = {
  signature: { label: "Signature", icon: PenTool, defaultWidth: 200, defaultHeight: 60 },
  date: { label: "Date Signed", icon: Calendar, defaultWidth: 150, defaultHeight: 30 },
  name: { label: "Full Name", icon: User, defaultWidth: 180, defaultHeight: 30 },
  email: { label: "Email", icon: Mail, defaultWidth: 200, defaultHeight: 30 },
};

// Extend Fabric objects to include custom data
interface FieldData {
  fieldId?: string;
  isLabel?: boolean;
}

export function SignatureFieldEditor({
  documentUrl,
  signers,
  onFieldsChange,
  initialFields = [],
}: SignatureFieldEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<fabric.Canvas | null>(null);
  const [fields, setFields] = useState<SignatureField[]>(initialFields);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [selectedSigner, setSelectedSigner] = useState<string>(signers[0]?.id || "");
  const [selectedFieldType, setSelectedFieldType] = useState<"signature" | "date" | "name" | "email">("signature");
  const [pageImages, setPageImages] = useState<Map<number, string>>(new Map());
  const fieldDataMap = useRef<Map<string, FieldData>>(new Map());

  // Load PDF
  useEffect(() => {
    const loadPdf = async () => {
      try {
        const pdf = await pdfjsLib.getDocument(documentUrl).promise;
        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
      } catch (error) {
        console.error("Error loading PDF:", error);
        toast.error("Failed to load PDF document");
      }
    };

    if (documentUrl) {
      loadPdf();
    }
  }, [documentUrl]);

  // Render PDF page to image
  useEffect(() => {
    const renderPage = async () => {
      if (!pdfDoc) return;

      // Check cache first
      if (pageImages.has(currentPage)) return;

      try {
        const page = await pdfDoc.getPage(currentPage);
        const scale = 1.5;
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
          canvasContext: context,
          viewport,
        }).promise;

        const imageUrl = canvas.toDataURL("image/png");
        setPageImages((prev) => new Map(prev).set(currentPage, imageUrl));
      } catch (error) {
        console.error("Error rendering page:", error);
      }
    };

    renderPage();
  }, [pdfDoc, currentPage, pageImages]);

  // Initialize Fabric canvas
  useEffect(() => {
    if (!canvasRef.current || !pageImages.has(currentPage)) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: 816,
      height: 1056,
      backgroundColor: "#ffffff",
      selection: true,
    });

    setFabricCanvas(canvas);

    return () => {
      canvas.dispose();
    };
  }, [currentPage, pageImages]);

  // Load background image and fields when canvas is ready
  useEffect(() => {
    if (!fabricCanvas || !pageImages.has(currentPage)) return;

    const loadBackground = async () => {
      try {
        const img = await fabric.FabricImage.fromURL(pageImages.get(currentPage)!);
        fabricCanvas.setDimensions({
          width: img.width || 816,
          height: img.height || 1056,
        });
        fabricCanvas.backgroundImage = img;
        fabricCanvas.requestRenderAll();
        loadFieldsOnCanvas();
      } catch (error) {
        console.error("Error loading background:", error);
      }
    };

    loadBackground();
  }, [fabricCanvas, pageImages, currentPage]);

  // Load fields onto canvas
  const loadFieldsOnCanvas = useCallback(() => {
    if (!fabricCanvas) return;

    // Clear existing objects
    fabricCanvas.getObjects().forEach((obj) => {
      fabricCanvas.remove(obj);
    });

    // Add fields for current page
    const pageFields = fields.filter((f) => f.pageNumber === currentPage);
    pageFields.forEach((field) => {
      const signer = signers.find((s) => s.id === field.signerId);
      const color = signer?.color || FIELD_COLORS[0];
      const config = FIELD_TYPE_CONFIG[field.fieldType];

      const rect = new fabric.Rect({
        left: field.x,
        top: field.y,
        width: field.width,
        height: field.height,
        fill: `${color}20`,
        stroke: color,
        strokeWidth: 2,
        rx: 4,
        ry: 4,
      });

      // Store field data in our map keyed by object
      const rectId = `rect-${field.id}`;
      fieldDataMap.current.set(rectId, { fieldId: field.id });
      (rect as any).__fieldId = field.id;

      const text = new fabric.FabricText(`${config.label}\n${field.signerName}`, {
        left: field.x + 5,
        top: field.y + 5,
        fontSize: 12,
        fill: color,
        fontFamily: "Arial",
        selectable: false,
        evented: false,
      });
      (text as any).__fieldId = field.id;
      (text as any).__isLabel = true;

      fabricCanvas.add(rect);
      fabricCanvas.add(text);
    });

    fabricCanvas.requestRenderAll();
  }, [fabricCanvas, fields, currentPage, signers]);

  // Handle object modification
  useEffect(() => {
    if (!fabricCanvas) return;

    const handleModified = (e: any) => {
      const obj = e.target;
      const fieldId = (obj as any)?.__fieldId;
      if (!fieldId) return;

      setFields((prev) =>
        prev.map((f) =>
          f.id === fieldId
            ? {
                ...f,
                x: obj.left || f.x,
                y: obj.top || f.y,
                width: (obj.width || f.width) * (obj.scaleX || 1),
                height: (obj.height || f.height) * (obj.scaleY || 1),
              }
            : f
        )
      );
    };

    fabricCanvas.on("object:modified", handleModified);

    return () => {
      fabricCanvas.off("object:modified", handleModified);
    };
  }, [fabricCanvas]);

  // Update parent when fields change
  useEffect(() => {
    onFieldsChange(fields);
  }, [fields, onFieldsChange]);

  // Reload canvas when fields change
  useEffect(() => {
    loadFieldsOnCanvas();
  }, [fields, loadFieldsOnCanvas]);

  const addField = () => {
    if (!selectedSigner) {
      toast.error("Please select a signer first");
      return;
    }

    const signer = signers.find((s) => s.id === selectedSigner);
    if (!signer) return;

    const config = FIELD_TYPE_CONFIG[selectedFieldType];
    const newField: SignatureField = {
      id: crypto.randomUUID(),
      signerId: selectedSigner,
      signerName: signer.name,
      pageNumber: currentPage,
      x: 100,
      y: 100,
      width: config.defaultWidth,
      height: config.defaultHeight,
      fieldType: selectedFieldType,
    };

    setFields((prev) => [...prev, newField]);
    toast.success(`Added ${config.label} field for ${signer.name}`);
  };

  const removeField = (fieldId: string) => {
    setFields((prev) => prev.filter((f) => f.id !== fieldId));
    toast.success("Field removed");
  };

  const deleteSelectedObject = () => {
    if (!fabricCanvas) return;

    const activeObj = fabricCanvas.getActiveObject();
    const fieldId = (activeObj as any)?.__fieldId;
    if (!fieldId) return;

    removeField(fieldId);
  };

  const currentPageFields = fields.filter((f) => f.pageNumber === currentPage);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* Sidebar */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Add Signature Field</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Signer</Label>
              <Select value={selectedSigner} onValueChange={setSelectedSigner}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select signer" />
                </SelectTrigger>
                <SelectContent>
                  {signers.map((signer) => (
                    <SelectItem key={signer.id} value={signer.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: signer.color }}
                        />
                        {signer.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Field Type</Label>
              <Select value={selectedFieldType} onValueChange={(v) => setSelectedFieldType(v as any)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FIELD_TYPE_CONFIG).map(([key, config]) => {
                    const Icon = config.icon;
                    return (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-3 w-3" />
                          {config.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={addField} className="w-full" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Field
            </Button>

            <Button
              onClick={deleteSelectedObject}
              variant="outline"
              className="w-full text-destructive hover:text-destructive"
              size="sm"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete Selected
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Fields on Page {currentPage}</CardTitle>
          </CardHeader>
          <CardContent>
            {currentPageFields.length === 0 ? (
              <p className="text-xs text-muted-foreground">No fields on this page</p>
            ) : (
              <div className="space-y-2">
                {currentPageFields.map((field) => {
                  const signer = signers.find((s) => s.id === field.signerId);
                  const config = FIELD_TYPE_CONFIG[field.fieldType];
                  const Icon = config.icon;
                  return (
                    <div
                      key={field.id}
                      className="flex items-center justify-between p-2 bg-muted/50 rounded text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: signer?.color }}
                        />
                        <Icon className="h-3 w-3" />
                        <span className="truncate max-w-[80px]">{field.signerName}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={() => removeField(field.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Signers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {signers.map((signer) => {
              const signerFieldCount = fields.filter((f) => f.signerId === signer.id).length;
              return (
                <div
                  key={signer.id}
                  className="flex items-center justify-between p-2 bg-muted/50 rounded text-xs"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: signer.color }}
                    />
                    <span>{signer.name}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {signerFieldCount} fields
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Canvas Area */}
      <div className="lg:col-span-3">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">
                Document Preview - Page {currentPage} of {totalPages}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm min-w-[60px] text-center">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div
              ref={containerRef}
              className="border rounded-lg overflow-auto bg-muted/30"
              style={{ maxHeight: "70vh" }}
            >
              {!pageImages.has(currentPage) ? (
                <div className="flex items-center justify-center h-96">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : (
                <canvas ref={canvasRef} />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Drag fields to position them. Resize by dragging corners.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
