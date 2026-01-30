import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FileText, Receipt, CreditCard, DollarSign, Save, RotateCcw, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// Define the local database fields for each record type
const INVOICE_FIELDS = [
  { key: "invoice_number", label: "Invoice Number", description: "Maps to QB DocNumber" },
  { key: "amount", label: "Amount", description: "Maps to QB Line Amount" },
  { key: "invoice_date", label: "Invoice Date", description: "Maps to QB TxnDate" },
  { key: "due_date", label: "Due Date", description: "Maps to QB DueDate" },
  { key: "description", label: "Description", description: "Maps to QB Line Description" },
  { key: "notes", label: "Notes", description: "Maps to QB PrivateNote" },
  { key: "project_name", label: "Project Name (Customer)", description: "Used to find/create QB Customer" },
];

const PAYMENT_FIELDS = [
  { key: "payment_amount", label: "Payment Amount", description: "Maps to QB TotalAmt" },
  { key: "payment_date", label: "Payment Date", description: "Maps to QB TxnDate" },
  { key: "payment_method", label: "Payment Method", description: "Maps to QB PaymentMethodRef" },
  { key: "payment_reference", label: "Reference", description: "Maps to QB PrivateNote" },
  { key: "project_name", label: "Project Name (Customer)", description: "Used to find/create QB Customer" },
];

const BILL_FIELDS = [
  { key: "bill_amount", label: "Bill Amount", description: "Maps to QB Line Amount" },
  { key: "created_at", label: "Bill Date", description: "Maps to QB TxnDate (uses created_at)" },
  { key: "category", label: "Category", description: "Included in QB Description" },
  { key: "bill_ref", label: "Bill Reference", description: "Included in QB Description" },
  { key: "memo", label: "Memo", description: "Maps to QB PrivateNote" },
  { key: "installer_company", label: "Installer Company (Vendor)", description: "Used to find/create QB Vendor" },
  { key: "project_name", label: "Project Name", description: "Links bill to a project/customer for reporting" },
];

const BILL_PAYMENT_FIELDS = [
  { key: "payment_amount", label: "Payment Amount", description: "Amount paid toward the bill" },
  { key: "payment_date", label: "Payment Date", description: "Date payment was made" },
  { key: "payment_method", label: "Payment Method", description: "How payment was made" },
  { key: "payment_reference", label: "Reference", description: "Check number or reference" },
  { key: "bank_name", label: "Bank Account", description: "Source bank for payment" },
];

// QB target fields for each entity type
const QB_INVOICE_FIELDS = [
  { key: "DocNumber", label: "Document Number" },
  { key: "TxnDate", label: "Transaction Date" },
  { key: "DueDate", label: "Due Date" },
  { key: "CustomerRef", label: "Customer" },
  { key: "Line.Amount", label: "Line Amount" },
  { key: "Line.Description", label: "Line Description" },
  { key: "Line.SalesItemLineDetail.ItemRef", label: "Service/Product Item" },
  { key: "PrivateNote", label: "Private Memo" },
];

const QB_PAYMENT_FIELDS = [
  { key: "TotalAmt", label: "Total Amount" },
  { key: "TxnDate", label: "Transaction Date" },
  { key: "CustomerRef", label: "Customer" },
  { key: "PaymentMethodRef", label: "Payment Method" },
  { key: "PrivateNote", label: "Private Memo" },
];

const QB_BILL_FIELDS = [
  { key: "TxnDate", label: "Transaction Date" },
  { key: "VendorRef", label: "Vendor" },
  { key: "CustomerRef", label: "Customer (for Job Tracking)" },
  { key: "Line.Amount", label: "Line Amount" },
  { key: "Line.Description", label: "Line Description" },
  { key: "Line.AccountBasedExpenseLineDetail.AccountRef", label: "Expense Account" },
  { key: "PrivateNote", label: "Private Memo" },
];

const QB_BILL_PAYMENT_FIELDS = [
  { key: "TotalAmt", label: "Total Amount" },
  { key: "TxnDate", label: "Transaction Date" },
  { key: "VendorRef", label: "Vendor" },
  { key: "PaymentMethodRef", label: "Payment Method" },
  { key: "CheckPayment.BankAccountRef", label: "Bank Account" },
  { key: "PrivateNote", label: "Private Memo" },
];

// Default field mappings (what the sync function currently uses)
const DEFAULT_INVOICE_MAPPINGS: Record<string, string> = {
  "invoice_number": "DocNumber",
  "invoice_date": "TxnDate",
  "due_date": "DueDate",
  "amount": "Line.Amount",
  "description": "Line.Description",
  "notes": "PrivateNote",
  "project_name": "CustomerRef",
};

const DEFAULT_PAYMENT_MAPPINGS: Record<string, string> = {
  "payment_amount": "TotalAmt",
  "payment_date": "TxnDate",
  "payment_method": "PaymentMethodRef",
  "payment_reference": "PrivateNote",
  "project_name": "CustomerRef",
};

const DEFAULT_BILL_MAPPINGS: Record<string, string> = {
  "bill_amount": "Line.Amount",
  "created_at": "TxnDate",
  "category": "Line.Description",
  "memo": "PrivateNote",
  "installer_company": "VendorRef",
  "project_name": "CustomerRef",
};

const DEFAULT_BILL_PAYMENT_MAPPINGS: Record<string, string> = {
  "payment_amount": "TotalAmt",
  "payment_date": "TxnDate",
  "payment_method": "PaymentMethodRef",
  "payment_reference": "PrivateNote",
  "bank_name": "CheckPayment.BankAccountRef",
};

interface FieldMappingRow {
  id?: string;
  record_type: string;
  local_field: string;
  qb_field: string;
  is_active: boolean;
}

export function QuickBooksFieldMappings() {
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("invoices");
  const [pendingChanges, setPendingChanges] = useState<Record<string, Record<string, string>>>({});

  // Fetch existing field mappings
  const { data: fieldMappings, isLoading } = useQuery({
    queryKey: ["qb-field-mappings", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quickbooks_field_mappings" as any)
        .select("*")
        .eq("company_id", companyId) as unknown as { data: FieldMappingRow[] | null; error: any };
      if (error) throw error;
      return (data || []) as FieldMappingRow[];
    },
    enabled: !!companyId,
  });

  // Save field mapping mutation
  const saveMappingMutation = useMutation({
    mutationFn: async (mappings: Omit<FieldMappingRow, "id">[]) => {
      // Upsert all mappings
      for (const mapping of mappings) {
        const { error } = await supabase
          .from("quickbooks_field_mappings" as any)
          .upsert({
            company_id: companyId,
            record_type: mapping.record_type,
            local_field: mapping.local_field,
            qb_field: mapping.qb_field,
            is_active: mapping.is_active,
          }, { 
            onConflict: "company_id,record_type,local_field" 
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Field mappings saved");
      queryClient.invalidateQueries({ queryKey: ["qb-field-mappings"] });
      setPendingChanges({});
    },
    onError: (error: Error) => {
      toast.error("Failed to save mappings: " + error.message);
    },
  });

  // Get current mapping for a field (from DB or pending changes)
  const getFieldMapping = (recordType: string, localField: string, defaultValue: string) => {
    // Check pending changes first
    if (pendingChanges[recordType]?.[localField]) {
      return pendingChanges[recordType][localField];
    }
    // Then check saved mappings
    const saved = fieldMappings?.find(
      (m) => m.record_type === recordType && m.local_field === localField
    );
    return saved?.qb_field || defaultValue;
  };

  const handleFieldChange = (recordType: string, localField: string, qbField: string) => {
    setPendingChanges((prev) => ({
      ...prev,
      [recordType]: {
        ...prev[recordType],
        [localField]: qbField,
      },
    }));
  };

  const saveAllChanges = () => {
    const mappingsToSave: Omit<FieldMappingRow, "id">[] = [];
    
    Object.entries(pendingChanges).forEach(([recordType, fields]) => {
      Object.entries(fields).forEach(([localField, qbField]) => {
        mappingsToSave.push({
          record_type: recordType,
          local_field: localField,
          qb_field: qbField,
          is_active: true,
        });
      });
    });

    if (mappingsToSave.length > 0) {
      saveMappingMutation.mutate(mappingsToSave);
    }
  };

  const resetToDefaults = (recordType: string) => {
    const defaults = recordType === "invoice" ? DEFAULT_INVOICE_MAPPINGS
      : recordType === "payment" ? DEFAULT_PAYMENT_MAPPINGS
      : recordType === "bill" ? DEFAULT_BILL_MAPPINGS
      : DEFAULT_BILL_PAYMENT_MAPPINGS;

    setPendingChanges((prev) => ({
      ...prev,
      [recordType]: { ...defaults },
    }));
  };

  const hasPendingChanges = Object.keys(pendingChanges).length > 0;

  const renderFieldMappingSection = (
    recordType: string,
    localFields: typeof INVOICE_FIELDS,
    qbFields: typeof QB_INVOICE_FIELDS,
    defaultMappings: Record<string, string>,
    icon: React.ReactNode,
    title: string,
    description: string
  ) => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <h4 className="text-sm font-medium">{title}</h4>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => resetToDefaults(recordType)}
          className="text-xs"
        >
          <RotateCcw className="h-3 w-3 mr-1" />
          Reset to Defaults
        </Button>
      </div>
      
      <div className="space-y-3">
        {localFields.map((field) => {
          const currentMapping = getFieldMapping(recordType, field.key, defaultMappings[field.key] || "");
          const hasChange = pendingChanges[recordType]?.[field.key] !== undefined;
          
          return (
            <div 
              key={field.key} 
              className={`flex items-center gap-3 p-3 rounded-lg border ${hasChange ? 'border-primary bg-primary/5' : 'bg-muted/30'}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{field.label}</p>
                  {hasChange && <Badge variant="secondary" className="text-xs">Modified</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{field.description}</p>
                <code className="text-xs bg-muted px-1 rounded mt-1 inline-block">{field.key}</code>
              </div>
              
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              
              <Select
                value={currentMapping}
                onValueChange={(value) => handleFieldChange(recordType, field.key, value)}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Select QB field" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__skip__">
                    <span className="text-muted-foreground">— Don't sync this field —</span>
                  </SelectItem>
                  {qbFields.map((qbField) => (
                    <SelectItem key={qbField.key} value={qbField.key}>
                      {qbField.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Field Mappings</CardTitle>
              <CardDescription>
                Configure which local fields sync to QuickBooks
              </CardDescription>
            </div>
          </div>
          {hasPendingChanges && (
            <Button onClick={saveAllChanges} disabled={saveMappingMutation.isPending}>
              {saveMappingMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="invoices" className="flex items-center gap-1.5">
              <Receipt className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Invoices</span>
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Collections</span>
            </TabsTrigger>
            <TabsTrigger value="bills" className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Bills</span>
            </TabsTrigger>
            <TabsTrigger value="bill_payments" className="flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Bill Payments</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="invoices" className="mt-6">
            {renderFieldMappingSection(
              "invoice",
              INVOICE_FIELDS,
              QB_INVOICE_FIELDS,
              DEFAULT_INVOICE_MAPPINGS,
              <Receipt className="h-5 w-5 text-primary" />,
              "Invoice Field Mapping",
              "Map your invoice fields to QuickBooks invoice fields"
            )}
          </TabsContent>

          <TabsContent value="payments" className="mt-6">
            {renderFieldMappingSection(
              "payment",
              PAYMENT_FIELDS,
              QB_PAYMENT_FIELDS,
              DEFAULT_PAYMENT_MAPPINGS,
              <DollarSign className="h-5 w-5 text-primary" />,
              "Payment Collection Field Mapping",
              "Map your payment collection fields to QuickBooks payment fields"
            )}
          </TabsContent>

          <TabsContent value="bills" className="mt-6">
            {renderFieldMappingSection(
              "bill",
              BILL_FIELDS,
              QB_BILL_FIELDS,
              DEFAULT_BILL_MAPPINGS,
              <FileText className="h-5 w-5 text-primary" />,
              "Bill Field Mapping",
              "Map your bill fields to QuickBooks bill fields"
            )}
          </TabsContent>

          <TabsContent value="bill_payments" className="mt-6">
            {renderFieldMappingSection(
              "bill_payment",
              BILL_PAYMENT_FIELDS,
              QB_BILL_PAYMENT_FIELDS,
              DEFAULT_BILL_PAYMENT_MAPPINGS,
              <CreditCard className="h-5 w-5 text-primary" />,
              "Bill Payment Field Mapping",
              "Map your bill payment fields to QuickBooks bill payment fields"
            )}
          </TabsContent>
        </Tabs>

        <Separator className="my-6" />

        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="vendor-matching">
            <AccordionTrigger className="text-sm">
              Vendor/Customer Matching Rules
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 rounded-lg border bg-muted/30">
                  <h5 className="text-sm font-medium mb-2">Customer Matching (Invoices & Payments)</h5>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Uses <code className="bg-muted px-1">project_name</code> or <code className="bg-muted px-1">project_address</code></li>
                    <li>• Searches QB for matching DisplayName</li>
                    <li>• Creates new customer if no match found</li>
                    <li>• Override: Map specific contacts in Customers tab</li>
                  </ul>
                </div>
                <div className="p-4 rounded-lg border bg-muted/30">
                  <h5 className="text-sm font-medium mb-2">Vendor Matching (Bills & Bill Payments)</h5>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Uses <code className="bg-muted px-1">installer_company</code> field</li>
                    <li>• Searches QB for matching DisplayName</li>
                    <li>• Creates new vendor if no match found</li>
                    <li>• Override: Map specific subcontractors in Vendors tab</li>
                  </ul>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
