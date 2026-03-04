import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  FileText,
  Download,
  Calendar,
  CheckCircle2,
  Eye,
  Shield,
  Award,
  FileCheck,
  Clock,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { PdfViewerDialog } from '@/components/production/PdfViewerDialog';

interface PortalAgreementProps {
  agreements: any[];
  acceptedEstimate?: any;
}

export function PortalAgreement({ agreements, acceptedEstimate }: PortalAgreementProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [generatingAgreementId, setGeneratingAgreementId] = useState<string | null>(null);
  const [generatingContractPdf, setGeneratingContractPdf] = useState(false);

  const [downloadingContractPdf, setDownloadingContractPdf] = useState(false);

  // IMPORTANT: Define helper functions BEFORE useMemo hooks that reference them
  const isContractAgreement = (agreement: any) => {
    const type = (agreement?.agreement_type || '').toLowerCase();
    const num = agreement?.agreement_number || '';
    return type === 'contract' || num.startsWith('CNT-');
  };

  const parseAgreementEstimateNumber = (agreementNumber?: string | null): number | null => {
    if (!agreementNumber) return null;
    const match = agreementNumber.match(/(\d+)/);
    if (!match) return null;
    const num = Number(match[1]);
    return Number.isFinite(num) ? num : null;
  };

  // Find the matching agreement attachment_url for the accepted estimate
  const getEstimateAttachmentUrl = () => {
    if (!acceptedEstimate) return null;
    const estNum = acceptedEstimate.estimate_number;
    if (!estNum) return null;
    // Look for a matching agreement by number (CNT-XXXX or CO-XXXX pattern)
    const match = agreements.find((a: any) => {
      const num = a.agreement_number?.replace(/^(CNT-|CO-)/, '');
      return num === String(estNum);
    });
    return match?.attachment_url || null;
  };

  const viewContractPdf = async () => {
    if (!acceptedEstimate?.id) return;
    
    // Portal users are anonymous — try to use stored attachment_url directly
    const attachmentUrl = getEstimateAttachmentUrl();
    if (attachmentUrl) {
      setPdfUrl(attachmentUrl);
      return;
    }

    // Fallback: try edge function (will likely fail for anonymous users)
    setGeneratingContractPdf(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-contract-pdf', {
        body: {
          estimateId: acceptedEstimate.id,
          projectId: acceptedEstimate.project_id,
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error('Failed to generate contract PDF');

      setPdfUrl(data.url);
    } catch (err) {
      console.error('Failed to generate contract PDF:', err);
      toast.error('Could not generate contract PDF');
    } finally {
      setGeneratingContractPdf(false);
    }
  };

  const downloadContractPdf = async () => {
    if (!acceptedEstimate?.id) return;
    
    // Portal users are anonymous — try to use stored attachment_url directly
    const attachmentUrl = getEstimateAttachmentUrl();
    if (attachmentUrl) {
      window.open(attachmentUrl, '_blank');
      return;
    }

    // Fallback: try edge function
    setDownloadingContractPdf(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-contract-pdf', {
        body: {
          estimateId: acceptedEstimate.id,
          projectId: acceptedEstimate.project_id,
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error('Failed to generate contract PDF');

      window.open(data.url, '_blank');
    } catch (err) {
      console.error('Failed to download contract PDF:', err);
      toast.error('Could not download contract PDF');
    } finally {
      setDownloadingContractPdf(false);
    }
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const hasAgreement = useMemo(() => agreements.length > 0 || !!acceptedEstimate, [agreements.length, acceptedEstimate]);

  // Separate main contract (earliest by signed date) from additional agreements
  const mainContract = useMemo(() => {
    const contracts = agreements.filter((a: any) => isContractAgreement(a));
    if (contracts.length === 0) return null;
    // Return the one with the earliest agreement_signed_date (or created_at as fallback)
    return contracts.sort((a: any, b: any) => {
      const dateA = new Date((a.agreement_signed_date ? a.agreement_signed_date + 'T00:00:00' : null) || a.created_at).getTime();
      const dateB = new Date((b.agreement_signed_date ? b.agreement_signed_date + 'T00:00:00' : null) || b.created_at).getTime();
      return dateA - dateB;
    })[0];
  }, [agreements]);

  const additionalAgreements = useMemo(() => {
    // Always exclude mainContract from additional list since it renders as the hero when present
    const mainId = mainContract?.id || null;
    return agreements
      .filter((a: any) => a.id !== mainId)
      .sort((a: any, b: any) => {
        const dateA = new Date((a.agreement_signed_date ? a.agreement_signed_date + 'T00:00:00' : null) || a.created_at).getTime();
        const dateB = new Date((b.agreement_signed_date ? b.agreement_signed_date + 'T00:00:00' : null) || b.created_at).getTime();
        return dateA - dateB;
      });
  }, [agreements, mainContract]);

  const openAgreementPdf = async (agreement: any) => {
    if (!agreement?.attachment_url) return;
    // Portal users are anonymous — always open the stored PDF directly
    // (estimate lookup and edge function calls require authenticated access)
    setPdfUrl(agreement.attachment_url);
  };

  const downloadAgreementPdf = async (agreement: any) => {
    if (!agreement?.attachment_url) return;
    // Portal users are anonymous — directly open the stored PDF
    window.open(agreement.attachment_url, '_blank');
  };

  if (!hasAgreement) {
    return (
      <Card className="border-0 shadow-lg overflow-hidden">
        <CardContent className="py-16 text-center">
          <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-6">
            <FileText className="h-10 w-10 text-slate-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">No Agreement Yet</h3>
          <p className="text-slate-500 max-w-sm mx-auto">
            Your contract agreement will appear here once a proposal is accepted and signed.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Determine the primary agreement to show as hero card
  // Priority: mainContract (actual "Contract" type from project_agreements) first, 
  // then acceptedEstimate (digitally signed proposal) as fallback
  const showMainContractHero = !!mainContract;
  const showAcceptedEstimateHero = !showMainContractHero && !!acceptedEstimate;

  return (
    <div className="space-y-6">
      {/* Accepted Estimate as Main Agreement */}
      {showAcceptedEstimateHero && (
        <Card className="border-0 shadow-xl overflow-hidden">
          {/* Success Banner */}
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 text-white">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Award className="h-7 w-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold">Signed Contract</h3>
                  <Badge className="bg-white/20 text-white border-0">Active</Badge>
                </div>
                <p className="text-green-100 text-sm mt-1">
                  Contract #{acceptedEstimate.estimate_number} • Digitally Signed
                </p>
              </div>
            </div>
          </div>
          
          <CardContent className="p-6 sm:p-8 space-y-6">
          {/* Contract Details Grid */}
          <div className="grid sm:grid-cols-3 gap-6">
            <div className="bg-slate-50 rounded-xl p-5">
              <div className="flex items-center gap-2 text-slate-500 mb-2">
                <FileCheck className="h-4 w-4" />
                <span className="text-xs uppercase tracking-wider font-medium">Contract Title</span>
              </div>
              <p className="font-semibold text-slate-900 mb-3">
                {acceptedEstimate.estimate_title}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={viewContractPdf}
                  disabled={generatingContractPdf}
                  className="flex-1"
                >
                  {generatingContractPdf ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Eye className="h-4 w-4 mr-2" />
                  )}
                  View
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={downloadContractPdf}
                  disabled={downloadingContractPdf}
                  aria-label="Download PDF"
                >
                  {downloadingContractPdf ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-5 border border-primary/10">
              <div className="flex items-center gap-2 text-primary/70 mb-2">
                <span className="text-xs uppercase tracking-wider font-medium">Contract Value</span>
              </div>
              <p className="text-2xl font-bold text-primary">
                {formatCurrency(acceptedEstimate.total)}
              </p>
            </div>
            
            <div className="bg-slate-50 rounded-xl p-5">
              <div className="flex items-center gap-2 text-slate-500 mb-2">
                <Calendar className="h-4 w-4" />
                <span className="text-xs uppercase tracking-wider font-medium">Signed Date</span>
              </div>
              <p className="font-semibold text-slate-900">
                {acceptedEstimate.signed_at 
                  ? format(new Date(acceptedEstimate.signed_at), 'MMMM d, yyyy')
                  : 'N/A'}
              </p>
            </div>
          </div>

            {/* Signature Verification Badge */}
            <div className="flex items-center gap-4 bg-green-50 border border-green-100 rounded-xl p-4">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <Shield className="h-6 w-6 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-green-800">Digitally Signed & Verified</p>
                <p className="text-sm text-green-600">
                  This contract has been electronically signed and is legally binding.
                </p>
              </div>
              <CheckCircle2 className="h-6 w-6 text-green-500" />
            </div>

            {/* Scope of Work Description */}
            {acceptedEstimate.show_scope_to_customer && acceptedEstimate.work_scope_description && (
              <div className="space-y-3">
                <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-slate-400" />
                  Scope of Work
                </h4>
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 max-h-64 overflow-y-auto">
                  <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                    {acceptedEstimate.work_scope_description}
                  </p>
                </div>
              </div>
            )}

            {acceptedEstimate.terms_and_conditions && (
              <div className="space-y-3">
                <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-slate-400" />
                  Terms & Conditions
                </h4>
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 max-h-64 overflow-y-auto">
                  <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                    {acceptedEstimate.terms_and_conditions}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Main Contract from project_agreements (when no accepted estimate) */}
      {showMainContractHero && mainContract && (
        <Card className="border-0 shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 text-white">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Award className="h-7 w-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold">Signed Contract</h3>
                  <Badge className="bg-white/20 text-white border-0">Active</Badge>
                </div>
                <p className="text-green-100 text-sm mt-1">
                  {mainContract.agreement_type || 'Contract'}
                  {mainContract.agreement_number ? ` #${mainContract.agreement_number}` : ''}
                </p>
              </div>
            </div>
          </div>

          <CardContent className="p-6 sm:p-8 space-y-6">
            <div className="grid sm:grid-cols-3 gap-6">
              <div className="bg-slate-50 rounded-xl p-5">
                <div className="flex items-center gap-2 text-slate-500 mb-2">
                  <FileCheck className="h-4 w-4" />
                  <span className="text-xs uppercase tracking-wider font-medium">Contract</span>
                </div>
                <p className="font-semibold text-slate-900 mb-3">
                  {mainContract.description_of_work || mainContract.agreement_type || 'Contract'}
                </p>
                {(mainContract.attachment_url || isContractAgreement(mainContract)) && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openAgreementPdf(mainContract)}
                      disabled={generatingAgreementId === mainContract.id}
                      className="flex-1"
                    >
                      {generatingAgreementId === mainContract.id ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Eye className="h-4 w-4 mr-2" />
                      )}
                      View
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => downloadAgreementPdf(mainContract)}
                      disabled={generatingAgreementId === mainContract.id}
                      aria-label="Download PDF"
                    >
                      {generatingAgreementId === mainContract.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                )}
              </div>

              <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-5 border border-primary/10">
                <div className="flex items-center gap-2 text-primary/70 mb-2">
                  <span className="text-xs uppercase tracking-wider font-medium">Contract Value</span>
                </div>
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(mainContract.total_price)}
                </p>
              </div>

              <div className="bg-slate-50 rounded-xl p-5">
                <div className="flex items-center gap-2 text-slate-500 mb-2">
                  <Calendar className="h-4 w-4" />
                  <span className="text-xs uppercase tracking-wider font-medium">Signed Date</span>
                </div>
                <p className="font-semibold text-slate-900">
                  {mainContract.agreement_signed_date
                    ? format(new Date(mainContract.agreement_signed_date + 'T00:00:00'), 'MMMM d, yyyy')
                    : 'N/A'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-green-50 border border-green-100 rounded-xl p-4">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <Shield className="h-6 w-6 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-green-800">Signed & Verified</p>
                <p className="text-sm text-green-600">
                  This contract has been signed and is legally binding.
                </p>
              </div>
              <CheckCircle2 className="h-6 w-6 text-green-500" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Additional Project Agreements (includes acceptedEstimate when mainContract is hero) */}
      {(additionalAgreements.length > 0 || (showMainContractHero && acceptedEstimate)) && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <FileText className="h-5 w-5 text-slate-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Additional Agreements</h3>
              <p className="text-sm text-slate-500">{additionalAgreements.length + (showMainContractHero && acceptedEstimate ? 1 : 0)} document(s)</p>
            </div>
          </div>
          
          {additionalAgreements.map((agreement) => {
            const canViewPdf = agreement.attachment_url || isContractAgreement(agreement);
            
            return (
            <Card key={agreement.id} className="border-0 shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                      <FileText className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-slate-900">
                          {agreement.agreement_type || 'Agreement'}
                        </h4>
                        {agreement.agreement_number && (
                          <Badge variant="outline" className="font-mono">
                            #{agreement.agreement_number}
                          </Badge>
                        )}
                      </div>
                      {agreement.description_of_work && (
                        <button
                          onClick={() => canViewPdf && openAgreementPdf(agreement)}
                          disabled={!canViewPdf || generatingAgreementId === agreement.id}
                          className={`text-sm text-left line-clamp-2 ${canViewPdf ? 'text-primary hover:underline cursor-pointer' : 'text-slate-500'}`}
                        >
                          {agreement.description_of_work}
                          {canViewPdf && <span className="text-xs ml-1">(click to view)</span>}
                        </button>
                      )}
                      <div className="flex flex-wrap items-center gap-4 text-sm">
                        {agreement.agreement_signed_date && (
                          <span className="flex items-center gap-1.5 text-slate-500">
                            <Calendar className="h-4 w-4" />
                            Signed {format(new Date(agreement.agreement_signed_date), 'MMM d, yyyy')}
                          </span>
                        )}
                        {agreement.total_price && (
                          <span className="font-semibold text-primary">
                            {formatCurrency(agreement.total_price)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {canViewPdf && (
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="shadow-sm"
                        onClick={() => openAgreementPdf(agreement)}
                        disabled={generatingAgreementId === agreement.id}
                      >
                        {generatingAgreementId === agreement.id ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Eye className="h-4 w-4 mr-2" />
                        )}
                        View PDF
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => downloadAgreementPdf(agreement)}
                        disabled={generatingAgreementId === agreement.id}
                        aria-label="Download PDF"
                      >
                        {generatingAgreementId === agreement.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );})}

          {/* Show acceptedEstimate as additional agreement when mainContract is hero */}
          {showMainContractHero && acceptedEstimate && (
            <Card className="border-0 shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
                      <FileText className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-slate-900">
                          Change Order
                        </h4>
                        {acceptedEstimate.estimate_number && (
                          <Badge variant="outline" className="font-mono">
                            #{acceptedEstimate.estimate_number}
                          </Badge>
                        )}
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                          Digitally Signed
                        </Badge>
                      </div>
                      {acceptedEstimate.estimate_title && (
                        <button
                          onClick={() => viewContractPdf()}
                          className="text-sm text-left text-primary hover:underline cursor-pointer"
                        >
                          {acceptedEstimate.estimate_title}
                          <span className="text-xs ml-1">(click to view)</span>
                        </button>
                      )}
                      <div className="flex flex-wrap items-center gap-4 text-sm">
                        {acceptedEstimate.signed_at && (
                          <span className="flex items-center gap-1.5 text-slate-500">
                            <Calendar className="h-4 w-4" />
                            Signed {format(new Date(acceptedEstimate.signed_at), 'MMM d, yyyy')}
                          </span>
                        )}
                        {acceptedEstimate.total && (
                          <span className="font-semibold text-primary">
                            {formatCurrency(acceptedEstimate.total)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="shadow-sm"
                      onClick={() => viewContractPdf()}
                      disabled={generatingContractPdf}
                    >
                      {generatingContractPdf ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Eye className="h-4 w-4 mr-2" />
                      )}
                      View PDF
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => downloadContractPdf()}
                      disabled={downloadingContractPdf}
                      aria-label="Download PDF"
                    >
                      {downloadingContractPdf ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* PDF Viewer Dialog */}
      <PdfViewerDialog
        open={!!pdfUrl}
        onOpenChange={(open) => !open && setPdfUrl(null)}
        fileUrl={pdfUrl || ''}
        fileName="Agreement Document"
      />
    </div>
  );
}