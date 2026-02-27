import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Check } from "lucide-react";
import { MultiSelectFilter } from "@/components/dashboard/MultiSelectFilter";
import { FileUpload } from "./FileUpload";
import { PdfViewerDialog } from "./PdfViewerDialog";

const SUBCONTRACTOR_TYPES = ['Material/Equipment', 'Other', 'Subcontractor'] as const;
type SubcontractorType = typeof SUBCONTRACTOR_TYPES[number];

interface SubcontractorEditDialogProps {
  subcontractorId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function SubcontractorEditDialog({ subcontractorId, open, onOpenChange, onSaved }: SubcontractorEditDialogProps) {
  const { user, isSuperAdmin } = useAuth();
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();

  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<{ url: string; name: string } | null>(null);

  const [formData, setFormData] = useState({
    company_name: "",
    contact_name: "",
    phone: "",
    email: "",
    address: "",
    license_number: "",
    license_expiration_date: "",
    license_document_url: "",
    insurance_expiration_date: "",
    insurance_document_url: "",
    notes: "",
    is_active: true,
    do_not_require_license: false,
    do_not_require_insurance: false,
    subcontractor_type: 'Subcontractor' as SubcontractorType,
    trade: [] as string[],
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Fetch subcontractor data
  const { data: subcontractor } = useQuery({
    queryKey: ["subcontractor-edit", subcontractorId],
    queryFn: async () => {
      if (!subcontractorId) return null;
      const { data, error } = await supabase
        .from("subcontractors")
        .select("*")
        .eq("id", subcontractorId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!subcontractorId && open,
  });

  // Fetch trades
  const { data: tradesData = [] } = useQuery({
    queryKey: ["trades", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trades")
        .select("name")
        .order("name", { ascending: true });
      if (error) throw error;
      return data.map(t => t.name);
    },
    enabled: !!companyId && open,
  });

  const addTradeMutation = useMutation({
    mutationFn: async (tradeName: string) => {
      const { error } = await supabase
        .from("trades")
        .insert({ name: tradeName, created_by: user?.id, company_id: companyId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Trade added");
      queryClient.invalidateQueries({ queryKey: ["trades", companyId] });
    },
    onError: (error) => toast.error(`Failed to add trade: ${error.message}`),
  });

  // Populate form when subcontractor loads
  useEffect(() => {
    if (subcontractor && open) {
      setFormData({
        company_name: subcontractor.company_name || "",
        contact_name: subcontractor.contact_name || "",
        phone: subcontractor.phone || "",
        email: subcontractor.email || "",
        address: subcontractor.address || "",
        license_number: subcontractor.license_number || "",
        license_expiration_date: subcontractor.license_expiration_date || "",
        license_document_url: subcontractor.license_document_url || "",
        insurance_expiration_date: subcontractor.insurance_expiration_date || "",
        insurance_document_url: subcontractor.insurance_document_url || "",
        notes: subcontractor.notes || "",
        is_active: subcontractor.is_active,
        do_not_require_license: subcontractor.do_not_require_license,
        do_not_require_insurance: subcontractor.do_not_require_insurance,
        subcontractor_type: subcontractor.subcontractor_type as SubcontractorType,
        trade: subcontractor.trade || [],
      });
      setFormErrors({});
    }
  }, [subcontractor, open]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.company_name.trim()) errors.company_name = "Company name is required";
    const needsLicenseInsurance = formData.subcontractor_type === 'Subcontractor';
    if (needsLicenseInsurance && !formData.do_not_require_license) {
      if (!formData.license_expiration_date) errors.license_expiration_date = "License expiration date is required";
      if (!formData.license_document_url) errors.license_document_url = "License document is required";
    }
    if (needsLicenseInsurance && !formData.do_not_require_insurance) {
      if (!formData.insurance_expiration_date) errors.insurance_expiration_date = "Insurance expiration date is required";
      if (!formData.insurance_document_url) errors.insurance_document_url = "Insurance document is required";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!subcontractorId) return;
      const needsLicenseInsurance = data.subcontractor_type === 'Subcontractor';
      const skipLicense = !needsLicenseInsurance || data.do_not_require_license;
      const skipInsurance = !needsLicenseInsurance || data.do_not_require_insurance;

      const payload = {
        company_name: data.company_name.trim(),
        contact_name: data.contact_name.trim() || null,
        phone: data.phone.trim() || null,
        email: data.email.trim() || null,
        address: data.address.trim() || null,
        license_number: data.license_number.trim() || null,
        license_expiration_date: skipLicense ? null : (data.license_expiration_date || null),
        license_document_url: skipLicense ? null : (data.license_document_url || null),
        insurance_expiration_date: skipInsurance ? null : (data.insurance_expiration_date || null),
        insurance_document_url: skipInsurance ? null : (data.insurance_document_url || null),
        notes: data.notes.trim() || null,
        is_active: data.is_active,
        do_not_require_license: data.do_not_require_license,
        do_not_require_insurance: data.do_not_require_insurance,
        subcontractor_type: data.subcontractor_type,
        trade: data.subcontractor_type === 'Subcontractor' && data.trade.length > 0 ? data.trade : null,
        needs_compliance_review: false,
      };

      const { error } = await supabase
        .from("subcontractors")
        .update(payload)
        .eq("id", subcontractorId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Subcontractor updated");
      queryClient.invalidateQueries({ queryKey: ["subcontractors"] });
      queryClient.invalidateQueries({ queryKey: ["active-subcontractors"] });
      queryClient.invalidateQueries({ queryKey: ["subcontractors-active"] });
      onOpenChange(false);
      onSaved?.();
    },
    onError: (error) => toast.error(`Failed: ${error.message}`),
  });

  const handleSubmit = () => {
    if (!validateForm()) return;
    saveMutation.mutate(formData);
  };

  const handleFileUploaded = (field: 'license_document_url' | 'insurance_document_url', url: string) => {
    setFormData(prev => ({ ...prev, [field]: url }));
    setFormErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Subcontractor</DialogTitle>
            <DialogDescription>
              Update subcontractor information and compliance documents
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Type & Trade Row */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Select
                  value={formData.subcontractor_type}
                  onValueChange={(value: SubcontractorType) => {
                    setFormData(prev => ({ ...prev, subcontractor_type: value }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Type *" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBCONTRACTOR_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.subcontractor_type !== 'Subcontractor' && (
                  <p className="text-xs text-muted-foreground">
                    License/insurance not required for {formData.subcontractor_type}.
                  </p>
                )}
              </div>
              {formData.subcontractor_type === 'Subcontractor' && (
                <div>
                  <MultiSelectFilter
                    options={tradesData.map(t => ({ value: t, label: t }))}
                    selected={formData.trade}
                    onChange={(selected) => setFormData(prev => ({ ...prev, trade: selected }))}
                    placeholder="Trade(s)"
                    className="w-full"
                    onAddNew={isSuperAdmin ? (value) => {
                      if (!tradesData.includes(value)) addTradeMutation.mutate(value);
                    } : undefined}
                    addNewLabel="Add new trade..."
                  />
                </div>
              )}
            </div>

            {/* Company Info */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Input
                  placeholder="Company Name *"
                  value={formData.company_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
                  className={formErrors?.company_name ? "border-destructive" : ""}
                />
                {formErrors?.company_name && <p className="text-xs text-destructive">{formErrors.company_name}</p>}
              </div>
              <Input
                placeholder="Contact Name"
                value={formData.contact_name}
                onChange={(e) => setFormData(prev => ({ ...prev, contact_name: e.target.value }))}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                type="tel"
                placeholder="Phone"
                value={formData.phone}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                  let formatted = '';
                  if (digits.length > 0) formatted += '(' + digits.slice(0, 3);
                  if (digits.length >= 3) formatted += ') ';
                  if (digits.length > 3) formatted += digits.slice(3, 6);
                  if (digits.length > 6) formatted += '-' + digits.slice(6);
                  setFormData(prev => ({ ...prev, phone: formatted }));
                }}
              />
              <Input
                type="email"
                placeholder="Email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>

            <Input
              placeholder="Address"
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
            />

            {/* License Section */}
            {formData.subcontractor_type === 'Subcontractor' && (
              <div className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">License Information {!formData.do_not_require_license && '*'}</h4>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="edit_do_not_require_license"
                      checked={formData.do_not_require_license}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, do_not_require_license: checked }))}
                    />
                    <Label htmlFor="edit_do_not_require_license" className="text-sm text-muted-foreground">Not required</Label>
                  </div>
                </div>
                {!formData.do_not_require_license ? (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>License Number</Label>
                        <Input value={formData.license_number} onChange={(e) => setFormData(prev => ({ ...prev, license_number: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Expiration Date *</Label>
                        <Input
                          type="date"
                          value={formData.license_expiration_date}
                          onChange={(e) => setFormData(prev => ({ ...prev, license_expiration_date: e.target.value }))}
                          className={formErrors.license_expiration_date ? "border-destructive" : ""}
                        />
                        {formErrors.license_expiration_date && <p className="text-xs text-destructive">{formErrors.license_expiration_date}</p>}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>License Document (PDF) *</Label>
                      {formData.license_document_url ? (
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-emerald-600" />
                          <span className="text-sm text-emerald-600">Document uploaded</span>
                          <Button variant="outline" size="sm" onClick={() => { setSelectedDocument({ url: formData.license_document_url, name: "License Document" }); setPdfViewerOpen(true); }}>View</Button>
                          <Button variant="ghost" size="sm" onClick={() => setFormData(prev => ({ ...prev, license_document_url: "" }))}>Replace</Button>
                        </div>
                      ) : (
                        <FileUpload projectId="subcontractor-licenses" currentUrl={null} onUpload={(url) => url && handleFileUploaded('license_document_url', url)} folder="licenses" accept=".pdf,application/pdf" />
                      )}
                      {formErrors.license_document_url && <p className="text-xs text-destructive">{formErrors.license_document_url}</p>}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">License documentation is not required for this subcontractor.</p>
                )}
              </div>
            )}

            {/* Insurance Section */}
            {formData.subcontractor_type === 'Subcontractor' && (
              <div className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Insurance Information {!formData.do_not_require_insurance && '*'}</h4>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="edit_do_not_require_insurance"
                      checked={formData.do_not_require_insurance}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, do_not_require_insurance: checked }))}
                    />
                    <Label htmlFor="edit_do_not_require_insurance" className="text-sm text-muted-foreground">Not required</Label>
                  </div>
                </div>
                {!formData.do_not_require_insurance ? (
                  <>
                    <div className="space-y-2">
                      <Label>Expiration Date *</Label>
                      <Input
                        type="date"
                        value={formData.insurance_expiration_date}
                        onChange={(e) => setFormData(prev => ({ ...prev, insurance_expiration_date: e.target.value }))}
                        className={formErrors.insurance_expiration_date ? "border-destructive" : ""}
                      />
                      {formErrors.insurance_expiration_date && <p className="text-xs text-destructive">{formErrors.insurance_expiration_date}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label>Insurance Document (PDF) *</Label>
                      {formData.insurance_document_url ? (
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-emerald-600" />
                          <span className="text-sm text-emerald-600">Document uploaded</span>
                          <Button variant="outline" size="sm" onClick={() => { setSelectedDocument({ url: formData.insurance_document_url, name: "Insurance Document" }); setPdfViewerOpen(true); }}>View</Button>
                          <Button variant="ghost" size="sm" onClick={() => setFormData(prev => ({ ...prev, insurance_document_url: "" }))}>Replace</Button>
                        </div>
                      ) : (
                        <FileUpload projectId="subcontractor-insurance" currentUrl={null} onUpload={(url) => url && handleFileUploaded('insurance_document_url', url)} folder="insurance" accept=".pdf,application/pdf" />
                      )}
                      {formErrors.insurance_document_url && <p className="text-xs text-destructive">{formErrors.insurance_document_url}</p>}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Insurance documentation is not required for this subcontractor.</p>
                )}
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))} rows={3} />
            </div>

            {/* Active Status */}
            <div className="flex items-center gap-2">
              <Switch id="edit_is_active" checked={formData.is_active} onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))} />
              <Label htmlFor="edit_is_active">Active (available for selection in bills)</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update Subcontractor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedDocument && (
        <PdfViewerDialog
          open={pdfViewerOpen}
          onOpenChange={setPdfViewerOpen}
          fileUrl={selectedDocument.url}
          fileName={selectedDocument.name}
        />
      )}
    </>
  );
}
