import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, FileText, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { PdfViewerDialog } from "@/components/production/PdfViewerDialog";

interface ComplianceTestOverlayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
  templateName: string;
  companyId: string;
}

interface Estimate {
  id: string;
  customer_name: string | null;
  estimate_title: string | null;
  job_address: string | null;
  created_at: string;
}

export function ComplianceTestOverlayDialog({
  open,
  onOpenChange,
  templateId,
  templateName,
  companyId,
}: ComplianceTestOverlayDialogProps) {
  const [selectedEstimateId, setSelectedEstimateId] = useState<string>("");
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState<string>("");

  // Fetch recent estimates for this company
  const { data: estimates = [], isLoading: loadingEstimates } = useQuery({
    queryKey: ["estimates-for-test", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estimates")
        .select("id, customer_name, estimate_title, job_address, created_at")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as Estimate[];
    },
    enabled: open && !!companyId,
  });

  // Generate document mutation
  const generateMutation = useMutation({
    mutationFn: async (estimateId: string) => {
      const { data, error } = await supabase.functions.invoke(
        "generate-compliance-documents",
        {
          body: { estimateId, companyId },
        }
      );

      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Generation failed");

      // Find the document for our template
      const doc = data.documents?.find(
        (d: any) => d.template_id === templateId
      );
      if (!doc?.generated_file_url) {
        throw new Error("No generated PDF URL returned");
      }

      return doc.generated_file_url as string;
    },
    onSuccess: (url) => {
      setGeneratedPdfUrl(url);
      setPdfViewerOpen(true);
      toast.success("Document generated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Generation failed: ${error.message}`);
    },
  });

  const handleGenerate = () => {
    if (!selectedEstimateId) {
      toast.error("Please select an estimate");
      return;
    }
    generateMutation.mutate(selectedEstimateId);
  };

  const handleClose = () => {
    setSelectedEstimateId("");
    setGeneratedPdfUrl("");
    onOpenChange(false);
  };

  const selectedEstimate = estimates.find((e) => e.id === selectedEstimateId);

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Test Overlay: {templateName}
            </DialogTitle>
            <DialogDescription>
              Select an estimate to generate a preview of the filled PDF
              template with actual data.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="estimate-select">Select Estimate</Label>
              {loadingEstimates ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading estimates...
                </div>
              ) : estimates.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertCircle className="h-4 w-4" />
                  No estimates found
                </div>
              ) : (
                <Select
                  value={selectedEstimateId}
                  onValueChange={setSelectedEstimateId}
                >
                  <SelectTrigger id="estimate-select">
                    <SelectValue placeholder="Choose an estimate..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {estimates.map((estimate) => (
                      <SelectItem key={estimate.id} value={estimate.id}>
                        <div className="flex flex-col items-start">
                          <span className="font-medium">
                            {estimate.customer_name || "Unknown Customer"}
                          </span>
                          <span className="text-xs text-muted-foreground truncate max-w-[250px]">
                            {estimate.job_address || estimate.estimate_title || "No address"}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {selectedEstimate && (
              <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
                <p>
                  <strong>Customer:</strong>{" "}
                  {selectedEstimate.customer_name || "N/A"}
                </p>
                <p>
                  <strong>Address:</strong>{" "}
                  {selectedEstimate.job_address || "N/A"}
                </p>
                <p>
                  <strong>Title:</strong>{" "}
                  {selectedEstimate.estimate_title || "N/A"}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={!selectedEstimateId || generateMutation.isPending}
            >
              {generateMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              Generate & Preview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PDF Viewer */}
      <PdfViewerDialog
        open={pdfViewerOpen}
        onOpenChange={setPdfViewerOpen}
        fileUrl={generatedPdfUrl}
        fileName={`${templateName} - Test Preview`}
      />
    </>
  );
}
