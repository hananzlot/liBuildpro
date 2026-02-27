import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, FileText, AlertTriangle, Check } from "lucide-react";
import { MultiSelectFilter } from "@/components/dashboard/MultiSelectFilter";
import { FileUpload } from "./FileUpload";
import { PdfViewerDialog } from "./PdfViewerDialog";
import { format, differenceInDays, parseISO } from "date-fns";

const SUBCONTRACTOR_TYPES = ['Material/Equipment', 'Other', 'Subcontractor'] as const;
type SubcontractorType = typeof SUBCONTRACTOR_TYPES[number];
// Trades are now fetched from database

interface Subcontractor {
  id: string;
  company_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  license_number: string | null;
  license_expiration_date: string | null;
  license_document_url: string | null;
  insurance_expiration_date: string | null;
  insurance_document_url: string | null;
  notes: string | null;
  is_active: boolean;
  do_not_require_license: boolean;
  do_not_require_insurance: boolean;
  subcontractor_type: SubcontractorType;
  trade: string[] | null;
  created_at: string;
}

const formatDate = (date: string | null) => {
  if (!date) return "-";
  return format(parseISO(date), "MMM d, yyyy");
};

const getExpirationStatus = (expirationDate: string | null): { status: 'ok' | 'warning' | 'expired' | 'na'; daysLeft: number } => {
  if (!expirationDate) return { status: 'na', daysLeft: 0 };
  const today = new Date();
  const expDate = parseISO(expirationDate);
  const daysLeft = differenceInDays(expDate, today);
  
  if (daysLeft < 0) return { status: 'expired', daysLeft };
  if (daysLeft <= 30) return { status: 'warning', daysLeft };
  return { status: 'ok', daysLeft };
};

interface SubcontractorsManagementProps {
  onSubcontractorAdded?: () => void;
  autoOpenAdd?: boolean;
}

export function SubcontractorsManagement({ onSubcontractorAdded, autoOpenAdd }: SubcontractorsManagementProps = {}) {
  const queryClient = useQueryClient();
  const { user, isSuperAdmin } = useAuth();
  const { companyId } = useCompanyContext();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingSubcontractor, setEditingSubcontractor] = useState<Subcontractor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Subcontractor | null>(null);
  const [deleteHasPaidBills, setDeleteHasPaidBills] = useState(false);
  const [checkingPaidBills, setCheckingPaidBills] = useState(false);
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<{ url: string; name: string } | null>(null);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Auto-open the add dialog if requested (from bill flow)
  useEffect(() => {
    if (autoOpenAdd && !hasAutoOpened) {
      setDialogOpen(true);
      setEditingSubcontractor(null);
      setHasAutoOpened(true);
    }
  }, [autoOpenAdd, hasAutoOpened]);

  // Form state
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

  // Determine if license/insurance are required based on type
  const requiresLicenseAndInsurance = formData.subcontractor_type === 'Subcontractor';

  // Fetch trades from database
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

  // Add trade mutation (super admin only)
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

  // Fetch subcontractors
  const { data: subcontractors = [], isLoading } = useQuery({
    queryKey: ["subcontractors", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subcontractors")
        .select("*")
        .eq("company_id", companyId)
        .order("company_name", { ascending: true });
      if (error) throw error;
      return data as Subcontractor[];
    },
    enabled: !!companyId,
  });

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (dialogOpen && editingSubcontractor) {
      setFormData({
        company_name: editingSubcontractor.company_name,
        contact_name: editingSubcontractor.contact_name || "",
        phone: editingSubcontractor.phone || "",
        email: editingSubcontractor.email || "",
        address: editingSubcontractor.address || "",
        license_number: editingSubcontractor.license_number || "",
        license_expiration_date: editingSubcontractor.license_expiration_date || "",
        license_document_url: editingSubcontractor.license_document_url || "",
        insurance_expiration_date: editingSubcontractor.insurance_expiration_date || "",
        insurance_document_url: editingSubcontractor.insurance_document_url || "",
        notes: editingSubcontractor.notes || "",
        is_active: editingSubcontractor.is_active,
        do_not_require_license: editingSubcontractor.do_not_require_license,
        do_not_require_insurance: editingSubcontractor.do_not_require_insurance,
        subcontractor_type: editingSubcontractor.subcontractor_type,
        trade: editingSubcontractor.trade || [],
      });
      setFormErrors({});
    } else if (dialogOpen) {
      setFormData({
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
        subcontractor_type: 'Subcontractor',
        trade: [],
      });
      setFormErrors({});
    }
  }, [dialogOpen, editingSubcontractor]);

  // Validate form
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.company_name.trim()) {
      errors.company_name = "Company name is required";
    }
    
    // License and insurance only required for "Subcontractor" type AND if not manually exempted
    const needsLicenseInsurance = formData.subcontractor_type === 'Subcontractor';
    
    // License validation - only required for Subcontractor type and if not exempted
    if (needsLicenseInsurance && !formData.do_not_require_license) {
      if (!formData.license_expiration_date) {
        errors.license_expiration_date = "License expiration date is required";
      }
      if (!formData.license_document_url) {
        errors.license_document_url = "License document is required";
      }
    }
    
    // Insurance validation - only required for Subcontractor type and if not exempted
    if (needsLicenseInsurance && !formData.do_not_require_insurance) {
      if (!formData.insurance_expiration_date) {
        errors.insurance_expiration_date = "Insurance expiration date is required";
      }
      if (!formData.insurance_document_url) {
        errors.insurance_document_url = "Insurance document is required";
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Save mutation
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

      if (editingSubcontractor) {
        const { error } = await supabase
          .from("subcontractors")
          .update(payload)
          .eq("id", editingSubcontractor.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("subcontractors")
          .insert({ ...payload, created_by: user?.id, company_id: companyId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingSubcontractor ? "Subcontractor updated" : "Subcontractor added");
      queryClient.invalidateQueries({ queryKey: ["subcontractors", companyId] });
      queryClient.invalidateQueries({ queryKey: ["active-subcontractors", companyId] });
      setDialogOpen(false);
      setEditingSubcontractor(null);
      
      // If we're adding a new subcontractor and have a callback, call it
      if (!editingSubcontractor && onSubcontractorAdded) {
        onSubcontractorAdded();
      }
    },
    onError: (error) => toast.error(`Failed: ${error.message}`),
  });

  // Check if subcontractor has paid bills
  const checkForPaidBills = async (companyName: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from("project_bills")
      .select("id, bill_payments(id)")
      .eq("installer_company", companyName)
      .not("bill_payments", "is", null);
    
    if (error) {
      console.error("Error checking paid bills:", error);
      return false;
    }
    
    // Check if any bill has at least one payment
    return data?.some(bill => bill.bill_payments && (bill.bill_payments as any[]).length > 0) ?? false;
  };

  const handleDeleteClick = async (sub: Subcontractor) => {
    setDeleteTarget(sub);
    setCheckingPaidBills(true);
    setDeleteDialogOpen(true);
    
    const hasPaidBills = await checkForPaidBills(sub.company_name);
    setDeleteHasPaidBills(hasPaidBills);
    setCheckingPaidBills(false);
  };

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleteTarget) return;
      
      // Double-check for paid bills before deletion
      const hasPaidBills = await checkForPaidBills(deleteTarget.company_name);
      if (hasPaidBills) {
        throw new Error("Cannot delete subcontractor with paid bills");
      }
      
      const { error } = await supabase
        .from("subcontractors")
        .delete()
        .eq("id", deleteTarget.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Subcontractor deleted");
      queryClient.invalidateQueries({ queryKey: ["subcontractors", companyId] });
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      setDeleteHasPaidBills(false);
    },
    onError: (error) => toast.error(`Failed: ${error.message}`),
  });

  // Toggle active status
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("subcontractors")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subcontractors", companyId] });
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

  const activeSubcontractors = subcontractors.filter(s => s.is_active);
  const inactiveSubcontractors = subcontractors.filter(s => !s.is_active);

  // Count warnings - only for subcontractors that require the documents
  const expiringCount = subcontractors.filter(s => {
    if (!s.is_active) return false;
    
    const licenseStatus = !s.do_not_require_license ? getExpirationStatus(s.license_expiration_date) : { status: 'na' as const, daysLeft: 0 };
    const insuranceStatus = !s.do_not_require_insurance ? getExpirationStatus(s.insurance_expiration_date) : { status: 'na' as const, daysLeft: 0 };
    
    return (licenseStatus.status !== 'ok' && licenseStatus.status !== 'na') || 
           (insuranceStatus.status !== 'ok' && insuranceStatus.status !== 'na');
  }).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Vendors & Subs</h2>
          <p className="text-muted-foreground">
            Manage your vendors and subcontractors with license and insurance tracking
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={(v: 'all' | 'active' | 'inactive') => setStatusFilter(v)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ({subcontractors.length})</SelectItem>
              <SelectItem value="active">Active ({activeSubcontractors.length})</SelectItem>
              <SelectItem value="inactive">Inactive ({inactiveSubcontractors.length})</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => { setEditingSubcontractor(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Subcontractor
          </Button>
        </div>
      </div>

      {expiringCount > 0 && (
        <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="flex items-center gap-3 py-3">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <span className="text-sm text-amber-800 dark:text-amber-200">
              {expiringCount} subcontractor{expiringCount !== 1 ? 's' : ''} with expiring or expired documents
            </span>
          </CardContent>
        </Card>
      )}

      {(statusFilter === 'all' || statusFilter === 'active') && (
      <Card>
        <CardHeader>
          <CardTitle>Active Subcontractors ({activeSubcontractors.length})</CardTitle>
          <CardDescription>
            These subcontractors are available for selection in project bills
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : activeSubcontractors.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No active subcontractors. Add one to get started.
            </p>
          ) : (
            <div className="overflow-auto max-h-[calc(100vh-280px)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Trade(s)</TableHead>
                  <TableHead>License Exp.</TableHead>
                  <TableHead>Insurance Exp.</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeSubcontractors.map((sub) => {
                  const licenseStatus = getExpirationStatus(sub.license_expiration_date);
                  const insuranceStatus = getExpirationStatus(sub.insurance_expiration_date);

                  return (
                    <TableRow key={sub.id}>
                      <TableCell>
                        <div className="font-medium">{sub.company_name}</div>
                        {sub.phone && <div className="text-xs text-muted-foreground">{sub.phone}</div>}
                      </TableCell>
                      <TableCell className="text-sm">{sub.contact_name || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{sub.subcontractor_type}</Badge>
                      </TableCell>
                      <TableCell>
                        {sub.trade && sub.trade.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {sub.trade.map((t) => (
                              <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{formatDate(sub.license_expiration_date)}</span>
                          {licenseStatus.status === 'expired' && (
                            <Badge variant="destructive" className="text-xs">Expired</Badge>
                          )}
                          {licenseStatus.status === 'warning' && (
                            <Badge variant="outline" className="text-xs text-amber-600 border-amber-500">
                              {licenseStatus.daysLeft}d left
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => {
                              setSelectedDocument({ url: sub.license_document_url, name: `License - ${sub.company_name}` });
                              setPdfViewerOpen(true);
                            }}
                          >
                            <FileText className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{formatDate(sub.insurance_expiration_date)}</span>
                          {insuranceStatus.status === 'expired' && (
                            <Badge variant="destructive" className="text-xs">Expired</Badge>
                          )}
                          {insuranceStatus.status === 'warning' && (
                            <Badge variant="outline" className="text-xs text-amber-600 border-amber-500">
                              {insuranceStatus.daysLeft}d left
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => {
                              setSelectedDocument({ url: sub.insurance_document_url, name: `Insurance - ${sub.company_name}` });
                              setPdfViewerOpen(true);
                            }}
                          >
                            <FileText className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={sub.is_active}
                          onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: sub.id, is_active: checked })}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => {
                              setEditingSubcontractor(sub);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteClick(sub)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {(statusFilter === 'all' || statusFilter === 'inactive') && inactiveSubcontractors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground">Inactive Subcontractors ({inactiveSubcontractors.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inactiveSubcontractors.map((sub) => (
                  <TableRow key={sub.id} className="opacity-60">
                    <TableCell>
                      <div className="font-medium">{sub.company_name}</div>
                    </TableCell>
                    <TableCell className="text-sm">{sub.contact_name || "-"}</TableCell>
                    <TableCell>
                      <Switch
                        checked={sub.is_active}
                        onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: sub.id, is_active: checked })}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => {
                            setEditingSubcontractor(sub);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteClick(sub)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSubcontractor ? "Edit Subcontractor" : "Add Subcontractor"}
            </DialogTitle>
            <DialogDescription>
              {editingSubcontractor 
                ? "Update subcontractor information and documents"
                : "Add a new subcontractor with required license and insurance documents"
              }
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Type & Trade Row */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Select
                  value={formData.subcontractor_type}
                  onValueChange={async (value: SubcontractorType) => {
                    setFormData(prev => ({ ...prev, subcontractor_type: value }));
                    if (editingSubcontractor) {
                      const { error } = await supabase
                        .from("subcontractors")
                        .update({ subcontractor_type: value })
                        .eq("id", editingSubcontractor.id);
                      if (error) {
                        toast.error("Failed to update type");
                      } else {
                        toast.success("Type updated");
                        queryClient.invalidateQueries({ queryKey: ["subcontractors"] });
                      }
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Type *" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBCONTRACTOR_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
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
                    onChange={async (selected) => {
                      setFormData(prev => ({ ...prev, trade: selected }));
                      if (editingSubcontractor) {
                        const { error } = await supabase
                          .from("subcontractors")
                          .update({ trade: selected.length > 0 ? selected : null })
                          .eq("id", editingSubcontractor.id);
                        if (error) {
                          toast.error("Failed to update trades");
                        } else {
                          toast.success("Trades updated");
                          queryClient.invalidateQueries({ queryKey: ["subcontractors"] });
                        }
                      }
                    }}
                    placeholder="Trade(s)"
                    className="w-full"
                    onAddNew={isSuperAdmin ? (value) => {
                      if (!tradesData.includes(value)) {
                        addTradeMutation.mutate(value);
                      }
                    } : undefined}
                    addNewLabel="Add new trade..."
                  />
                </div>
              )}
            </div>

            {/* Company Info Section */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Input
                  id="company_name"
                  placeholder="Company Name *"
                  value={formData.company_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
                  className={formErrors?.company_name ? "border-destructive" : ""}
                />
                {formErrors?.company_name && (
                  <p className="text-xs text-destructive">{formErrors.company_name}</p>
                )}
              </div>
              <div>
                <Input
                  id="contact_name"
                  placeholder="Contact Name"
                  value={formData.contact_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, contact_name: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Input
                  id="phone"
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
              </div>
              <div>
                <Input
                  id="email"
                  type="email"
                  placeholder="Email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Input
                id="address"
                placeholder="Address"
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              />
            </div>

            {/* License Section - only show for Subcontractor type */}
            {formData.subcontractor_type === 'Subcontractor' && (
            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">License Information {!formData.do_not_require_license && '*'}</h4>
                <div className="flex items-center gap-2">
                  <Switch
                    id="do_not_require_license"
                    checked={formData.do_not_require_license}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, do_not_require_license: checked }))}
                  />
                  <Label htmlFor="do_not_require_license" className="text-sm text-muted-foreground">
                    Not required
                  </Label>
                </div>
              </div>
              
              {!formData.do_not_require_license && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="license_number">License Number</Label>
                      <Input
                        id="license_number"
                        value={formData.license_number}
                        onChange={(e) => setFormData(prev => ({ ...prev, license_number: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="license_expiration_date">Expiration Date *</Label>
                      <Input
                        id="license_expiration_date"
                        type="date"
                        value={formData.license_expiration_date}
                        onChange={(e) => setFormData(prev => ({ ...prev, license_expiration_date: e.target.value }))}
                        className={formErrors.license_expiration_date ? "border-destructive" : ""}
                      />
                      {formErrors.license_expiration_date && (
                        <p className="text-xs text-destructive">{formErrors.license_expiration_date}</p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>License Document (PDF) *</Label>
                    {formData.license_document_url ? (
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-600" />
                        <span className="text-sm text-green-600">Document uploaded</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedDocument({ url: formData.license_document_url, name: "License Document" });
                            setPdfViewerOpen(true);
                          }}
                        >
                          View
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setFormData(prev => ({ ...prev, license_document_url: "" }))}
                        >
                          Replace
                        </Button>
                      </div>
                    ) : (
                      <FileUpload
                        projectId="subcontractor-licenses"
                        currentUrl={null}
                        onUpload={(url) => url && handleFileUploaded('license_document_url', url)}
                        folder="licenses"
                        accept=".pdf,application/pdf"
                      />
                    )}
                    {formErrors.license_document_url && (
                      <p className="text-xs text-destructive">{formErrors.license_document_url}</p>
                    )}
                  </div>
                </>
              )}
              
              {formData.do_not_require_license && (
                <p className="text-sm text-muted-foreground">License documentation is not required for this subcontractor.</p>
              )}
            </div>
            )}

            {/* Insurance Section - only show for Subcontractor type */}
            {formData.subcontractor_type === 'Subcontractor' && (
            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Insurance Information {!formData.do_not_require_insurance && '*'}</h4>
                <div className="flex items-center gap-2">
                  <Switch
                    id="do_not_require_insurance"
                    checked={formData.do_not_require_insurance}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, do_not_require_insurance: checked }))}
                  />
                  <Label htmlFor="do_not_require_insurance" className="text-sm text-muted-foreground">
                    Not required
                  </Label>
                </div>
              </div>
              
              {!formData.do_not_require_insurance && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="insurance_expiration_date">Expiration Date *</Label>
                    <Input
                      id="insurance_expiration_date"
                      type="date"
                      value={formData.insurance_expiration_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, insurance_expiration_date: e.target.value }))}
                      className={formErrors.insurance_expiration_date ? "border-destructive" : ""}
                    />
                    {formErrors.insurance_expiration_date && (
                      <p className="text-xs text-destructive">{formErrors.insurance_expiration_date}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Insurance Document (PDF) *</Label>
                    {formData.insurance_document_url ? (
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-600" />
                        <span className="text-sm text-green-600">Document uploaded</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedDocument({ url: formData.insurance_document_url, name: "Insurance Document" });
                            setPdfViewerOpen(true);
                          }}
                        >
                          View
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setFormData(prev => ({ ...prev, insurance_document_url: "" }))}
                        >
                          Replace
                        </Button>
                      </div>
                    ) : (
                      <FileUpload
                        projectId="subcontractor-insurance"
                        currentUrl={null}
                        onUpload={(url) => url && handleFileUploaded('insurance_document_url', url)}
                        folder="insurance"
                        accept=".pdf,application/pdf"
                      />
                    )}
                    {formErrors.insurance_document_url && (
                      <p className="text-xs text-destructive">{formErrors.insurance_document_url}</p>
                    )}
                  </div>
                </>
              )}
              
              {formData.do_not_require_insurance && (
                <p className="text-sm text-muted-foreground">Insurance documentation is not required for this subcontractor.</p>
              )}
            </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
              />
            </div>

            {/* Active Status */}
            <div className="flex items-center gap-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
              />
              <Label htmlFor="is_active">Active (available for selection in bills)</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingSubcontractor ? "Update" : "Add"} Subcontractor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => {
        setDeleteDialogOpen(open);
        if (!open) {
          setDeleteHasPaidBills(false);
          setCheckingPaidBills(false);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {checkingPaidBills ? "Checking..." : deleteHasPaidBills ? "Cannot Delete Subcontractor" : "Delete Subcontractor?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {checkingPaidBills ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking for paid bills...
                </span>
              ) : deleteHasPaidBills ? (
                <span className="text-destructive">
                  <strong>{deleteTarget?.company_name}</strong> has paid bills on record and cannot be deleted. You can deactivate the subcontractor instead.
                </span>
              ) : (
                <>This will permanently delete <strong>{deleteTarget?.company_name}</strong>. This action cannot be undone.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {!deleteHasPaidBills && !checkingPaidBills && (
              <AlertDialogAction
                onClick={() => deleteMutation.mutate()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Delete
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
