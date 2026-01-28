import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Plus, GripVertical, ChevronLeft, ChevronRight } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";

// Set worker path - use a specific version that matches the installed package
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

interface ComplianceFieldEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
  templateName: string;
  templateFileUrl: string;
  companyId: string;
}

interface FieldPosition {
  id?: string;
  field_key: string;
  field_label: string;
  page_number: number;
  x_position: number;
  y_position: number;
  width: number;
  font_size: number;
  font_color: string;
  text_align: string;
}

const AVAILABLE_FIELDS = [
  { key: "customer_name", label: "Customer Name" },
  { key: "customer_email", label: "Customer Email" },
  { key: "customer_phone", label: "Customer Phone" },
  { key: "project_name", label: "Project Name" },
  { key: "project_address", label: "Project Address" },
  { key: "estimate_total", label: "Estimate Total" },
  { key: "deposit_amount", label: "Deposit Amount" },
  { key: "scope_description", label: "Scope of Work" },
  { key: "salesperson_name", label: "Salesperson Name" },
  { key: "company_name", label: "Company Name" },
  { key: "company_address", label: "Company Address" },
  { key: "company_phone", label: "Company Phone" },
  { key: "company_license", label: "License Number" },
  { key: "current_date", label: "Current Date" },
  { key: "expiration_date", label: "Expiration Date" },
  { key: "line_items", label: "Line Items" },
  { key: "payment_schedule", label: "Payment Schedule" },
  { key: "terms_and_conditions", label: "Terms & Conditions" },
  { key: "notes", label: "Notes" },
];

export function ComplianceFieldEditor({
  open,
  onOpenChange,
  templateId,
  templateName,
  templateFileUrl,
  companyId,
}: ComplianceFieldEditorProps) {
  const [fields, setFields] = useState<FieldPosition[]>([]);
  const [selectedFieldIndex, setSelectedFieldIndex] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageImage, setPageImage] = useState<string | null>(null);
  const [pageDimensions, setPageDimensions] = useState({ width: 0, height: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Load PDF and render current page
  useEffect(() => {
    if (!open || !templateFileUrl) return;

    const loadPdf = async () => {
      setLoading(true);
      try {
        const loadingTask = pdfjsLib.getDocument(templateFileUrl);
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
        setCurrentPage(1);
      } catch (error) {
        console.error("Error loading PDF:", error);
        toast.error("Failed to load PDF template");
      }
    };

    loadPdf();
  }, [open, templateFileUrl]);

  // Render current page
  useEffect(() => {
    if (!pdfDoc) return;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(currentPage);
        const scale = 1.5;
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d")!;
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise;

        setPageImage(canvas.toDataURL());
        setPageDimensions({ width: viewport.width, height: viewport.height });
        setLoading(false);
      } catch (error) {
        console.error("Error rendering page:", error);
        toast.error("Failed to render PDF page");
        setLoading(false);
      }
    };

    renderPage();
  }, [pdfDoc, currentPage]);

  // Load existing fields
  useEffect(() => {
    if (!open || !templateId) return;

    const loadFields = async () => {
      const { data, error } = await supabase
        .from("compliance_template_fields")
        .select("*")
        .eq("template_id", templateId)
        .order("created_at");

      if (error) {
        console.error("Error loading fields:", error);
        toast.error("Failed to load existing fields");
        return;
      }

      setFields(
        (data || []).map((f) => ({
          id: f.id,
          field_key: f.field_key,
          field_label: f.field_label || "",
          page_number: f.page_number,
          x_position: Number(f.x_position),
          y_position: Number(f.y_position),
          width: Number(f.width) || 200,
          font_size: Number(f.font_size) || 12,
          font_color: f.font_color || "#000000",
          text_align: f.text_align || "left",
        }))
      );
    };

    loadFields();
  }, [open, templateId]);

  const addField = () => {
    const newField: FieldPosition = {
      field_key: "customer_name",
      field_label: "Customer Name",
      page_number: currentPage,
      x_position: 100,
      y_position: 100,
      width: 200,
      font_size: 12,
      font_color: "#000000",
      text_align: "left",
    };
    setFields([...fields, newField]);
    setSelectedFieldIndex(fields.length);
  };

  const updateField = (index: number, updates: Partial<FieldPosition>) => {
    const updated = [...fields];
    updated[index] = { ...updated[index], ...updates };
    setFields(updated);
  };

  const deleteField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
    setSelectedFieldIndex(null);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if clicked on an existing field
    const clickedFieldIndex = fields.findIndex(
      (f) =>
        f.page_number === currentPage &&
        x >= f.x_position &&
        x <= f.x_position + f.width &&
        y >= f.y_position &&
        y <= f.y_position + 24
    );

    if (clickedFieldIndex >= 0) {
      setSelectedFieldIndex(clickedFieldIndex);
    } else {
      setSelectedFieldIndex(null);
    }
  };

  const handleFieldMouseDown = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    const field = fields[index];
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    
    setIsDragging(true);
    setSelectedFieldIndex(index);
    setDragOffset({
      x: e.clientX - field.x_position,
      y: e.clientY - field.y_position,
    });
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || selectedFieldIndex === null) return;

      const containerRect = canvasContainerRef.current?.getBoundingClientRect();
      if (!containerRect) return;

      const newX = Math.max(0, Math.min(e.clientX - containerRect.left - dragOffset.x + containerRect.left, pageDimensions.width - fields[selectedFieldIndex].width));
      const newY = Math.max(0, Math.min(e.clientY - containerRect.top - dragOffset.y + containerRect.top, pageDimensions.height - 24));

      updateField(selectedFieldIndex, {
        x_position: e.clientX - containerRect.left - (dragOffset.x - containerRect.left),
        y_position: e.clientY - containerRect.top - (dragOffset.y - containerRect.top),
      });
    },
    [isDragging, selectedFieldIndex, dragOffset, pageDimensions, fields]
  );

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const saveFields = async () => {
    setSaving(true);
    try {
      // Delete existing fields
      await supabase
        .from("compliance_template_fields")
        .delete()
        .eq("template_id", templateId);

      // Insert new fields
      if (fields.length > 0) {
        const { error } = await supabase.from("compliance_template_fields").insert(
          fields.map((f) => ({
            template_id: templateId,
            company_id: companyId,
            field_key: f.field_key,
            field_label: f.field_label,
            page_number: f.page_number,
            x_position: f.x_position,
            y_position: f.y_position,
            width: f.width,
            font_size: f.font_size,
            font_color: f.font_color,
            text_align: f.text_align,
          }))
        );

        if (error) throw error;
      }

      toast.success("Field positions saved successfully");
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving fields:", error);
      toast.error("Failed to save field positions");
    } finally {
      setSaving(false);
    }
  };

  const selectedField = selectedFieldIndex !== null ? fields[selectedFieldIndex] : null;
  const currentPageFields = fields.filter((f) => f.page_number === currentPage);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Configure Field Positions - {templateName}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex gap-4 overflow-hidden">
          {/* PDF Preview */}
          <div className="flex-1 flex flex-col bg-muted/30 rounded-lg overflow-hidden">
            {/* Page Navigation */}
            <div className="flex items-center justify-between p-2 border-b bg-background">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Canvas Area */}
            <ScrollArea className="flex-1">
              <div
                ref={canvasContainerRef}
                className="relative inline-block m-4"
                style={{ width: pageDimensions.width, height: pageDimensions.height }}
                onClick={handleCanvasClick}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                {loading ? (
                  <div className="flex items-center justify-center h-full min-h-[400px]">
                    <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
                  </div>
                ) : pageImage ? (
                  <>
                    <img
                      src={pageImage}
                      alt={`Page ${currentPage}`}
                      className="block"
                      draggable={false}
                    />
                    {/* Field Overlays */}
                    {currentPageFields.map((field, idx) => {
                      const actualIndex = fields.findIndex((f) => f === field);
                      return (
                        <div
                          key={actualIndex}
                          className={`absolute border-2 rounded px-2 py-1 cursor-move select-none transition-colors ${
                            selectedFieldIndex === actualIndex
                              ? "border-primary bg-primary/20"
                              : "border-blue-500 bg-blue-500/10 hover:bg-blue-500/20"
                          }`}
                          style={{
                            left: field.x_position,
                            top: field.y_position,
                            width: field.width,
                            fontSize: field.font_size,
                            color: field.font_color,
                            textAlign: field.text_align as any,
                          }}
                          onMouseDown={(e) => handleFieldMouseDown(e, actualIndex)}
                        >
                          <GripVertical className="inline h-3 w-3 mr-1 opacity-50" />
                          <span className="text-xs font-medium">{field.field_label || field.field_key}</span>
                        </div>
                      );
                    })}
                  </>
                ) : null}
              </div>
            </ScrollArea>
          </div>

          {/* Field Properties Panel */}
          <div className="w-80 flex flex-col border rounded-lg bg-background">
            <div className="p-3 border-b flex items-center justify-between">
              <h3 className="font-semibold">Fields</h3>
              <Button size="sm" onClick={addField}>
                <Plus className="h-4 w-4 mr-1" /> Add Field
              </Button>
            </div>

            <ScrollArea className="flex-1 p-3">
              {fields.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No fields added yet. Click "Add Field" to add a field overlay.
                </p>
              ) : (
                <div className="space-y-2">
                  {fields.map((field, index) => (
                    <div
                      key={index}
                      className={`p-2 rounded border cursor-pointer transition-colors ${
                        selectedFieldIndex === index
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/50"
                      }`}
                      onClick={() => {
                        setSelectedFieldIndex(index);
                        if (field.page_number !== currentPage) {
                          setCurrentPage(field.page_number);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {field.field_label || field.field_key}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteField(index);
                          }}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Page {field.page_number}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Selected Field Properties */}
            {selectedField && (
              <div className="border-t p-3 space-y-3">
                <h4 className="font-medium text-sm">Field Properties</h4>

                <div className="space-y-2">
                  <Label className="text-xs">Field Type</Label>
                  <Select
                    value={selectedField.field_key}
                    onValueChange={(value) => {
                      const fieldDef = AVAILABLE_FIELDS.find((f) => f.key === value);
                      updateField(selectedFieldIndex!, {
                        field_key: value,
                        field_label: fieldDef?.label || value,
                      });
                    }}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_FIELDS.map((f) => (
                        <SelectItem key={f.key} value={f.key}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">X Position</Label>
                    <Input
                      type="number"
                      className="h-8"
                      value={Math.round(selectedField.x_position)}
                      onChange={(e) =>
                        updateField(selectedFieldIndex!, { x_position: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Y Position</Label>
                    <Input
                      type="number"
                      className="h-8"
                      value={Math.round(selectedField.y_position)}
                      onChange={(e) =>
                        updateField(selectedFieldIndex!, { y_position: Number(e.target.value) })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Width</Label>
                    <Input
                      type="number"
                      className="h-8"
                      value={selectedField.width}
                      onChange={(e) =>
                        updateField(selectedFieldIndex!, { width: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Font Size</Label>
                    <Input
                      type="number"
                      className="h-8"
                      value={selectedField.font_size}
                      onChange={(e) =>
                        updateField(selectedFieldIndex!, { font_size: Number(e.target.value) })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Text Align</Label>
                  <Select
                    value={selectedField.text_align}
                    onValueChange={(value) =>
                      updateField(selectedFieldIndex!, { text_align: value })
                    }
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Left</SelectItem>
                      <SelectItem value="center">Center</SelectItem>
                      <SelectItem value="right">Right</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Page</Label>
                  <Select
                    value={String(selectedField.page_number)}
                    onValueChange={(value) => {
                      updateField(selectedFieldIndex!, { page_number: Number(value) });
                      setCurrentPage(Number(value));
                    }}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: totalPages }, (_, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>
                          Page {i + 1}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={saveFields} disabled={saving}>
            {saving ? "Saving..." : "Save Field Positions"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
