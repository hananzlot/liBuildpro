import { useState, useEffect, useCallback, useRef } from "react";
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
import { toast } from "sonner";
import { Loader2, Check, HardHat } from "lucide-react";
import { MultiSelectFilter } from "@/components/dashboard/MultiSelectFilter";
import { FileUpload } from "./FileUpload";
import { PdfViewerDialog } from "./PdfViewerDialog";
import {
  useSubcontractorEditorStore,
  DEFAULT_FORM_DATA,
  type SubcontractorFormData,
} from "@/stores/subcontractorEditorStore";

const SUBCONTRACTOR_TYPES = ['Material/Equipment', 'Other', 'Subcontractor'] as const;
type SubcontractorType = typeof SUBCONTRACTOR_TYPES[number];

interface SubcontractorEditorContentProps {
  subcontractorId?: string | null;
  onClose: () => void;
  onSuccess?: (savedId?: string) => void;
}

export function SubcontractorEditorContent({ subcontractorId, onClose, onSuccess }: SubcontractorEditorContentProps) {
  const { user, isSuperAdmin } = useAuth();
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();
  const isNew = !subcontractorId;
  const draftKey = subcontractorId || "new";

  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<{ url: string; name: string } | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Use Zustand store for form data persistence across tab switches
  const { drafts, setDraft, updateDraft, clearDraft } = useSubcontractorEditorStore();
  const formData = drafts[draftKey] || DEFAULT_FORM_DATA;
  const setFormData = useCallback(
    (updater: SubcontractorFormData | ((prev: SubcontractorFormData) => SubcontractorFormData)) => {
      if (typeof updater === "function") {
        const current = useSubcontractorEditorStore.getState().drafts[draftKey] || DEFAULT_FORM_DATA;
        setDraft(draftKey, updater(current));
      } else {
        setDraft(draftKey, updater);
      }
    },
    [draftKey, setDraft]
  );

  // Fetch subcontractor data for editing
  const { data: subcontractor, isLoading } = useQuery({
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
    enabled: !!subcontractorId,
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
    enabled: !!companyId,
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

  // Populate form from server data only if no draft exists yet
  const populatedRef = useRef(false);
  useEffect(() => {
    if (subcontractor && !populatedRef.current) {
      // Only populate if no existing draft (user hasn't started editing)
      const existingDraft = useSubcontractorEditorStore.getState().drafts[draftKey];
      if (!existingDraft) {
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
      }
      populatedRef.current = true;
      setFormErrors({});
    }
  }, [subcontractor, draftKey, setFormData]);

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
      };

      if (subcontractorId) {
        const { error } = await supabase
          .from("subcontractors")
          .update({ ...payload, needs_compliance_review: false })
          .eq("id", subcontractorId);
        if (error) throw error;
        return subcontractorId;
      } else {
        const { data: inserted, error } = await supabase
          .from("subcontractors")
          .insert({ ...payload, created_by: user?.id, company_id: companyId })
          .select("id")
          .single();
        if (error) throw error;
        return inserted.id;
      }
    },
    onSuccess: (savedId) => {
      toast.success(isNew ? "Subcontractor added" : "Subcontractor updated");
      clearDraft(draftKey);
      queryClient.invalidateQueries({ queryKey: ["subcontractors"] });
      queryClient.invalidateQueries({ queryKey: ["active-subcontractors"] });
      queryClient.invalidateQueries({ queryKey: ["subcontractors-active"] });
      onSuccess?.(savedId);
      onClose();
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <HardHat className="h-5 w-5 text-muted-foreground" />
          <div>
            <h1 className="text-lg font-semibold">
              {isNew ? "Add Subcontractor" : `Edit: ${subcontractor?.company_name || "Subcontractor"}`}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isNew
                ? "Add a new vendor/subcontractor with required documents"
                : "Update subcontractor information and compliance documents"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => { clearDraft(draftKey); onClose(); }}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
            {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isNew ? "Add" : "Update"} Subcontractor
          </Button>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">
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
                    id="page_do_not_require_license"
                    checked={formData.do_not_require_license}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, do_not_require_license: checked }))}
                  />
                  <Label htmlFor="page_do_not_require_license" className="text-sm text-muted-foreground">Not required</Label>
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
                    id="page_do_not_require_insurance"
                    checked={formData.do_not_require_insurance}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, do_not_require_insurance: checked }))}
                  />
                  <Label htmlFor="page_do_not_require_insurance" className="text-sm text-muted-foreground">Not required</Label>
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
            <Switch id="page_is_active" checked={formData.is_active} onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))} />
            <Label htmlFor="page_is_active">Active (available for selection in bills)</Label>
          </div>
        </div>
      </div>

      {/* PDF Viewer */}
      {selectedDocument && (
        <PdfViewerDialog
          open={pdfViewerOpen}
          onOpenChange={setPdfViewerOpen}
          fileUrl={selectedDocument.url}
          fileName={selectedDocument.name}
        />
      )}
    </div>
  );
}
