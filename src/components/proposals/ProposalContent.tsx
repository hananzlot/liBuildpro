import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatUnit } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CompanyHeader } from '@/components/proposals/CompanyHeader';
import {
  FileText,
  Calendar,
  MapPin,
  Phone,
  Mail,
  DollarSign,
  CheckCircle2,
  XCircle,
  Clock,
  Building,
  Users,
  Image as ImageIcon,
  Shield,
  Award,
  ExternalLink,
} from 'lucide-react';
import { format } from 'date-fns';

// Shared types for proposal content
export interface ProposalLineItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total: number;
  item_type: string;
  group_id: string | null;
}

export interface ProposalGroup {
  id: string;
  group_name: string;
  description: string | null;
  sort_order: number;
}

export interface ProposalPaymentPhase {
  id: string;
  phase_name: string;
  percent: number;
  amount: number;
  due_type: string;
  description: string | null;
}

export interface ProposalSignature {
  id: string;
  signer_name: string;
  signer_email: string;
  signature_type: 'typed' | 'drawn';
  signature_data: string;
  signature_font?: string;
  signed_at: string;
}

export interface ProposalPhoto {
  id: string;
  file_url: string;
  file_name: string | null;
}

export interface ProposalAttachedDocument {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string | null;
}

export interface ProposalAIAnalysis {
  project_understanding?: string[];
  assumptions?: string[];
  inclusions?: string[];
  exclusions?: string[];
  missing_info?: string[];
}

export interface ProposalEstimate {
  id: string;
  estimate_number: number | null;
  estimate_title: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  job_address: string | null;
  estimate_date: string;
  expiration_date: string | null;
  salesperson_name?: string | null;
  work_scope_description?: string | null;
  subtotal: number | null;
  discount_amount: number | null;
  tax_amount: number | null;
  tax_rate: number | null;
  total: number | null;
  deposit_required?: boolean;
  deposit_amount?: number | null;
  terms_and_conditions?: string | null;
  notes?: string | null;
  notes_to_customer?: string | null;
  status: string;
  signed_at?: string | null;
  project_id?: string | null;
  opportunity_id?: string | null;
  opportunity_uuid?: string | null;
  decline_reason?: string | null;
  show_line_items_to_customer?: boolean;
  show_details_to_customer?: boolean;
  show_scope_to_customer?: boolean;
  company_id: string | null;
  ai_analysis?: ProposalAIAnalysis | null;
}

export interface ProposalContentProps {
  estimate: ProposalEstimate;
  groups: ProposalGroup[];
  lineItems: ProposalLineItem[];
  paymentSchedule: ProposalPaymentPhase[];
  signatures: ProposalSignature[];
  photos: ProposalPhoto[];
  attachedDocuments?: ProposalAttachedDocument[];
  // Optional customization
  showStatusBanner?: boolean;
  showSalesperson?: boolean;
  showNotes?: boolean;
  // Custom sections to render before/after content
  headerContent?: React.ReactNode;
  footerContent?: React.ReactNode;
}

// Utility functions
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function getStatusBadge(status: string) {
  const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    draft: { label: 'Draft', variant: 'outline' },
    sent: { label: 'Awaiting Review', variant: 'secondary' },
    viewed: { label: 'Viewed', variant: 'secondary' },
    needs_changes: { label: 'Needs Changes', variant: 'secondary' },
    accepted: { label: 'Accepted', variant: 'default' },
    declined: { label: 'Declined', variant: 'destructive' },
    expired: { label: 'Expired', variant: 'outline' },
  };
  const config = statusConfig[status] || { label: status, variant: 'outline' };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

// De-duplicate line items based on description, quantity, unit_price, and group_id
function deduplicateItems(items: ProposalLineItem[]): ProposalLineItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.description}-${item.quantity}-${item.unit_price}-${item.group_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Render bullet points for AI analysis sections
function renderBullets(items?: string[]) {
  if (!items || items.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1 text-sm">
      {items.map((item, idx) => (
        <li key={idx} className="flex items-start gap-2">
          <span className="text-muted-foreground">•</span>
          <span className="whitespace-pre-wrap">{item}</span>
        </li>
      ))}
    </ul>
  );
}

// Insurance documents section - fetches from company_settings
export function InsuranceDocsSection({ companyId }: { companyId: string | null }) {
  const { data: insuranceDocs = [] } = useQuery({
    queryKey: ['insurance-docs-proposal', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('company_settings')
        .select('setting_key, setting_value')
        .eq('company_id', companyId)
        .like('setting_key', 'insurance_doc_%');
      if (error) return [];

      const map = new Map<string, string>();
      (data || []).forEach((s) => map.set(s.setting_key, s.setting_value || ''));

      const docs: { label: string; file_url: string; file_name: string }[] = [];

      // Default slots
      const defaults = [
        { key: 'general_liability', label: 'General Liability' },
        { key: 'workers_comp', label: 'Workers Compensation' },
      ];
      for (const slot of defaults) {
        const url = map.get(`insurance_doc_${slot.key}_url`);
        const name = map.get(`insurance_doc_${slot.key}_name`);
        if (url && url.trim()) {
          docs.push({ label: slot.label, file_url: url, file_name: name || slot.label });
        }
      }

      // Custom slots
      const customCount = parseInt(map.get('insurance_doc_custom_count') || '0', 10) || 0;
      for (let i = 1; i <= customCount; i++) {
        const url = map.get(`insurance_doc_custom_${i}_url`);
        const name = map.get(`insurance_doc_custom_${i}_name`);
        const label = map.get(`insurance_doc_custom_${i}_label`) || `Insurance Document ${i}`;
        if (url && url.trim()) {
          docs.push({ label, file_url: url, file_name: name || label });
        }
      }

      return docs;
    },
    enabled: !!companyId,
  });

  if (insuranceDocs.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Insurance Documents
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {insuranceDocs.map((doc, idx) => (
            <a
              key={idx}
              href={doc.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50 hover:bg-muted transition-colors"
            >
              <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium">{doc.label}</span>
                <span className="text-xs text-muted-foreground ml-2">({doc.file_name})</span>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </a>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// License / Certificate documents section - fetches from company_settings
export function LicenseCertsSection({ companyId }: { companyId: string | null }) {
  const { data: licenseDocs = [] } = useQuery({
    queryKey: ['license-certs-proposal', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('company_settings')
        .select('setting_key, setting_value')
        .eq('company_id', companyId)
        .like('setting_key', 'license_cert_%');
      if (error) return [];

      const map = new Map<string, string>();
      (data || []).forEach((s) => map.set(s.setting_key, s.setting_value || ''));

      const docs: { label: string; file_url: string; file_name: string }[] = [];

      // Default slot
      const gcUrl = map.get('license_cert_gc_license_url');
      const gcName = map.get('license_cert_gc_license_name');
      if (gcUrl && gcUrl.trim()) {
        docs.push({ label: 'GC License', file_url: gcUrl, file_name: gcName || 'GC License' });
      }

      // Custom slots
      const customCount = parseInt(map.get('license_cert_custom_count') || '0', 10) || 0;
      for (let i = 1; i <= customCount; i++) {
        const url = map.get(`license_cert_custom_${i}_url`);
        const name = map.get(`license_cert_custom_${i}_name`);
        const label = map.get(`license_cert_custom_${i}_label`) || `Certificate ${i}`;
        if (url && url.trim()) {
          docs.push({ label, file_url: url, file_name: name || label });
        }
      }

      return docs;
    },
    enabled: !!companyId,
  });

  if (licenseDocs.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5" />
          License / Certificate Files
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {licenseDocs.map((doc, idx) => (
            <a
              key={idx}
              href={doc.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50 hover:bg-muted transition-colors"
            >
              <Award className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium">{doc.label}</span>
                <span className="text-xs text-muted-foreground ml-2">({doc.file_name})</span>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </a>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * ProposalContent - Shared component for rendering estimate/proposal content
 * Used by both EstimatePreviewDialog (admin) and PortalEstimateView (customer)
 */
export function ProposalContent({
  estimate,
  groups,
  lineItems,
  paymentSchedule,
  signatures,
  photos,
  attachedDocuments = [],
  showStatusBanner = true,
  showSalesperson = false,
  showNotes = false,
  headerContent,
  footerContent,
}: ProposalContentProps) {
  const showLineItems = estimate.show_line_items_to_customer ?? false;
  const showDetails = estimate.show_details_to_customer ?? false;
  const showScope = estimate.show_scope_to_customer ?? false;
  const isSigned = estimate.status === 'accepted';
  const isDeclined = estimate.status === 'declined';
  const ai = estimate.ai_analysis;

  // De-duplicate and group line items
  const uniqueLineItems = deduplicateItems(lineItems);
  const groupedItems = groups.reduce((acc: Record<string, ProposalLineItem[]>, group) => {
    acc[group.id] = uniqueLineItems.filter((item) => item.group_id === group.id);
    return acc;
  }, {});
  const ungroupedItems = uniqueLineItems.filter((item) => !item.group_id);

  const hasAiAnalysis =
    !!ai &&
    ((ai.project_understanding?.length ?? 0) > 0 ||
      (ai.assumptions?.length ?? 0) > 0 ||
      (ai.inclusions?.length ?? 0) > 0 ||
      (ai.exclusions?.length ?? 0) > 0);

  return (
    <div className="space-y-6 bg-muted/30 p-6">
      {/* Company Header */}
      <CompanyHeader companyId={estimate.company_id} />

      {/* Custom header content (e.g., multi-signer progress) */}
      {headerContent}

      {/* Status Banners */}
      {showStatusBanner && isSigned && signatures.length > 0 && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="py-4 flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
            <div>
              <p className="font-medium text-green-800">Proposal Accepted</p>
              <p className="text-sm text-green-600">
                Signed by {signatures.length} {signatures.length === 1 ? 'party' : 'parties'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {showStatusBanner && isDeclined && (
        <Card className="bg-red-50 border-red-200">
          <CardContent className="py-4 flex items-center gap-3">
            <XCircle className="h-6 w-6 text-red-600" />
            <div>
              <p className="font-medium text-red-800">Proposal Declined</p>
              {estimate.decline_reason && (
                <p className="text-sm text-red-600">Reason: {estimate.decline_reason}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estimate Header Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">
                Proposal #{estimate.estimate_number}
              </p>
              <CardTitle className="text-2xl mt-1">{estimate.estimate_title}</CardTitle>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-primary">
                {formatCurrency(estimate.total)}
              </p>
              <p className="text-sm text-muted-foreground">Total Amount</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground">PREPARED FOR</h4>
              <p className="font-medium text-lg">{estimate.customer_name}</p>
              {estimate.customer_email && (
                <p className="text-sm flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  {estimate.customer_email}
                </p>
              )}
              {estimate.customer_phone && (
                <p className="text-sm flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  {estimate.customer_phone}
                </p>
              )}
              {showSalesperson && estimate.salesperson_name && (
                <p className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Sales Rep: {estimate.salesperson_name}
                </p>
              )}
            </div>
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground">PROJECT LOCATION</h4>
              {estimate.job_address && (
                <p className="text-sm flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  {estimate.job_address}
                </p>
              )}
              <div className="flex gap-4 text-sm">
                <span className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {format(new Date(estimate.estimate_date), 'MMM d, yyyy')}
                </span>
                {estimate.expiration_date && (
                  <span className="flex items-center gap-2 text-orange-600">
                    <Clock className="h-4 w-4" />
                    Expires: {format(new Date(estimate.expiration_date), 'MMM d, yyyy')}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Analysis Section */}
      {hasAiAnalysis && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Project Understanding & Assumptions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {(ai!.project_understanding?.length ?? 0) > 0 && (
              <section>
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Project Understanding
                </h4>
                {renderBullets(ai!.project_understanding)}
              </section>
            )}

            {(ai!.assumptions?.length ?? 0) > 0 && (
              <section>
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Assumptions
                </h4>
                {renderBullets(ai!.assumptions)}
              </section>
            )}

            {(((ai!.inclusions?.length ?? 0) > 0) || ((ai!.exclusions?.length ?? 0) > 0)) && (
              <section className="grid md:grid-cols-2 gap-6">
                {(ai!.inclusions?.length ?? 0) > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                      Inclusions
                    </h4>
                    {renderBullets(ai!.inclusions)}
                  </div>
                )}
                {(ai!.exclusions?.length ?? 0) > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                      Exclusions
                    </h4>
                    {renderBullets(ai!.exclusions)}
                  </div>
                )}
              </section>
            )}
          </CardContent>
        </Card>
      )}

      {/* Scope of Work - only render if there's content to show */}
      {((showScope && estimate.work_scope_description) || (showLineItems && (groups.length > 0 || ungroupedItems.length > 0))) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Scope of Work
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Work Scope Description */}
            {showScope && estimate.work_scope_description && (
              <div className="bg-muted/50 rounded-lg p-4 mb-4">
                <p className="whitespace-pre-wrap text-sm">{estimate.work_scope_description}</p>
              </div>
            )}

            {/* Grouped Line Items */}
            {showLineItems && groups.map((group) => {
              const items = groupedItems[group.id] || [];
              if (items.length === 0) return null;
              return (
                <div key={group.id} className="space-y-3">
                  <h4 className="font-semibold text-lg">{group.group_name}</h4>
                  {group.description && (
                    <p className="text-sm text-muted-foreground">{group.description}</p>
                  )}
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between items-start p-3 bg-muted/50 rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{item.description}</p>
                          {showDetails && (
                            <p className="text-sm text-muted-foreground">
                              {item.quantity}{formatUnit(item.unit) ? ` ${formatUnit(item.unit)}` : ''} × {formatCurrency(item.unit_price)}
                            </p>
                          )}
                        </div>
                        {showDetails && (
                          <p className="font-medium">{formatCurrency(item.line_total)}</p>
                        )}
                      </div>
                    ))}
                    {/* Group Subtotal */}
                    {showDetails && items.length > 0 && (
                      <div className="flex justify-between items-center pt-2 mt-2 border-t border-dashed">
                        <span className="text-sm font-medium text-muted-foreground">
                          {group.group_name} Subtotal
                        </span>
                        <span className="font-semibold">
                          {formatCurrency(
                            items.reduce((sum, item) => sum + (item.line_total || 0), 0)
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Ungrouped Line Items */}
            {showLineItems && ungroupedItems.length > 0 && (
              <div className="space-y-2">
                {ungroupedItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-start p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{item.description}</p>
                      {showDetails && (
                        <p className="text-sm text-muted-foreground">
                          {item.quantity}{formatUnit(item.unit) ? ` ${formatUnit(item.unit)}` : ''} × {formatCurrency(item.unit_price)}
                        </p>
                      )}
                    </div>
                    {showDetails && (
                      <p className="font-medium">{formatCurrency(item.line_total)}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pricing Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Pricing Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between py-2">
              <span>Subtotal</span>
              <span className="font-medium">{formatCurrency(estimate.subtotal)}</span>
            </div>
            {(estimate.discount_amount || 0) > 0 && (
              <div className="flex justify-between py-2 text-green-600">
                <span>Discount</span>
                <span>-{formatCurrency(estimate.discount_amount)}</span>
              </div>
            )}
            {(estimate.tax_amount || 0) > 0 && (
              <div className="flex justify-between py-2">
                <span>Tax ({estimate.tax_rate}%)</span>
                <span>{formatCurrency(estimate.tax_amount)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between py-3 text-lg font-bold">
              <span>Total</span>
              <span className="text-primary">{formatCurrency(estimate.total)}</span>
            </div>
            {estimate.deposit_required && (estimate.deposit_amount || 0) > 0 && (
              <div className="flex justify-between text-sm font-medium text-primary">
                <span>Deposit Due</span>
                <span>{formatCurrency(estimate.deposit_amount)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Payment Schedule */}
      {paymentSchedule.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Payment Schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {paymentSchedule.map((phase, index) => (
                <div
                  key={phase.id}
                  className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium whitespace-normal break-words">{phase.phase_name}</p>
                    {phase.description && (
                      <p className="text-sm text-muted-foreground whitespace-normal break-words">{phase.description}</p>
                    )}
                    <p className="text-sm text-muted-foreground">{phase.due_type}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatCurrency(phase.amount)}</p>
                    <p className="text-sm text-muted-foreground">{phase.percent}%</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Project Photos */}
      {photos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Project Photos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="aspect-square rounded-lg overflow-hidden border bg-muted"
                >
                  <img
                    src={photo.file_url}
                    alt={photo.file_name || 'Project photo'}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Attached Documents - shown before Notes & T&C for visibility */}
      {attachedDocuments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Attached Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {attachedDocuments.map((doc) => (
                <a
                  key={doc.id}
                  href={doc.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50 hover:bg-muted transition-colors"
                >
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium truncate">{doc.file_name}</span>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Insurance Documents */}
      <InsuranceDocsSection companyId={estimate.company_id} />

      {/* License / Certificate Files */}
      <LicenseCertsSection companyId={estimate.company_id} />

      {/* Notes to Customer */}
      {estimate.notes_to_customer && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-wrap">{estimate.notes_to_customer}</p>
          </CardContent>
        </Card>
      )}

      {/* Terms & Conditions */}
      {estimate.terms_and_conditions && (
        <Card>
          <CardHeader>
            <CardTitle>Terms & Conditions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-wrap">
              {estimate.terms_and_conditions}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Signatures Display */}
      {signatures.length > 0 && (
        <Card className="bg-green-50 border-green-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <CheckCircle2 className="h-5 w-5" />
              Digital Signatures ({signatures.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {signatures.map((sig, index) => (
              <div key={sig.id} className={`space-y-2 ${index > 0 ? 'pt-4 border-t border-green-200' : ''}`}>
                <div className="flex items-center gap-2 text-sm font-medium text-green-800">
                  <span className="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-xs">
                    {index + 1}
                  </span>
                  Signer {index + 1}
                </div>
                {sig.signature_type === 'typed' ? (
                  <p style={{ fontFamily: sig.signature_font, fontSize: '28px' }}>
                    {sig.signature_data}
                  </p>
                ) : (
                  <img src={sig.signature_data} alt={`Signature by ${sig.signer_name}`} className="max-h-20" />
                )}
                <p className="text-sm text-green-700">
                  Signed by: {sig.signer_name}
                </p>
                <p className="text-sm text-green-700">
                  Email: {sig.signer_email}
                </p>
                <p className="text-sm text-green-700">
                  Date: {format(new Date(sig.signed_at), 'MMMM d, yyyy')}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Internal Notes (usually hidden from customers) */}
      {showNotes && estimate.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Internal Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-wrap">{estimate.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Custom footer content (e.g., action buttons, comments) */}
      {footerContent}
    </div>
  );
}
