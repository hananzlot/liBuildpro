import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { 
  Download, 
  Upload, 
  FileSpreadsheet, 
  Check, 
  X, 
  AlertCircle,
  Loader2,
  ChevronRight,
  FileText,
  DollarSign,
  Receipt,
  CreditCard,
  ClipboardList
} from "lucide-react";

interface ProjectImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ImportStep {
  id: string;
  name: string;
  description: string;
  templateFile: string;
  icon: React.ReactNode;
  required: boolean;
}

interface ImportResult {
  success: boolean;
  imported: number;
  errors: string[];
  warnings: string[];
}

const IMPORT_STEPS: ImportStep[] = [
  {
    id: "projects",
    name: "1. Projects",
    description: "Main project information (customer, address, salespeople, etc.)",
    templateFile: "project-import-template.csv",
    icon: <FileSpreadsheet className="h-4 w-4" />,
    required: true,
  },
  {
    id: "agreements",
    name: "2. Agreements",
    description: "Contracts and change orders linked to projects",
    templateFile: "agreements-import-template.csv",
    icon: <FileText className="h-4 w-4" />,
    required: false,
  },
  {
    id: "phases",
    name: "3. Payment Phases",
    description: "Payment milestones linked to agreements",
    templateFile: "payment-phases-import-template.csv",
    icon: <ClipboardList className="h-4 w-4" />,
    required: false,
  },
  {
    id: "invoices",
    name: "4. Invoices",
    description: "Invoices linked to payment phases",
    templateFile: "invoices-import-template.csv",
    icon: <Receipt className="h-4 w-4" />,
    required: false,
  },
  {
    id: "payments",
    name: "5. Payments",
    description: "Payments received linked to invoices",
    templateFile: "payments-import-template.csv",
    icon: <DollarSign className="h-4 w-4" />,
    required: false,
  },
  {
    id: "bills",
    name: "6. Bills",
    description: "Bills and expenses linked to projects",
    templateFile: "bills-import-template.csv",
    icon: <CreditCard className="h-4 w-4" />,
    required: false,
  },
];

export function ProjectImportDialog({ open, onOpenChange }: ProjectImportDialogProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [stepResults, setStepResults] = useState<Record<string, ImportResult>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [refMappings, setRefMappings] = useState<Record<string, Record<string, string>>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = (filename: string) => {
    const link = document.createElement('a');
    link.href = `/templates/${filename}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadInstructions = () => {
    const link = document.createElement('a');
    link.href = '/templates/README-import-instructions.txt';
    link.download = 'README-import-instructions.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCSV = (text: string): Record<string, string>[] => {
    const lines = text.split('\n').filter(line => !line.startsWith('###') && line.trim());
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim());
    const rows: Record<string, string>[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length === headers.length) {
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => {
          row[h] = values[idx];
        });
        rows.push(row);
      }
    }
    
    return rows;
  };

  const importProjects = async (rows: Record<string, string>[]): Promise<ImportResult> => {
    const result: ImportResult = { success: true, imported: 0, errors: [], warnings: [] };
    const newMappings: Record<string, string> = {};

    for (const row of rows) {
      try {
        const projectRef = row['project_ref*'] || row['project_ref'];
        const projectName = row['project_name*'] || row['project_name'];
        
        if (!projectRef || !projectName) {
          result.errors.push(`Missing required fields in row: ${JSON.stringify(row)}`);
          continue;
        }

        const { data, error } = await supabase.from('projects').insert({
          project_name: projectName,
          legacy_project_number: projectRef, // Store the original project ref for admin visibility
          project_status: row['project_status'] || null,
          project_type: row['project_type'] || null,
          project_subcategory: row['project_subcategory'] || null,
          branch: row['branch'] || null,
          customer_first_name: row['customer_first_name'] || null,
          customer_last_name: row['customer_last_name'] || null,
          customer_email: row['customer_email'] || null,
          cell_phone: row['cell_phone'] || null,
          home_phone: row['home_phone'] || null,
          alt_phone: row['alt_phone'] || null,
          project_address: row['project_address'] || null,
          lead_source: row['lead_source'] || null,
          lead_number: row['lead_number'] || null,
          contract_number: row['contract_number'] || null,
          agreement_signed_date: row['agreement_signed_date'] || null,
          contract_expiration_date: row['contract_expiration_date'] || null,
          due_date: row['due_date'] || null,
          install_start_date: row['install_start_date'] || null,
          install_status: row['install_status'] || null,
          install_notes: row['install_notes'] || null,
          project_manager: row['project_manager'] || null,
          primary_salesperson: row['primary_salesperson'] || null,
          primary_commission_pct: row['primary_commission_pct'] ? parseFloat(row['primary_commission_pct']) : null,
          primary_profit_split_pct: row['primary_profit_split_pct'] ? parseFloat(row['primary_profit_split_pct']) : null,
          secondary_salesperson: row['secondary_salesperson'] || null,
          secondary_commission_pct: row['secondary_commission_pct'] ? parseFloat(row['secondary_commission_pct']) : null,
          secondary_profit_split_pct: row['secondary_profit_split_pct'] ? parseFloat(row['secondary_profit_split_pct']) : null,
          tertiary_salesperson: row['tertiary_salesperson'] || null,
          tertiary_commission_pct: row['tertiary_commission_pct'] ? parseFloat(row['tertiary_commission_pct']) : null,
          tertiary_profit_split_pct: row['tertiary_profit_split_pct'] ? parseFloat(row['tertiary_profit_split_pct']) : null,
          quaternary_salesperson: row['quaternary_salesperson'] || null,
          quaternary_commission_pct: row['quaternary_commission_pct'] ? parseFloat(row['quaternary_commission_pct']) : null,
          quaternary_profit_split_pct: row['quaternary_profit_split_pct'] ? parseFloat(row['quaternary_profit_split_pct']) : null,
          commission_split_pct: row['commission_split_pct'] ? parseFloat(row['commission_split_pct']) : null,
          lead_cost_percent: row['lead_cost_percent'] ? parseFloat(row['lead_cost_percent']) : null,
          estimated_cost: row['estimated_cost'] ? parseFloat(row['estimated_cost']) : null,
          estimated_project_cost: row['estimated_project_cost'] ? parseFloat(row['estimated_project_cost']) : null,
          sold_dispatch_value: row['sold_dispatch_value'] ? parseFloat(row['sold_dispatch_value']) : null,
          project_scope_dispatch: row['project_scope_dispatch'] || null,
          has_hoa: row['has_hoa']?.toLowerCase() === 'true' || row['has_hoa'] === '1',
          utility: row['utility'] || null,
          permit_numbers: row['permit_numbers'] || null,
          lock_box_code: row['lock_box_code'] || null,
          dropbox_link: row['dropbox_link'] || null,
          date_of_birth: row['date_of_birth'] || null,
          contact_preferences: row['contact_preferences'] || null,
          sold_under: row['sold_under'] || null,
          location_id: 'location1',
          created_by: user?.id,
        }).select('id').single();

        if (error) {
          result.errors.push(`Failed to import project "${projectName}": ${error.message}`);
          result.success = false;
        } else if (data) {
          newMappings[projectRef] = data.id;
          result.imported++;
        }
      } catch (err) {
        result.errors.push(`Error processing row: ${err}`);
        result.success = false;
      }
    }

    setRefMappings(prev => ({ ...prev, projects: newMappings }));
    return result;
  };

  // Helper to lookup project by legacy_project_number or from session mappings
  const lookupProjectId = async (projectRef: string): Promise<string | null> => {
    // First check session mappings
    if (refMappings.projects?.[projectRef]) {
      return refMappings.projects[projectRef];
    }
    // Then check database by legacy_project_number
    const { data } = await supabase
      .from('projects')
      .select('id')
      .eq('legacy_project_number', projectRef)
      .is('deleted_at', null)
      .limit(1)
      .single();
    return data?.id || null;
  };

  // Helper to lookup agreement by agreement_number or from session mappings
  const lookupAgreementId = async (agreementRef: string): Promise<string | null> => {
    if (refMappings.agreements?.[agreementRef]) {
      return refMappings.agreements[agreementRef];
    }
    const { data } = await supabase
      .from('project_agreements')
      .select('id')
      .eq('agreement_number', agreementRef)
      .limit(1)
      .single();
    return data?.id || null;
  };

  // Helper to lookup phase by phase_name or from session mappings
  const lookupPhaseId = async (phaseRef: string): Promise<string | null> => {
    if (refMappings.phases?.[phaseRef]) {
      return refMappings.phases[phaseRef];
    }
    // Phases don't have a unique ref column, so we can only use session mappings
    return null;
  };

  // Helper to lookup invoice by invoice_number or from session mappings
  const lookupInvoiceId = async (invoiceRef: string): Promise<string | null> => {
    if (refMappings.invoices?.[invoiceRef]) {
      return refMappings.invoices[invoiceRef];
    }
    const { data } = await supabase
      .from('project_invoices')
      .select('id')
      .eq('invoice_number', invoiceRef)
      .limit(1)
      .single();
    return data?.id || null;
  };

  const importAgreements = async (rows: Record<string, string>[]): Promise<ImportResult> => {
    const result: ImportResult = { success: true, imported: 0, errors: [], warnings: [] };
    const newMappings: Record<string, string> = {};

    for (const row of rows) {
      try {
        const projectRef = row['project_ref*'] || row['project_ref'];
        const agreementRef = row['agreement_ref*'] || row['agreement_ref'];
        const projectId = await lookupProjectId(projectRef);

        if (!projectId) {
          result.errors.push(`Project ref "${projectRef}" not found in database. Import projects first or check the reference.`);
          continue;
        }

        const { data, error } = await supabase.from('project_agreements').insert({
          project_id: projectId,
          agreement_number: agreementRef, // Store agreement_ref as agreement_number for later lookups
          agreement_type: row['agreement_type'] || null,
          agreement_signed_date: row['agreement_signed_date'] || null,
          total_price: row['total_price'] ? parseFloat(row['total_price']) : null,
          description_of_work: row['description_of_work'] || null,
        }).select('id').single();

        if (error) {
          result.errors.push(`Failed to import agreement "${agreementRef}": ${error.message}`);
          result.success = false;
        } else if (data) {
          newMappings[agreementRef] = data.id;
          result.imported++;
        }
      } catch (err) {
        result.errors.push(`Error processing row: ${err}`);
        result.success = false;
      }
    }

    setRefMappings(prev => ({ ...prev, agreements: newMappings }));
    return result;
  };

  const importPhases = async (rows: Record<string, string>[]): Promise<ImportResult> => {
    const result: ImportResult = { success: true, imported: 0, errors: [], warnings: [] };
    const newMappings: Record<string, string> = {};

    for (const row of rows) {
      try {
        const agreementRef = row['agreement_ref*'] || row['agreement_ref'];
        const phaseRef = row['phase_ref*'] || row['phase_ref'];
        const phaseName = row['phase_name*'] || row['phase_name'];
        const agreementId = await lookupAgreementId(agreementRef);

        if (!agreementId) {
          result.errors.push(`Agreement ref "${agreementRef}" not found in database. Import agreements first or check the reference.`);
          continue;
        }

        // Get project ID from agreement
        const { data: agreement } = await supabase
          .from('project_agreements')
          .select('project_id')
          .eq('id', agreementId)
          .single();

        const { data, error } = await supabase.from('project_payment_phases').insert({
          project_id: agreement?.project_id,
          agreement_id: agreementId,
          phase_name: phaseName || 'Unnamed Phase',
          description: row['description'] || null,
          due_date: row['due_date'] || null,
          amount: row['amount'] ? parseFloat(row['amount']) : null,
        }).select('id').single();

        if (error) {
          result.errors.push(`Failed to import phase "${phaseName}": ${error.message}`);
          result.success = false;
        } else if (data) {
          newMappings[phaseRef] = data.id;
          result.imported++;
        }
      } catch (err) {
        result.errors.push(`Error processing row: ${err}`);
        result.success = false;
      }
    }

    setRefMappings(prev => ({ ...prev, phases: newMappings }));
    return result;
  };

  const importInvoices = async (rows: Record<string, string>[]): Promise<ImportResult> => {
    const result: ImportResult = { success: true, imported: 0, errors: [], warnings: [] };
    const newMappings: Record<string, string> = {};

    for (const row of rows) {
      try {
        const phaseRef = row['phase_ref*'] || row['phase_ref'];
        const invoiceRef = row['invoice_ref*'] || row['invoice_ref'];
        const invoiceNumber = row['invoice_number'] || invoiceRef; // Use invoice_ref as invoice_number for lookups
        const phaseId = await lookupPhaseId(phaseRef);

        if (!phaseId) {
          result.errors.push(`Phase ref "${phaseRef}" not found. Phases must be imported in the same session, or you can manually link invoices later.`);
          continue;
        }

        // Get project and agreement IDs from phase
        const { data: phase } = await supabase
          .from('project_payment_phases')
          .select('project_id, agreement_id')
          .eq('id', phaseId)
          .single();

        const amount = row['amount'] ? parseFloat(row['amount']) : 0;

        const { data, error } = await supabase.from('project_invoices').insert({
          project_id: phase?.project_id,
          agreement_id: phase?.agreement_id,
          payment_phase_id: phaseId,
          invoice_number: invoiceNumber,
          invoice_date: row['invoice_date'] || null,
          amount: amount,
          total_expected: amount,
          payments_received: 0,
          open_balance: amount,
        }).select('id').single();

        if (error) {
          result.errors.push(`Failed to import invoice "${invoiceRef}": ${error.message}`);
          result.success = false;
        } else if (data) {
          newMappings[invoiceRef] = data.id;
          result.imported++;
        }
      } catch (err) {
        result.errors.push(`Error processing row: ${err}`);
        result.success = false;
      }
    }

    setRefMappings(prev => ({ ...prev, invoices: newMappings }));
    return result;
  };

  const importPayments = async (rows: Record<string, string>[]): Promise<ImportResult> => {
    const result: ImportResult = { success: true, imported: 0, errors: [], warnings: [] };

    for (const row of rows) {
      try {
        const invoiceRef = row['invoice_ref*'] || row['invoice_ref'];
        const invoiceId = await lookupInvoiceId(invoiceRef);

        if (!invoiceId) {
          result.errors.push(`Invoice ref "${invoiceRef}" not found in database. Import invoices first or check the reference.`);
          continue;
        }

        // Get project and phase IDs from invoice
        const { data: invoice } = await supabase
          .from('project_invoices')
          .select('project_id, payment_phase_id')
          .eq('id', invoiceId)
          .single();

        const paymentAmount = row['payment_amount'] ? parseFloat(row['payment_amount']) : 0;

        const { error } = await supabase.from('project_payments').insert({
          project_id: invoice?.project_id,
          invoice_id: invoiceId,
          payment_phase_id: invoice?.payment_phase_id,
          bank_name: row['bank_name'] || null,
          projected_received_date: row['projected_received_date'] || null,
          payment_schedule: row['payment_schedule'] || null,
          payment_status: row['payment_status'] || 'Pending',
          payment_amount: paymentAmount,
          payment_fee: row['payment_fee'] ? parseFloat(row['payment_fee']) : 0,
          check_number: row['check_number'] || null,
          deposit_verified: row['deposit_verified']?.toLowerCase() === 'true' || row['deposit_verified'] === '1',
        });

        if (error) {
          result.errors.push(`Failed to import payment for invoice "${invoiceRef}": ${error.message}`);
          result.success = false;
        } else {
          result.imported++;
          
          // Update invoice totals for received payments
          if (row['payment_status'] === 'Received') {
            const { data: inv } = await supabase.from('project_invoices')
              .select('amount, payments_received')
              .eq('id', invoiceId)
              .single();
            
            if (inv) {
              const newReceived = (inv.payments_received || 0) + paymentAmount;
              await supabase.from('project_invoices')
                .update({ 
                  payments_received: newReceived,
                  open_balance: (inv.amount || 0) - newReceived 
                })
                .eq('id', invoiceId);
            }
          }
        }
      } catch (err) {
        result.errors.push(`Error processing row: ${err}`);
        result.success = false;
      }
    }

    return result;
  };

  const importBills = async (rows: Record<string, string>[]): Promise<ImportResult> => {
    const result: ImportResult = { success: true, imported: 0, errors: [], warnings: [] };

    for (const row of rows) {
      try {
        const projectRef = row['project_ref*'] || row['project_ref'];
        const agreementRef = row['agreement_ref'];
        const projectId = await lookupProjectId(projectRef);
        const agreementId = agreementRef ? await lookupAgreementId(agreementRef) : null;

        if (!projectId) {
          result.errors.push(`Project ref "${projectRef}" not found in database. Import projects first or check the reference.`);
          continue;
        }

        const billAmount = row['bill_amount'] ? parseFloat(row['bill_amount']) : 0;
        const amountPaid = row['amount_paid'] ? parseFloat(row['amount_paid']) : 0;

        const { error } = await supabase.from('project_bills').insert({
          project_id: projectId,
          agreement_id: agreementId,
          installer_company: row['installer_company'] || null,
          category: row['category'] || null,
          bill_ref: row['bill_ref'] || null,
          bill_amount: billAmount,
          amount_paid: amountPaid,
          balance: billAmount - amountPaid,
          memo: row['memo'] || null,
          payment_method: row['payment_method'] || null,
          payment_reference: row['payment_reference'] || null,
        });

        if (error) {
          result.errors.push(`Failed to import bill: ${error.message}`);
          result.success = false;
        } else {
          result.imported++;
        }
      } catch (err) {
        result.errors.push(`Error processing row: ${err}`);
        result.success = false;
      }
    }

    return result;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      
      if (rows.length === 0) {
        toast.error("No valid data rows found in the CSV file");
        setIsUploading(false);
        return;
      }

      const step = IMPORT_STEPS[currentStep];
      let result: ImportResult;

      switch (step.id) {
        case 'projects':
          result = await importProjects(rows);
          break;
        case 'agreements':
          result = await importAgreements(rows);
          break;
        case 'phases':
          result = await importPhases(rows);
          break;
        case 'invoices':
          result = await importInvoices(rows);
          break;
        case 'payments':
          result = await importPayments(rows);
          break;
        case 'bills':
          result = await importBills(rows);
          break;
        default:
          result = { success: false, imported: 0, errors: ['Unknown step'], warnings: [] };
      }

      setStepResults(prev => ({ ...prev, [step.id]: result }));
      
      if (result.imported > 0) {
        toast.success(`Imported ${result.imported} ${step.name.split('.')[1]?.trim() || 'records'}`);
        queryClient.invalidateQueries({ queryKey: ["projects"] });
        queryClient.invalidateQueries({ queryKey: ["all-project-agreements"] });
        queryClient.invalidateQueries({ queryKey: ["all-project-phases"] });
        queryClient.invalidateQueries({ queryKey: ["all-project-invoices"] });
        queryClient.invalidateQueries({ queryKey: ["all-project-payments"] });
        queryClient.invalidateQueries({ queryKey: ["all-project-bills"] });
      }
      
      if (result.errors.length > 0) {
        toast.error(`${result.errors.length} errors occurred during import`);
      }
    } catch (err) {
      toast.error(`Failed to process file: ${err}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleReset = () => {
    setCurrentStep(0);
    setStepResults({});
    setRefMappings({});
  };

  // All steps are now independent - no locking needed
  const canProceedToNext = () => {
    return true; // All steps are optional and independent
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Projects
          </DialogTitle>
          <DialogDescription>
            Import projects and financial data from CSV files. Download the templates, fill them out, and upload in order.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Download Templates Section */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Download className="h-4 w-4" />
                Step 1: Download Templates
              </CardTitle>
              <CardDescription className="text-xs">
                Download CSV templates with sample data. Fill them with your project data.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {IMPORT_STEPS.map((step) => (
                  <Button
                    key={step.id}
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadTemplate(step.templateFile)}
                    className="text-xs"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    {step.name}
                  </Button>
                ))}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDownloadInstructions}
                  className="text-xs"
                >
                  <FileText className="h-3 w-3 mr-1" />
                  Instructions
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Import Progress */}
          <Card className="flex-1 overflow-hidden flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Step 2: Upload CSV Files
              </CardTitle>
              <CardDescription className="text-xs">
                Click on any import type to upload. References are looked up from the database, so you can import across sessions.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
              <div className="max-h-[55vh] overflow-y-auto px-6 pb-4 scrollbar-styled">
                <div className="space-y-3">
                  {IMPORT_STEPS.map((step, index) => {
                    const result = stepResults[step.id];
                    const isActive = index === currentStep;
                    const isCompleted = result?.imported && result.imported > 0;
                    const hasErrors = result?.errors && result.errors.length > 0;

                    return (
                      <div
                        key={step.id}
                        onClick={() => setCurrentStep(index)}
                        className={`p-3 rounded-lg border transition-colors cursor-pointer hover:border-primary/50 ${
                          isActive
                            ? 'border-primary bg-primary/5'
                            : isCompleted
                            ? 'border-emerald-500/50 bg-emerald-500/5'
                            : hasErrors
                            ? 'border-amber-500/50 bg-amber-500/5'
                            : 'border-border'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${
                              isCompleted ? 'bg-emerald-500/20 text-emerald-500' :
                              hasErrors ? 'bg-amber-500/20 text-amber-500' :
                              isActive ? 'bg-primary/20 text-primary' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              {isCompleted ? <Check className="h-4 w-4" /> : step.icon}
                            </div>
                            <div>
                              <p className="font-medium text-sm flex items-center gap-2">
                                {step.name}
                                {step.required && <Badge variant="outline" className="text-[10px] h-4">Required</Badge>}
                              </p>
                              <p className="text-xs text-muted-foreground">{step.description}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {result && (
                              <div className="text-right text-xs">
                                {result.imported > 0 && (
                                  <p className="text-emerald-500">{result.imported} imported</p>
                                )}
                                {result.errors.length > 0 && (
                                  <p className="text-amber-500">{result.errors.length} errors</p>
                                )}
                              </div>
                            )}
                            
                            {isActive && (
                              <div>
                                <input
                                  ref={fileInputRef}
                                  type="file"
                                  accept=".csv"
                                  onChange={handleFileUpload}
                                  className="hidden"
                                  id={`file-upload-${step.id}`}
                                />
                                <Button
                                  size="sm"
                                  onClick={() => fileInputRef.current?.click()}
                                  disabled={isUploading}
                                >
                                  {isUploading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <>
                                      <Upload className="h-3 w-3 mr-1" />
                                      Upload
                                    </>
                                  )}
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Error Details */}
                        {result?.errors && result.errors.length > 0 && (
                          <div className="mt-2 p-2 bg-destructive/10 rounded text-xs text-destructive">
                            <p className="font-medium mb-1">Errors:</p>
                            <ul className="list-disc list-inside space-y-0.5 max-h-20 overflow-y-auto">
                              {result.errors.slice(0, 5).map((err, i) => (
                                <li key={i}>{err}</li>
                              ))}
                              {result.errors.length > 5 && (
                                <li>...and {result.errors.length - 5} more</li>
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2 border-t">
            <Button variant="outline" onClick={handleReset}>
              Reset All
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
                disabled={currentStep === 0}
              >
                Previous
              </Button>
              <Button
                onClick={() => setCurrentStep(prev => Math.min(IMPORT_STEPS.length - 1, prev + 1))}
                disabled={currentStep === IMPORT_STEPS.length - 1 || !canProceedToNext()}
              >
                Next Step
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
