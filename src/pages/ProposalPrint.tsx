import { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import {
  ProposalContent,
  type ProposalEstimate,
  type ProposalGroup,
  type ProposalLineItem,
  type ProposalPaymentPhase,
  type ProposalSignature,
  type ProposalPhoto,
  type ProposalAttachedDocument,
} from '@/components/proposals/ProposalContent';

export default function ProposalPrint() {
  const { estimateId } = useParams<{ estimateId: string }>();
  const [searchParams] = useSearchParams();
  const noPrint = searchParams.get('noprint') === '1';

  const { data, isLoading } = useQuery({
    queryKey: ['proposal-print', estimateId],
    queryFn: async () => {
      if (!estimateId) return null;

      const { data: estimate, error } = await supabase
        .from('estimates')
        .select('*')
        .eq('id', estimateId)
        .single();

      if (error) throw error;

      const [groupsRes, itemsRes, scheduleRes, signaturesRes] = await Promise.all([
        supabase.from('estimate_groups').select('*').eq('estimate_id', estimateId).order('sort_order'),
        supabase.from('estimate_line_items').select('*').eq('estimate_id', estimateId).order('sort_order'),
        supabase.from('estimate_payment_schedule').select('*').eq('estimate_id', estimateId).order('sort_order'),
        supabase.from('estimate_signatures').select('*').eq('estimate_id', estimateId),
      ]);

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
        groups: (groupsRes.data || []) as ProposalGroup[],
        lineItems: (itemsRes.data || []) as ProposalLineItem[],
        paymentSchedule: (scheduleRes.data || []) as ProposalPaymentPhase[],
        signatures: (signaturesRes.data || []) as ProposalSignature[],
        estimatePhotos,
        estimateFiles,
      };
    },
    enabled: !!estimateId,
  });

  // Auto-trigger print once data is loaded (skip if noprint query param is set)
  useEffect(() => {
    if (data?.estimate && !noPrint) {
      const timeout = setTimeout(() => {
        window.print();
      }, 800);
      return () => clearTimeout(timeout);
    }
  }, [data, noPrint]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-3 text-muted-foreground">Loading proposal...</span>
      </div>
    );
  }

  if (!data?.estimate) {
    return (
      <div className="flex items-center justify-center min-h-screen text-muted-foreground">
        Proposal not found
      </div>
    );
  }

  return (
    <div className="proposal-print-page bg-white min-h-screen">
      <ProposalContent
        estimate={data.estimate}
        groups={data.groups}
        lineItems={data.lineItems}
        paymentSchedule={data.paymentSchedule}
        signatures={data.signatures}
        photos={data.estimatePhotos}
        attachedDocuments={data.estimateFiles}
        showStatusBanner={false}
        showSalesperson={false}
        showNotes={true}
      />
    </div>
  );
}
