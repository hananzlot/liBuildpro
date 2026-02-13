import { useState, useRef } from "react";
import { formatUnit } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, User, MapPin, Mail, Phone, Calendar, DollarSign, FileText, Percent, PenTool, Upload, File, Trash2, Copy } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useUploadLimit } from "@/hooks/useUploadLimit";

interface EstimateDetailSheetProps {
  estimateId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface LineItem {
  id: string;
  group_id: string | null;
  item_type: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total: number;
  sort_order: number;
}

interface Group {
  id: string;
  group_name: string;
  description: string | null;
  sort_order: number;
}

interface PaymentSchedule {
  id: string;
  phase_name: string;
  amount: number;
  percent: number;
  due_type: string;
  due_date: string | null;
  description: string | null;
  sort_order: number;
}

interface Signature {
  id: string;
  signer_name: string;
  signer_email: string | null;
  signature_type: string;
  signature_data: string;
  signature_font: string | null;
  signed_at: string;
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-500",
  sent: "bg-blue-500",
  viewed: "bg-purple-500",
  needs_changes: "bg-amber-500",
  accepted: "bg-green-500",
  declined: "bg-red-500",
  expired: "bg-gray-400",
};

const statusLabels: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  needs_changes: "Needs Changes",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
};

const itemTypeLabels: Record<string, string> = {
  labor: "Labor",
  material: "Material",
  equipment: "Equipment",
  permit: "Permit",
  assembly: "Assembly",
  note: "Note",
};

export function EstimateDetailSheet({ estimateId, open, onOpenChange }: EstimateDetailSheetProps) {
  const { user, isSuperAdmin } = useAuth();
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { maxMb, validateFileSize } = useUploadLimit();

  // Fetch estimate details
  const { data: estimate, isLoading: loadingEstimate } = useQuery({
    queryKey: ["estimate", estimateId],
    queryFn: async () => {
      if (!estimateId) return null;
      const { data, error } = await supabase
        .from("estimates")
        .select("*")
        .eq("id", estimateId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!estimateId,
  });

  // Fetch groups
  const { data: groups } = useQuery({
    queryKey: ["estimate-groups", estimateId],
    queryFn: async () => {
      if (!estimateId) return [];
      const { data, error } = await supabase
        .from("estimate_groups")
        .select("*")
        .eq("estimate_id", estimateId)
        .order("sort_order");
      if (error) throw error;
      return data as Group[];
    },
    enabled: !!estimateId,
  });

  // Fetch line items
  const { data: lineItems } = useQuery({
    queryKey: ["estimate-line-items", estimateId],
    queryFn: async () => {
      if (!estimateId) return [];
      const { data, error } = await supabase
        .from("estimate_line_items")
        .select("*")
        .eq("estimate_id", estimateId)
        .order("sort_order");
      if (error) throw error;
      return data as LineItem[];
    },
    enabled: !!estimateId,
  });

  // Fetch payment schedule
  const { data: paymentSchedule } = useQuery({
    queryKey: ["estimate-payment-schedule", estimateId],
    queryFn: async () => {
      if (!estimateId) return [];
      const { data, error } = await supabase
        .from("estimate_payment_schedule")
        .select("*")
        .eq("estimate_id", estimateId)
        .order("sort_order");
      if (error) throw error;
      return data as PaymentSchedule[];
    },
    enabled: !!estimateId,
  });

  // Fetch signature if exists
  const { data: signature } = useQuery({
    queryKey: ["estimate-signature", estimateId],
    queryFn: async () => {
      if (!estimateId) return null;
      const { data, error } = await supabase
        .from("estimate_signatures")
        .select("*")
        .eq("estimate_id", estimateId)
        .maybeSingle();
      if (error) throw error;
      return data as Signature | null;
    },
    enabled: !!estimateId,
  });

  // Fetch documents linked to the project (if estimate has project_id)
  const projectId = estimate?.project_id;
  const { data: documents = [] } = useQuery({
    queryKey: ["proposal-documents", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("project_documents")
        .select("*")
        .eq("project_id", projectId)
        .eq("category", "Proposal Documents")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  // Upload document mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!projectId) throw new Error("No project linked to this estimate");
      
      setIsUploading(true);
      
      // Upload to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${projectId}/proposal-docs/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("project-attachments")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("project-attachments")
        .getPublicUrl(uploadData.path);

      // Create document record
      const { error: insertError } = await supabase
        .from("project_documents")
        .insert({
          project_id: projectId,
          file_name: file.name,
          file_url: publicUrl,
          file_type: file.type,
          category: "Proposal Documents",
          notes: `Uploaded for estimate #${estimate?.estimate_number}`,
          uploaded_by: user?.id || null,
          company_id: companyId,
        });

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposal-documents", projectId] });
      toast.success("Document uploaded successfully");
      setIsUploading(false);
    },
    onError: (error) => {
      toast.error(`Upload failed: ${error.message}`);
      setIsUploading(false);
    },
  });

  // Delete document mutation
  const deleteMutation = useMutation({
    mutationFn: async (docId: string) => {
      const { error } = await supabase
        .from("project_documents")
        .delete()
        .eq("id", docId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposal-documents", projectId] });
      toast.success("Document deleted");
    },
    onError: (error) => {
      toast.error(`Delete failed: ${error.message}`);
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!validateFileSize(file)) {
      toast.error(`File size must be less than ${maxMb}MB`);
      return;
    }
    
    uploadMutation.mutate(file);
    e.target.value = ''; // Reset input
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Group line items by group
  const groupedItems = groups?.map((group) => ({
    ...group,
    items: lineItems?.filter((item) => item.group_id === group.id) || [],
  })) || [];

  const ungroupedItems = lineItems?.filter((item) => !item.group_id) || [];

  if (loadingEstimate) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  if (!estimate) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-xl">
              Estimate #{estimate.estimate_number}
            </SheetTitle>
            <div className="flex items-center gap-2">
              {isSuperAdmin && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-7 text-muted-foreground" 
                  onClick={() => {
                    const debugInfo = `Estimate ID: ${estimate.id}\nEstimate #: ${estimate.estimate_number}\nOpportunity ID: ${estimate.opportunity_id || 'null'}\nOpportunity UUID: ${estimate.opportunity_uuid || 'null'}\nProject ID: ${estimate.project_id || 'null'}\nContact ID: ${estimate.contact_id || 'null'}\nContact UUID: ${estimate.contact_uuid || 'null'}`;
                    navigator.clipboard.writeText(debugInfo);
                    toast.success("Debug info copied to clipboard");
                  }}
                >
                  <Copy className="h-3.5 w-3.5 mr-1" />
                  Debug
                </Button>
              )}
              <Badge className={`${statusColors[estimate.status]} text-white`}>
                {statusLabels[estimate.status]}
              </Badge>
            </div>
          </div>
          <SheetDescription>{estimate.estimate_title}</SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          {/* Customer Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4" />
                Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <div className="font-semibold">{estimate.customer_name}</div>
              {estimate.customer_email && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-3 w-3" />
                  {estimate.customer_email}
                </div>
              )}
              {estimate.customer_phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  {estimate.customer_phone}
                </div>
              )}
              {estimate.job_address && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {estimate.job_address}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Decline Reason */}
          {estimate.status === 'declined' && estimate.decline_reason && (
            <Card className="border-destructive bg-destructive/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-destructive">
                  <FileText className="h-4 w-4" />
                  Decline Reason
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{estimate.decline_reason}</p>
                {estimate.declined_at && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Declined on {format(new Date(estimate.declined_at), "MMMM d, yyyy 'at' h:mm a")}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Signature - for accepted contracts */}
          {estimate.status === 'accepted' && signature && (
            <Card className="border-green-200 bg-green-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-green-800">
                  <PenTool className="h-4 w-4" />
                  Customer Signature
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="bg-white rounded-lg p-4 border">
                  {signature.signature_type === 'drawn' ? (
                    <img 
                      src={signature.signature_data} 
                      alt="Customer signature" 
                      className="max-h-24 mx-auto"
                    />
                  ) : (
                    <p 
                      className="text-2xl text-center"
                      style={{ fontFamily: signature.signature_font || 'cursive' }}
                    >
                      {signature.signature_data}
                    </p>
                  )}
                </div>
                <div className="text-sm text-green-700">
                  <p><strong>Signed by:</strong> {signature.signer_name}</p>
                  {signature.signer_email && <p><strong>Email:</strong> {signature.signer_email}</p>}
                  <p><strong>Signed on:</strong> {format(new Date(signature.signed_at), "MMMM d, yyyy 'at' h:mm a")}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Dates */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Dates
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Estimate Date:</span>
                <div className="font-medium">{format(new Date(estimate.estimate_date), "MMMM d, yyyy")}</div>
              </div>
              {estimate.expiration_date && (
                <div>
                  <span className="text-muted-foreground">Expires:</span>
                  <div className="font-medium">{format(new Date(estimate.expiration_date), "MMMM d, yyyy")}</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Scope of Work */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Scope of Work
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {groupedItems.map((group) => (
                <div key={group.id} className="space-y-2">
                  <h4 className="font-semibold text-sm border-b pb-1">{group.group_name}</h4>
                  {group.description && (
                    <p className="text-xs text-muted-foreground">{group.description}</p>
                  )}
                  <div className="space-y-1">
                    {group.items.map((item) => (
                      <div key={item.id} className="flex justify-between items-start text-sm py-1">
                        <div className="flex-1">
                          <span className="text-xs text-muted-foreground mr-2">
                            [{itemTypeLabels[item.item_type]}]
                          </span>
                          <span>{item.description}</span>
                          <span className="text-muted-foreground ml-2">
                            ({item.quantity}{formatUnit(item.unit) ? ` ${formatUnit(item.unit)}` : ''} × {formatCurrency(item.unit_price)})
                          </span>
                        </div>
                        <span className="font-medium ml-4">{formatCurrency(item.line_total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {ungroupedItems.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm border-b pb-1">Other Items</h4>
                  <div className="space-y-1">
                    {ungroupedItems.map((item) => (
                      <div key={item.id} className="flex justify-between items-start text-sm py-1">
                        <div className="flex-1">
                          <span className="text-xs text-muted-foreground mr-2">
                            [{itemTypeLabels[item.item_type]}]
                          </span>
                          <span>{item.description}</span>
                          <span className="text-muted-foreground ml-2">
                            ({item.quantity}{formatUnit(item.unit) ? ` ${formatUnit(item.unit)}` : ''} × {formatCurrency(item.unit_price)})
                          </span>
                        </div>
                        <span className="font-medium ml-4">{formatCurrency(item.line_total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Schedule */}
          {paymentSchedule && paymentSchedule.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Percent className="h-4 w-4" />
                  Payment Schedule
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {paymentSchedule.map((phase) => (
                  <div key={phase.id} className="flex justify-between items-center text-sm py-1 border-b last:border-0">
                    <div className="min-w-0 flex-1">
                      <span className="font-medium whitespace-normal break-words">{phase.phase_name}</span>
                      {phase.description && (
                        <p className="text-xs text-muted-foreground whitespace-normal break-words">{phase.description}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="font-semibold">{phase.percent}%</span>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency((estimate.total * phase.percent) / 100)}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Totals */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Totals
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(estimate.subtotal)}</span>
              </div>
              {estimate.tax_amount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax ({estimate.tax_rate}%)</span>
                  <span>{formatCurrency(estimate.tax_amount)}</span>
                </div>
              )}
              {estimate.discount_amount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-{formatCurrency(estimate.discount_amount)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>{formatCurrency(estimate.total)}</span>
              </div>
              {estimate.deposit_required && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Deposit</span>
                  <span>{formatCurrency(Math.min((estimate.total * estimate.deposit_percent) / 100, (estimate as any).deposit_max_amount || 1000))}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Documents Upload - only show if estimate has a linked project */}
          {projectId && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Proposal Documents
                  </CardTitle>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Upload className="h-4 w-4 mr-1" />
                    )}
                    Upload
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                    onChange={handleFileSelect}
                  />
                </div>
              </CardHeader>
              <CardContent>
                {documents.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No documents uploaded yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {documents.map((doc) => (
                      <div 
                        key={doc.id} 
                        className="flex items-center justify-between p-2 rounded-md border bg-muted/30"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <File className="h-4 w-4 text-muted-foreground shrink-0" />
                          <a 
                            href={doc.file_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm truncate hover:underline text-primary"
                          >
                            {doc.file_name}
                          </a>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => deleteMutation.mutate(doc.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          {estimate.notes && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{estimate.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
