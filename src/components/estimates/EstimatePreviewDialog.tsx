import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Building, Loader2, FileDown, X } from 'lucide-react';
import { toast } from 'sonner';
import { PdfViewerDialog } from '@/components/production/PdfViewerDialog';
import {
  ProposalContent,
  getStatusBadge,
  type ProposalEstimate,
  type ProposalGroup,
  type ProposalLineItem,
  type ProposalPaymentPhase,
  type ProposalSignature,
  type ProposalPhoto,
  type ProposalAttachedDocument,
} from '@/components/proposals/ProposalContent';

interface EstimatePreviewDialogProps {
  estimateId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EstimatePreviewDialog({
  estimateId,
  open,
  onOpenChange,
}: EstimatePreviewDialogProps) {
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const handlePrintPdf = () => {
    if (!estimateId) return;
    window.open(`/proposal-print/${estimateId}`, '_blank');
  };

  const { data, isLoading } = useQuery({
    queryKey: ['estimate-preview', estimateId],
    queryFn: async () => {
      if (!estimateId) return null;

      const { data: estimate, error } = await supabase
        .from('estimates')
        .select('*')
        .eq('id', estimateId)
        .single();

      if (error) throw error;

      const { data: groups } = await supabase
        .from('estimate_groups')
        .select('*')
        .eq('estimate_id', estimateId)
        .order('sort_order');

      const { data: lineItems } = await supabase
        .from('estimate_line_items')
        .select('*')
        .eq('estimate_id', estimateId)
        .order('sort_order');

      const { data: paymentSchedule } = await supabase
        .from('estimate_payment_schedule')
        .select('*')
        .eq('estimate_id', estimateId)
        .order('sort_order');

      const { data: signatures } = await supabase
        .from('estimate_signatures')
        .select('*')
        .eq('estimate_id', estimateId);

      // Fetch estimate photos and files scoped to this specific estimate
      let estimatePhotos: ProposalPhoto[] = [];
      let estimateFiles: ProposalAttachedDocument[] = [];
      if (estimate.project_id) {
        const [photosRes, filesRes] = await Promise.all([
          supabase
            .from('project_documents')
            .select('id, file_url, file_name')
            .eq('project_id', estimate.project_id)
            .eq('category', 'Estimate Photo')
            .eq('estimate_id', estimateId)
            .order('created_at', { ascending: false }),
          supabase
            .from('project_documents')
            .select('id, file_url, file_name, file_type')
            .eq('project_id', estimate.project_id)
            .eq('category', 'Estimate File')
            .eq('estimate_id', estimateId)
            .order('created_at', { ascending: false }),
        ]);
        estimatePhotos = (photosRes.data || []) as ProposalPhoto[];
        estimateFiles = (filesRes.data || []).map(f => ({
          id: f.id,
          file_url: f.file_url,
          file_name: f.file_name || 'Document',
          file_type: f.file_type,
        })) as ProposalAttachedDocument[];
      }

      return {
        estimate: estimate as ProposalEstimate,
        groups: (groups || []) as ProposalGroup[],
        lineItems: (lineItems || []) as ProposalLineItem[],
        paymentSchedule: (paymentSchedule || []) as ProposalPaymentPhase[],
        signatures: (signatures || []) as ProposalSignature[],
        estimatePhotos,
        estimateFiles,
      };
    },
    enabled: !!estimateId && open,
  });

  const handleGeneratePdf = async () => {
    if (!estimateId || !data?.estimate) return;

    setGeneratingPdf(true);
    try {
      const { data: pdfData, error } = await supabase.functions.invoke('generate-contract-pdf', {
        body: { estimateId },
      });

      if (error) throw error;

      if (pdfData?.url) {
        setPdfUrl(pdfData.url);
        toast.success('PDF generated successfully');
      } else {
        throw new Error('Failed to generate PDF');
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF');
    } finally {
      setGeneratingPdf(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="bg-background border-b px-6 py-4 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building className="h-5 w-5 text-primary" />
              <DialogTitle>Customer Proposal Preview</DialogTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrintPdf}
                disabled={!data?.estimate}
              >
                <FileDown className="h-4 w-4 mr-2" />
                Save as PDF
              </Button>
              {data?.estimate && getStatusBadge(data.estimate.status)}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                aria-label="Close preview"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-80px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !data?.estimate ? (
            <div className="text-center py-12 text-muted-foreground">
              Estimate not found
            </div>
          ) : (
            <ProposalContent
              estimate={data.estimate}
              groups={data.groups}
              lineItems={data.lineItems}
              paymentSchedule={data.paymentSchedule}
              signatures={data.signatures}
              photos={data.estimatePhotos}
              attachedDocuments={data.estimateFiles}
              showStatusBanner={true}
              showSalesperson={false}
              showNotes={true}
            />
          )}
        </ScrollArea>
      </DialogContent>

      {/* PDF Viewer Dialog */}
      <PdfViewerDialog
        open={!!pdfUrl}
        onOpenChange={(isOpen) => !isOpen && setPdfUrl(null)}
        fileUrl={pdfUrl || ''}
        fileName={`Proposal-${data?.estimate?.estimate_number || 'Preview'}.pdf`}
      />
    </Dialog>
  );
}
