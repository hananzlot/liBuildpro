import { useState, useEffect, useRef, useCallback } from "react";
import * as fabric from "fabric";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, PenTool, Calendar, User, Mail, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize, Type, Asterisk, FileStack } from "lucide-react";
import { SignatureTemplateDialog } from "./SignatureTemplateDialog";
import { toast } from "sonner";
import * as pdfjsLib from "pdfjs-dist/build/pdf.mjs";
import pdfjsWorkerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// Force PDF.js to load its worker from our own origin (avoids CSP/CDN issues)
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerSrc;

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
  fieldType: "signature" | "date" | "name" | "email" | "text";
  isRequired: boolean;
  fieldLabel?: string;
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
  text: { label: "Text Field", icon: Type, defaultWidth: 200, defaultHeight: 30 },
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
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const [fields, setFields] = useState<SignatureField[]>(initialFields);
  const fieldsRef = useRef<SignatureField[]>(initialFields);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [selectedSigner, setSelectedSigner] = useState<string>(signers[0]?.id || "");
  const [selectedFieldType, setSelectedFieldType] = useState<"signature" | "date" | "name" | "email" | "text">("signature");
  const [fieldIsRequired, setFieldIsRequired] = useState(true);
  const [textFieldLabel, setTextFieldLabel] = useState("");
  const [pageImages, setPageImages] = useState<Map<number, string>>(new Map());
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const fieldDataMap = useRef<Map<string, FieldData>>(new Map());
  const isMountedRef = useRef(true);
  const initialZoomRef = useRef<number>(1); // Stores the initial fit zoom level
  const initialVptRef = useRef<fabric.TMat2D | null>(null); // Stores the initial fit viewportTransform
  
  // Drag-to-pan refs
  const isPanningRef = useRef(false);
  const lastPanPointRef = useRef<{ x: number; y: number } | null>(null);
  
  // Ref to hold the addField function for native event listeners
  const addFieldRef = useRef<(dropX?: number, dropY?: number, fieldType?: keyof typeof FIELD_TYPE_CONFIG) => void>(() => {});

  // Track mount state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Load PDF
  useEffect(() => {
    let cancelled = false;

    const loadPdf = async () => {
      try {
        setPdfError(null);
        setPdfDoc(null);
        setPageImages(new Map());
        setCurrentPage(1);
        setTotalPages(1);

        const task = pdfjsLib.getDocument({ url: documentUrl });
        const pdf = await task.promise;

        if (cancelled) return;

        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
      } catch (error) {
        console.error("Error loading PDF:", error);
        if (!cancelled) {
          setPdfError(error instanceof Error ? error.message : "Unknown PDF load error");
        }
        toast.error("Failed to load PDF document");
      }
    };

    if (documentUrl) {
      loadPdf();
    }

    return () => {
      cancelled = true;
    };
  }, [documentUrl, reloadToken]);

  // Render PDF page to image at high resolution (scale: 2 for quality)
  useEffect(() => {
    const renderPage = async () => {
      if (!pdfDoc) return;

      // Check cache first
      if (pageImages.has(currentPage)) return;

      try {
        const page = await pdfDoc.getPage(currentPage);
        // Render at scale 2 for high quality (keeps real proportions)
        const viewport = page.getViewport({ scale: 2 });

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

  // Reset scroll position helper - double RAF to ensure DOM is fully updated
  const resetScrollPosition = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = 0;
          containerRef.current.scrollLeft = 0;
        }
      });
    });
  }, []);

  // Apply zoom helper - uses Fabric's native zoom
  const applyZoom = useCallback((nextZoom: number) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const clamped = Math.max(0.3, Math.min(nextZoom, 4)); // 30%–400%

    // Get canvas center for zoom target
    const center = new fabric.Point(canvas.getWidth() / 2, canvas.getHeight() / 2);
    canvas.zoomToPoint(center, clamped);
    canvas.requestRenderAll();

    setZoom(clamped);
  }, []);

  // Fit to container helper - restore the initial fitted viewport
  const fitToContainer = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const vpt = initialVptRef.current;
    if (vpt) {
      canvas.setViewportTransform(vpt);
      setZoom(vpt[0] ?? 1);
    } else {
      canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
      setZoom(1);
    }

    canvas.requestRenderAll();
    resetScrollPosition();
  }, [resetScrollPosition]);


  // Initialize Fabric canvas once - imperatively create canvas element
  useEffect(() => {
    if (!canvasWrapperRef.current || !containerRef.current) return;
    
    // Clear any previous content
    canvasWrapperRef.current.innerHTML = '';
    
    // Get container dimensions for initial canvas size
    const containerWidth = containerRef.current.clientWidth - 20;
    const containerHeight = containerRef.current.clientHeight - 20;
    const initialWidth = Math.max(containerWidth, 400);
    const initialHeight = Math.max(containerHeight, 300);
    
    // Create canvas element imperatively (Fabric will wrap it)
    const canvasEl = document.createElement('canvas');
    canvasEl.width = initialWidth;
    canvasEl.height = initialHeight;
    canvasWrapperRef.current.appendChild(canvasEl);

    const canvas = new fabric.Canvas(canvasEl, {
      width: initialWidth,
      height: initialHeight,
      backgroundColor: "#ffffff",
      selection: true,
    });

    fabricCanvasRef.current = canvas;
    
    // Enable drop events on the upper canvas element created by Fabric
    const upperCanvas = canvas.getElement().parentElement?.querySelector('.upper-canvas');
    if (upperCanvas) {
      upperCanvas.addEventListener('dragover', (e: Event) => {
        e.preventDefault();
        (e as DragEvent).dataTransfer!.dropEffect = 'copy';
      });
    }
    
    setCanvasReady(true);

    return () => {
      setCanvasReady(false);
      if (fabricCanvasRef.current) {
        try {
          fabricCanvasRef.current.dispose();
        } catch (e) {
          // Ignore disposal errors
        }
        fabricCanvasRef.current = null;
      }
      // Clear wrapper content
      if (canvasWrapperRef.current) {
        canvasWrapperRef.current.innerHTML = '';
      }
    };
  }, []);

  // Load fields onto canvas - preserve current zoom/pan
  const loadFieldsOnCanvas = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    // Save current viewport transform before clearing
    const savedVpt = canvas.viewportTransform ? [...canvas.viewportTransform] as fabric.TMat2D : null;
    const savedZoom = canvas.getZoom();

    // Clear existing field objects (not background)
    const objectsToRemove = canvas.getObjects().filter(obj => (obj as any).__fieldId);
    objectsToRemove.forEach((obj) => {
      canvas.remove(obj);
    });

    // Add fields for current page (use ref so adding fields doesn't retrigger background fit)
    const pageFields = fieldsRef.current.filter((f) => f.pageNumber === currentPage);
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

      const labelText = field.fieldType === "text" 
        ? `${field.fieldLabel || "Text"}\n${field.signerName}${field.isRequired ? " *" : ""}`
        : `${config.label}\n${field.signerName}${field.isRequired ? " *" : ""}`;

      const text = new fabric.FabricText(labelText, {
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

      canvas.add(rect);
      canvas.add(text);
    });

    // Restore viewport transform after adding fields
    if (savedVpt) {
      canvas.setViewportTransform(savedVpt);
      setZoom(savedZoom);
    }

    canvas.requestRenderAll();
  }, [currentPage, signers]);

  // Keep a ref to fields so loadFieldsOnCanvas doesn't change identity when fields changes
  useEffect(() => {
    fieldsRef.current = fields;
  }, [fields]);

  // Load background image and fields when page changes
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    const container = containerRef.current;
    if (!canvas || !canvasReady || !pageImages.has(currentPage) || !container) return;

     const loadBackground = async () => {
       if (!isMountedRef.current) return;
       
       try {
         const imgUrl = pageImages.get(currentPage)!;
         const img = await fabric.FabricImage.fromURL(imgUrl);
         if (!isMountedRef.current || !fabricCanvasRef.current) return;

         const originalSize = typeof (img as any).getOriginalSize === "function"
           ? (img as any).getOriginalSize()
           : { width: img.width, height: img.height };

         const imgW = Number(originalSize?.width ?? img.width ?? 0) || 816;
         const imgH = Number(originalSize?.height ?? img.height ?? 0) || 1056;

         // Get available container space (with some padding)
         const containerW = Math.max(container.clientWidth - 40, 200);
         const containerH = Math.max(container.clientHeight - 40, 200);

         // Calculate the zoom level needed to fit the full page in view
         const fitZoom = Math.min(
           containerW / imgW,
           containerH / imgH,
           1.5 // Cap so we don't upscale too much on large screens
         );

         // Store initial zoom for "Fit" button
         initialZoomRef.current = fitZoom;

         // Set canvas to container size (viewport approach)
         const canvasW = Math.max(containerW, 400);
         const canvasH = Math.max(containerH, 400);
         fabricCanvasRef.current.setDimensions({ width: canvasW, height: canvasH });

         // Ensure background image is anchored to top-left of document space
         img.set({
           left: 0,
           top: 0,
           originX: "left",
           originY: "top",
           selectable: false,
           evented: false,
         });
         fabricCanvasRef.current.backgroundImage = img;

         // CRITICAL: reset any previous pan/zoom before applying the new fit transform
         fabricCanvasRef.current.setViewportTransform([1, 0, 0, 1, 0, 0]);

         // Apply the fit zoom using viewportTransform and center the page
         const offsetX = (canvasW - imgW * fitZoom) / 2;
         const offsetY = (canvasH - imgH * fitZoom) / 2;
         const vpt: fabric.TMat2D = [fitZoom, 0, 0, fitZoom, offsetX, offsetY];
         fabricCanvasRef.current.setViewportTransform(vpt);
         initialVptRef.current = vpt;

         setZoom(fitZoom);

         fabricCanvasRef.current.calcOffset();
         fabricCanvasRef.current.requestRenderAll();

         loadFieldsOnCanvas();
       } catch (error) {
         console.error("Error loading background:", error);
       }
     };

    loadBackground();
  }, [canvasReady, pageImages, currentPage, loadFieldsOnCanvas]);

  // Drag-to-pan functionality using Fabric's relativePan (works with zoom)
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !canvasReady) return;

    const handleMouseDown = (opt: fabric.TPointerEventInfo<fabric.TPointerEvent>) => {
      // Only pan if clicking on empty canvas (not on an object)
      if (opt.target) return;
      
      const e = opt.e as MouseEvent;
      isPanningRef.current = true;
      lastPanPointRef.current = { x: e.clientX, y: e.clientY };
      canvas.defaultCursor = 'grabbing';
      canvas.selection = false;
    };

    const handleMouseMove = (opt: fabric.TPointerEventInfo<fabric.TPointerEvent>) => {
      if (!isPanningRef.current || !lastPanPointRef.current) return;
      
      const e = opt.e as MouseEvent;
      const delta = new fabric.Point(
        e.clientX - lastPanPointRef.current.x,
        e.clientY - lastPanPointRef.current.y
      );
      
      // Use Fabric's relativePan for smooth panning that works with zoom
      canvas.relativePan(delta);
      lastPanPointRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isPanningRef.current = false;
      lastPanPointRef.current = null;
      canvas.defaultCursor = 'grab';
      canvas.selection = true;
    };

    canvas.defaultCursor = 'grab';
    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);

    return () => {
      canvas.off('mouse:down', handleMouseDown);
      canvas.off('mouse:move', handleMouseMove);
      canvas.off('mouse:up', handleMouseUp);
    };
  }, [canvasReady]);

  // Mouse wheel zoom - zooms toward cursor position
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !canvasReady) return;

    const handleWheel = (opt: fabric.TPointerEventInfo<WheelEvent>) => {
      const e = opt.e;
      e.preventDefault();
      e.stopPropagation();

      const delta = e.deltaY > 0 ? -0.075 : 0.075;
      let newZoom = canvas.getZoom() + delta;
      newZoom = Math.max(0.3, Math.min(newZoom, 4)); // 30% - 400%

      // Zoom toward mouse cursor position
      canvas.zoomToPoint(
        new fabric.Point(e.offsetX, e.offsetY),
        newZoom
      );
      
      canvas.requestRenderAll();
      setZoom(newZoom);
    };

    canvas.on('mouse:wheel', handleWheel);

    return () => {
      canvas.off('mouse:wheel', handleWheel);
    };
  }, [canvasReady]);

  // Note: Removed auto-fit on resize to prevent zoom from resetting when user zooms manually

  // Handle object modification
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !canvasReady) return;

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

    canvas.on("object:modified", handleModified);

    return () => {
      canvas.off("object:modified", handleModified);
    };
  }, [canvasReady]);

  // Update parent when fields change
  useEffect(() => {
    onFieldsChange(fields);
  }, [fields, onFieldsChange]);

  // Reload canvas when fields change
  useEffect(() => {
    loadFieldsOnCanvas();
  }, [fields, loadFieldsOnCanvas]);

  const addField = useCallback((dropX?: number, dropY?: number, overrideFieldType?: keyof typeof FIELD_TYPE_CONFIG) => {
    if (!selectedSigner) {
      toast.error("Please select a signer first");
      return;
    }

    const signer = signers.find((s) => s.id === selectedSigner);
    if (!signer) return;

    const canvas = fabricCanvasRef.current;
    const fieldType = overrideFieldType || selectedFieldType;
    const config = FIELD_TYPE_CONFIG[fieldType];
    
    // Calculate position - if dropped, convert screen coords to canvas coords
    let x = 100;
    let y = 100;
    
    if (canvas && dropX !== undefined && dropY !== undefined) {
      // Convert drop coordinates to canvas coordinates accounting for zoom/pan
      const vpt = canvas.viewportTransform;
      if (vpt) {
        x = (dropX - vpt[4]) / vpt[0];
        y = (dropY - vpt[5]) / vpt[3];
      }
    } else if (canvas) {
      // Place at center of current view
      const vpt = canvas.viewportTransform;
      if (vpt) {
        const centerX = canvas.getWidth() / 2;
        const centerY = canvas.getHeight() / 2;
        x = (centerX - vpt[4]) / vpt[0];
        y = (centerY - vpt[5]) / vpt[3];
      }
    }
    
    const newField: SignatureField = {
      id: crypto.randomUUID(),
      signerId: selectedSigner,
      signerName: signer.name,
      pageNumber: currentPage,
      x,
      y,
      width: config.defaultWidth,
      height: config.defaultHeight,
      fieldType,
      isRequired: fieldIsRequired,
      fieldLabel: fieldType === "text" ? (textFieldLabel || "Text Field") : undefined,
    };

    setFields((prev) => [...prev, newField]);
    toast.success(`Added ${config.label} field for ${signer.name}`);
  }, [selectedSigner, selectedFieldType, signers, currentPage, fieldIsRequired, textFieldLabel]);

  // Keep ref updated for native event listeners
  useEffect(() => {
    addFieldRef.current = addField;
  }, [addField]);

  // Add native DOM drop event listeners to the container (more reliable than React events with Fabric)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const fieldType = e.dataTransfer?.getData("fieldType") as keyof typeof FIELD_TYPE_CONFIG;
      if (!fieldType || !FIELD_TYPE_CONFIG[fieldType]) return;
      
      const rect = container.getBoundingClientRect();
      const dropX = e.clientX - rect.left;
      const dropY = e.clientY - rect.top;
      
      addFieldRef.current(dropX, dropY, fieldType);
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "copy";
      }
    };

    container.addEventListener('drop', handleDrop, true); // Use capture phase
    container.addEventListener('dragover', handleDragOver, true);

    return () => {
      container.removeEventListener('drop', handleDrop, true);
      container.removeEventListener('dragover', handleDragOver, true);
    };
  }, []);

  // Handle drop on canvas (React fallback)
  const handleCanvasDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const fieldType = e.dataTransfer.getData("fieldType") as keyof typeof FIELD_TYPE_CONFIG;
    if (!fieldType || !FIELD_TYPE_CONFIG[fieldType]) return;
    
    // Get drop position relative to canvas container
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const dropX = e.clientX - rect.left;
    const dropY = e.clientY - rect.top;
    
    // Pass the field type directly to addField
    addField(dropX, dropY, fieldType);
  }, [addField]);

  const handleCanvasDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const removeField = (fieldId: string) => {
    setFields((prev) => prev.filter((f) => f.id !== fieldId));
    toast.success("Field removed");
  };

  const deleteSelectedObject = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const activeObj = canvas.getActiveObject();
    const fieldId = (activeObj as any)?.__fieldId;
    if (!fieldId) return;

    removeField(fieldId);
  }, []);

  // Keyboard shortcut: Delete/Backspace to remove selected field
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle Delete/Backspace when not typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;
        
        const activeObj = canvas.getActiveObject();
        const fieldId = (activeObj as any)?.__fieldId;
        if (!fieldId) return;
        
        e.preventDefault();
        removeField(fieldId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
              <Label className="text-xs">Drag field to document</Label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(FIELD_TYPE_CONFIG).map(([key, config]) => {
                  const Icon = config.icon;
                  const signer = signers.find((s) => s.id === selectedSigner);
                  return (
                    <div
                      key={key}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("fieldType", key);
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      className={`
                        flex items-center gap-2 p-2 rounded border-2 border-dashed cursor-grab
                        hover:border-primary hover:bg-accent/50 transition-colors
                        ${selectedFieldType === key ? 'border-primary bg-accent/30' : 'border-muted-foreground/25'}
                      `}
                      style={{ 
                        borderColor: selectedFieldType === key ? signer?.color : undefined,
                        backgroundColor: selectedFieldType === key ? `${signer?.color}10` : undefined
                      }}
                      onClick={() => setSelectedFieldType(key as any)}
                    >
                      <Icon className="h-4 w-4" style={{ color: signer?.color }} />
                      <span className="text-xs font-medium">{config.label}</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">Drag onto document or click to select then click Add</p>
            </div>

            {/* Text field label input */}
            {selectedFieldType === "text" && (
              <div className="space-y-2">
                <Label className="text-xs">Field Label</Label>
                <Input
                  value={textFieldLabel}
                  onChange={(e) => setTextFieldLabel(e.target.value)}
                  placeholder="e.g. Company Name"
                  className="h-8 text-sm"
                />
              </div>
            )}

            {/* Required toggle */}
            <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
              <div className="flex items-center gap-2">
                <Asterisk className="h-3 w-3 text-destructive" />
                <Label className="text-xs">Required field</Label>
              </div>
              <Switch
                checked={fieldIsRequired}
                onCheckedChange={setFieldIsRequired}
              />
            </div>
            <Button
              type="button"
              onClick={deleteSelectedObject}
              variant="outline"
              className="w-full text-destructive hover:text-destructive"
              size="sm"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete Selected
            </Button>

            <div className="border-t pt-4 mt-4">
              <Button
                type="button"
                onClick={() => setTemplateDialogOpen(true)}
                variant="secondary"
                className="w-full"
                size="sm"
              >
                <FileStack className="h-4 w-4 mr-1" />
                Templates
              </Button>
            </div>
          </CardContent>
        </Card>

        <SignatureTemplateDialog
          open={templateDialogOpen}
          onOpenChange={setTemplateDialogOpen}
          currentFields={fields}
          signers={signers}
          onApplyTemplate={(newFields) => setFields(newFields)}
        />

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
                        <span className="truncate max-w-[60px]">
                          {field.fieldType === "text" ? (field.fieldLabel || "Text") : field.signerName}
                        </span>
                        {field.isRequired && (
                          <Asterisk className="h-3 w-3 text-destructive" />
                        )}
                      </div>
                      <Button
                        type="button"
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
                {/* Zoom controls */}
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    applyZoom(zoom - 0.1);
                  }}
                  disabled={zoom <= 0.3}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-xs min-w-[50px] text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    applyZoom(zoom + 0.1);
                  }}
                  disabled={zoom >= 4}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    fitToContainer();
                  }}
                  title="Fit to view"
                >
                  <Maximize className="h-4 w-4" />
                </Button>

                {/* Page navigation */}
                <div className="w-px h-6 bg-border mx-1" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setCurrentPage((p) => Math.max(1, p - 1));
                  }}
                  disabled={currentPage <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm min-w-[60px] text-center">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setCurrentPage((p) => Math.min(totalPages, p + 1));
                  }}
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
              className="border rounded-lg bg-muted/30 relative overflow-hidden max-h-[70vh] min-h-[400px] flex items-center justify-center"
              style={{ touchAction: 'none' }}
              onDrop={handleCanvasDrop}
              onDragOver={handleCanvasDragOver}
            >
              {pdfError ? (
                <div className="flex flex-col items-center justify-center h-96 gap-3 px-6 text-center">
                  <p className="text-sm font-medium">PDF failed to load</p>
                  <p className="text-xs text-muted-foreground break-all">{pdfError}</p>
                  <div className="flex items-center gap-2">
                    <Button type="button" size="sm" onClick={() => setReloadToken((v) => v + 1)}>
                      Retry
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(documentUrl, "_blank")}
                    >
                      Open PDF
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {!pageImages.has(currentPage) && (
                    <div className="flex items-center justify-center h-96 absolute inset-0 bg-background/80 z-10">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                    </div>
                  )}
                  <div 
                    ref={canvasWrapperRef} 
                    className={[
                      !pageImages.has(currentPage) ? "opacity-0" : "",
                    ].join(" ")}
                    onDrop={handleCanvasDrop}
                    onDragOver={handleCanvasDragOver}
                    style={{ pointerEvents: 'auto' }}
                  />
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Drag fields from the left panel onto the document. Resize by dragging corners. Click and drag empty areas to pan. Use mouse wheel to zoom.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
