import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const QB_BASE_URL = "https://quickbooks.api.intuit.com/v3/company";

function stripNullishDeep<T extends Record<string, any>>(obj: T): T {
  if (!obj || typeof obj !== "object") return obj;
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val === null || val === undefined || val === "") {
      delete obj[key];
      continue;
    }
    if (typeof val === "object") {
      stripNullishDeep(val);
      // If nested object becomes empty, remove it
      if (val && typeof val === "object" && !Array.isArray(val) && Object.keys(val).length === 0) {
        delete obj[key];
      }
    }
  }
  return obj;
}

interface QBCustomer {
  DisplayName: string;
  PrimaryEmailAddr?: { Address: string };
  PrimaryPhone?: { FreeFormNumber: string };
  BillAddr?: {
    Line1: string;
    City?: string;
    CountrySubDivisionCode?: string;
    PostalCode?: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { companyId, syncType, recordId, syncAll, syncSelected, selectedRecords, checkOnly } = await req.json();

    if (!companyId) {
      return new Response(
        JSON.stringify({ error: "companyId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If syncSelected mode, we only sync the specific IDs provided
    const selectedInvoiceIds = syncSelected ? (selectedRecords?.invoices || []) : null;
    const selectedPaymentIds = syncSelected ? (selectedRecords?.payments || []) : null;
    const selectedBillIds = syncSelected ? (selectedRecords?.bills || []) : null;

    // Get QuickBooks tokens
    const { data: tokenData, error: tokenError } = await supabase.rpc("get_quickbooks_tokens", {
      p_company_id: companyId,
    });

    if (tokenError || !tokenData || tokenData.length === 0) {
      return new Response(
        JSON.stringify({ error: "QuickBooks not connected" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let { access_token, refresh_token, realm_id, token_expires_at } = tokenData[0];

    // Check if token needs refresh
    if (new Date(token_expires_at) <= new Date()) {
      console.log("Token expired, refreshing...");
      const refreshResult = await supabase.functions.invoke("quickbooks-auth", {
        body: { action: "refresh-token", companyId },
      });

      if (refreshResult.error || refreshResult.data?.error) {
        return new Response(
          JSON.stringify({ error: "Token refresh failed", needsReauth: true }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get new tokens
      const { data: newTokenData } = await supabase.rpc("get_quickbooks_tokens", {
        p_company_id: companyId,
      });
      access_token = newTokenData[0].access_token;
    }

    const qbHeaders = {
      "Authorization": `Bearer ${access_token}`,
      "Accept": "application/json",
      "Content-Type": "application/json",
    };

    const results: { synced: number; failed: number; errors: string[]; newEntities?: { type: string; name: string }[] } = {
      synced: 0,
      failed: 0,
      errors: [],
      newEntities: [],
    };

    // Fetch mapping configurations
    const { data: mappings } = await supabase
      .from("quickbooks_mappings")
      .select("*")
      .eq("company_id", companyId);

    const getMapping = (type: string, sourceValue?: string | null) => {
      // First try to find a specific mapping for the source value
      if (sourceValue) {
        const specific = mappings?.find(
          (m) => m.mapping_type === type && m.source_value === sourceValue
        );
        if (specific) return specific;
      }
      // Fall back to default mapping
      return mappings?.find((m) => m.mapping_type === type && m.is_default);
    };
    // Helper to check if customer exists - first via mapping, then via QB name search
    // NOTE: Customer mappings are stored against the *contact UUID* (contacts.id), not the project id.
    async function checkCustomerExists(project: any): Promise<{ exists: boolean; id: string | null; name: string; fromMapping: boolean }> {
      const customerName = project.project_name || project.project_address || `Project ${project.project_number}`;

      const mappingSource = project.contact_uuid || project.contact_id || null;

      // First check if there's a manual mapping for this project's contact
      if (mappingSource) {
        const mapped = mappings?.find(
          (m) => m.mapping_type === "customer" && m.source_value === mappingSource
        );
        if (mapped) {
          console.log(`Found customer mapping for contact ${mappingSource}: QB ID ${mapped.qbo_id}`);
          return { exists: true, id: mapped.qbo_id, name: mapped.qbo_name || customerName, fromMapping: true };
        }
      }
      
      // Fall back to QB name search
      const searchUrl = `${QB_BASE_URL}/${realm_id}/query?query=${encodeURIComponent(`SELECT * FROM Customer WHERE DisplayName = '${customerName.replace(/'/g, "\\'")}'`)}`;
      
      const searchRes = await fetch(searchUrl, { headers: qbHeaders });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.QueryResponse?.Customer?.length > 0) {
          return { exists: true, id: searchData.QueryResponse.Customer[0].Id, name: customerName, fromMapping: false };
        }
      }
      
      return { exists: false, id: null, name: customerName, fromMapping: false };
    }

    // Helper to find or create customer in QB
    async function findOrCreateCustomer(project: any): Promise<{ id: string | null; isNew: boolean; name: string }> {
      const check = await checkCustomerExists(project);
      if (check.exists && check.id) {
        return { id: check.id, isNew: false, name: check.name };
      }

      // Create new customer
      const customerData: QBCustomer = {
        DisplayName: check.name.substring(0, 100),
      };

      if (project.project_address) {
        customerData.BillAddr = { Line1: project.project_address };
      }

      const createRes = await fetch(`${QB_BASE_URL}/${realm_id}/customer`, {
        method: "POST",
        headers: qbHeaders,
        body: JSON.stringify(customerData),
      });

      if (createRes.ok) {
        const created = await createRes.json();
        return { id: created.Customer.Id, isNew: true, name: check.name };
      }

      console.error("Failed to create customer:", await createRes.text());
      return { id: null, isNew: false, name: check.name };
    }

    // Helper to check if vendor exists in QB
    async function checkVendorExists(vendorName: string): Promise<{ exists: boolean; id: string | null; name: string }> {
      const searchUrl = `${QB_BASE_URL}/${realm_id}/query?query=${encodeURIComponent(`SELECT * FROM Vendor WHERE DisplayName = '${vendorName.replace(/'/g, "\\'")}'`)}`;
      
      const searchRes = await fetch(searchUrl, { headers: qbHeaders });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.QueryResponse?.Vendor?.length > 0) {
          return { exists: true, id: searchData.QueryResponse.Vendor[0].Id, name: vendorName };
        }
      }
      
      return { exists: false, id: null, name: vendorName };
    }

    // Helper to find or create vendor in QB
    async function findOrCreateVendor(vendorName: string): Promise<{ id: string | null; isNew: boolean; name: string }> {
      const check = await checkVendorExists(vendorName);
      if (check.exists && check.id) {
        return { id: check.id, isNew: false, name: vendorName };
      }

      // Create new vendor
      const createRes = await fetch(`${QB_BASE_URL}/${realm_id}/vendor`, {
        method: "POST",
        headers: qbHeaders,
        body: JSON.stringify({ DisplayName: vendorName.substring(0, 100) }),
      });

      if (createRes.ok) {
        const created = await createRes.json();
        return { id: created.Vendor.Id, isNew: true, name: vendorName };
      }

      return { id: null, isNew: false, name: vendorName };
    }

    // Handle checkOnly mode - just check if entities exist without creating
    if (checkOnly) {
      const pendingEntities: { type: string; name: string }[] = [];
      
      // Check for invoices
      if (!syncType || syncType === "invoice") {
        if (recordId) {
          const { data: invoice } = await supabase
            .from("project_invoices")
            .select("*, projects!inner(id, project_name, project_address, project_number, contact_uuid, contact_id)")
            .eq("id", recordId)
            .single();
          
          if (invoice?.projects) {
            const check = await checkCustomerExists(invoice.projects);
            if (!check.exists) {
              pendingEntities.push({ type: "customer", name: check.name });
            }
          }
        }
      }
      
      // Check for payments
      if (syncType === "payment" && recordId) {
        const { data: payment } = await supabase
          .from("project_payments")
          .select("*, projects!inner(id, project_name, project_address, project_number, contact_uuid, contact_id)")
          .eq("id", recordId)
          .single();
        
        if (payment?.projects) {
          const check = await checkCustomerExists(payment.projects);
          if (!check.exists) {
            pendingEntities.push({ type: "customer", name: check.name });
          }
        }
      }
      
      // Check for bills
      if (syncType === "bill" && recordId) {
        const { data: bill } = await supabase
          .from("project_bills")
          .select("installer_company")
          .eq("id", recordId)
          .single();
        
        if (bill?.installer_company) {
          const check = await checkVendorExists(bill.installer_company);
          if (!check.exists) {
            pendingEntities.push({ type: "vendor", name: check.name });
          }
        }
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          checkOnly: true, 
          pendingEntities,
          requiresConfirmation: pendingEntities.length > 0 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sync invoices
    if (!syncType || syncType === "invoice") {
      // Skip if syncSelected mode and no invoices selected
      if (syncSelected && (!selectedInvoiceIds || selectedInvoiceIds.length === 0)) {
        // Skip invoices
      } else {
        let invoiceQuery = supabase
          .from("project_invoices")
          .select("*, projects!inner(id, project_name, project_address, project_number, contact_uuid, contact_id)")
          .eq("projects.company_id", companyId)
          .eq("exclude_from_qb", false);

        if (syncSelected && selectedInvoiceIds) {
          invoiceQuery = invoiceQuery.in("id", selectedInvoiceIds);
        } else if (recordId) {
          invoiceQuery = invoiceQuery.eq("id", recordId);
        } else if (!syncAll) {
          // Only sync unsynced records
          const { data: syncedIds } = await supabase
            .from("quickbooks_sync_log")
            .select("record_id")
            .eq("company_id", companyId)
            .eq("record_type", "invoice")
            .eq("sync_status", "synced");

          const alreadySynced = (syncedIds || []).map((s) => s.record_id);
          if (alreadySynced.length > 0) {
            invoiceQuery = invoiceQuery.not("id", "in", `(${alreadySynced.join(",")})`);
          }
        }

        const { data: invoices } = await invoiceQuery;

      for (const invoice of invoices || []) {
        try {
          const customerResult = await findOrCreateCustomer(invoice.projects);
          if (!customerResult.id) {
            results.failed++;
            results.errors.push(`Invoice ${invoice.invoice_number}: Failed to find/create customer`);
            continue;
          }
          
          // Track if we created a new customer
          if (customerResult.isNew) {
            results.newEntities?.push({ type: "customer", name: customerResult.name });
          }

          // Check if this invoice was already synced to QB
          const { data: existingSync } = await supabase
            .from("quickbooks_sync_log")
            .select("quickbooks_id")
            .eq("company_id", companyId)
            .eq("record_type", "invoice")
            .eq("record_id", invoice.id)
            .eq("sync_status", "synced")
            .single();

          const existingQbId = existingSync?.quickbooks_id;

          // Get configured mappings
          const itemMapping = getMapping("default_item");

          const lineItem: any = {
            Amount: invoice.amount || 0,
            DetailType: "SalesItemLineDetail",
            SalesItemLineDetail: {
              ItemRef: itemMapping 
                ? { value: itemMapping.qbo_id, name: itemMapping.qbo_name }
                : { value: "1", name: "Services" },
            },
            Description: invoice.description || `Invoice for ${invoice.projects?.project_name || "Project"}`,
          };

          const qbInvoice: any = {
            CustomerRef: { value: String(customerResult.id) },
            DocNumber: invoice.invoice_number?.toString(),
            TxnDate: invoice.invoice_date?.split("T")[0],
            DueDate: invoice.due_date?.split("T")[0],
            Line: [
              {
                Amount: lineItem.Amount,
                DetailType: "SalesItemLineDetail",
                SalesItemLineDetail: {
                  ItemRef: {
                    value: String(lineItem.SalesItemLineDetail?.ItemRef?.value || "1"),
                    name: lineItem.SalesItemLineDetail?.ItemRef?.name || "Services",
                  },
                },
                Description: lineItem.Description,
              },
            ],
            PrivateNote: invoice.notes || undefined,
          };

          stripNullishDeep(qbInvoice);

          let syncRes: Response;
          let syncData: any;

          if (existingQbId) {
            // UPDATE existing invoice - need to fetch SyncToken first
            console.log(`Invoice ${invoice.invoice_number} already exists in QB (ID: ${existingQbId}), updating...`);
            
            const fetchRes = await fetch(`${QB_BASE_URL}/${realm_id}/invoice/${existingQbId}`, {
              headers: qbHeaders,
            });
            
            if (!fetchRes.ok) {
              const errText = await fetchRes.text();
              console.error(`Failed to fetch existing invoice ${existingQbId}:`, errText);
              results.failed++;
              results.errors.push(`Invoice ${invoice.invoice_number}: Failed to fetch existing QB record`);
              continue;
            }
            
            const existingData = await fetchRes.json();
            const syncToken = existingData.Invoice.SyncToken;
            
            // Add Id and SyncToken for update
            qbInvoice.Id = existingQbId;
            qbInvoice.SyncToken = syncToken;
            qbInvoice.sparse = true; // Use sparse update
            
            console.log(`Invoice ${invoice.invoice_number} - Update payload:`, JSON.stringify(qbInvoice, null, 2));
            
            syncRes = await fetch(`${QB_BASE_URL}/${realm_id}/invoice`, {
              method: "POST",
              headers: qbHeaders,
              body: JSON.stringify(qbInvoice),
            });
            
            if (syncRes.ok) {
              syncData = await syncRes.json();
              console.log(`Updated invoice in QB, ID: ${syncData.Invoice.Id}`);
            }
          } else {
            // CREATE new invoice
            console.log(`Invoice ${invoice.invoice_number} - Creating new in QB:`, JSON.stringify(qbInvoice, null, 2));
            
            syncRes = await fetch(`${QB_BASE_URL}/${realm_id}/invoice`, {
              method: "POST",
              headers: qbHeaders,
              body: JSON.stringify(qbInvoice),
            });
            
            if (syncRes.ok) {
              syncData = await syncRes.json();
              console.log(`Created invoice in QB, ID: ${syncData.Invoice.Id}`);
            }
          }

          if (syncRes.ok && syncData) {
            await supabase.from("quickbooks_sync_log").upsert({
              company_id: companyId,
              record_type: "invoice",
              record_id: invoice.id,
              quickbooks_id: syncData.Invoice.Id,
              sync_status: "synced",
              synced_at: new Date().toISOString(),
            });
            results.synced++;
          } else {
            const errText = await syncRes.text();
            console.error(`Failed to sync invoice ${invoice.invoice_number}:`, errText);
            results.failed++;
            results.errors.push(`Invoice ${invoice.invoice_number}: ${errText}`);
          }
        } catch (err: unknown) {
          results.failed++;
          const errMsg = err instanceof Error ? err.message : "Unknown error";
          results.errors.push(`Invoice ${invoice.id}: ${errMsg}`);
        }
        }
      }
    }

    // Sync payments
    if (!syncType || syncType === "payment") {
      // Skip if syncSelected mode and no payments selected
      if (syncSelected && (!selectedPaymentIds || selectedPaymentIds.length === 0)) {
        // Skip payments
      } else {
        let paymentQuery = supabase
          .from("project_payments")
          .select("*, projects!inner(id, project_name, project_address, project_number, company_id, contact_uuid, contact_id)")
          .eq("projects.company_id", companyId)
          .eq("exclude_from_qb", false);

        if (syncSelected && selectedPaymentIds) {
          paymentQuery = paymentQuery.in("id", selectedPaymentIds);
        } else if (recordId) {
          paymentQuery = paymentQuery.eq("id", recordId);
        }

        const { data: payments } = await paymentQuery;

      for (const payment of payments || []) {
        try {
          const customerResult = await findOrCreateCustomer(payment.projects);
          if (!customerResult.id) {
            results.failed++;
            results.errors.push(`Payment ${payment.id}: Failed to find/create customer`);
            continue;
          }
          
          // Track if we created a new customer
          if (customerResult.isNew) {
            results.newEntities?.push({ type: "customer", name: customerResult.name });
          }

          // Get configured payment method mapping
          const paymentMethodMapping = getMapping("payment_method", payment.payment_method);

          // Check if this payment was already synced to QB
          const { data: existingSync } = await supabase
            .from("quickbooks_sync_log")
            .select("quickbooks_id")
            .eq("company_id", companyId)
            .eq("record_type", "payment")
            .eq("record_id", payment.id)
            .eq("sync_status", "synced")
            .single();

          const existingQbId = existingSync?.quickbooks_id;

          const qbPayment: any = {
            CustomerRef: { value: customerResult.id },
            TotalAmt: payment.payment_amount || 0,
            TxnDate: payment.payment_date?.split("T")[0],
            PrivateNote: payment.payment_method ? `${payment.payment_method} - ${payment.payment_reference || ""}` : null,
          };

          // Add payment method if configured
          if (paymentMethodMapping) {
            qbPayment.PaymentMethodRef = {
              value: paymentMethodMapping.qbo_id,
              name: paymentMethodMapping.qbo_name,
            };
          }

          // Add bank account (DepositToAccountRef) if bank_name is set and has a mapping
          if (payment.bank_name) {
            // Look up the bank UUID by name
            const { data: bankRecord } = await supabase
              .from("banks")
              .select("id")
              .eq("company_id", companyId)
              .eq("name", payment.bank_name)
              .single();

            if (bankRecord?.id) {
              // Find the QB bank mapping for this bank
              const bankMapping = getMapping("bank", bankRecord.id);
              if (bankMapping) {
                console.log(`Mapping bank "${payment.bank_name}" to QB account: ${bankMapping.qbo_name} (ID: ${bankMapping.qbo_id})`);
                qbPayment.DepositToAccountRef = {
                  value: bankMapping.qbo_id,
                  name: bankMapping.qbo_name,
                };
              } else {
                console.log(`No QB bank mapping found for bank "${payment.bank_name}" (ID: ${bankRecord.id})`);
              }
            } else {
              console.log(`Bank "${payment.bank_name}" not found in banks table`);
            }
          }

          // Link payment to invoice if invoice_id exists and invoice was synced to QB
          if (payment.invoice_id) {
            const { data: invoiceSyncLog } = await supabase
              .from("quickbooks_sync_log")
              .select("quickbooks_id")
              .eq("company_id", companyId)
              .eq("record_type", "invoice")
              .eq("record_id", payment.invoice_id)
              .eq("sync_status", "synced")
              .single();

            if (invoiceSyncLog?.quickbooks_id) {
              console.log(`Linking payment to QB Invoice ID: ${invoiceSyncLog.quickbooks_id}`);
              qbPayment.Line = [
                {
                  Amount: payment.payment_amount || 0,
                  LinkedTxn: [
                    {
                      TxnId: invoiceSyncLog.quickbooks_id,
                      TxnType: "Invoice",
                    },
                  ],
                },
              ];
            } else {
              console.log(`Invoice ${payment.invoice_id} not synced to QB, payment will be unapplied`);
            }
          }

          let syncRes: Response;
          let syncData: any;

          if (existingQbId) {
            // UPDATE existing payment - need to fetch SyncToken first
            console.log(`Payment ${payment.id} already exists in QB (ID: ${existingQbId}), updating...`);
            
            const fetchRes = await fetch(`${QB_BASE_URL}/${realm_id}/payment/${existingQbId}`, {
              headers: qbHeaders,
            });
            
            if (!fetchRes.ok) {
              const errText = await fetchRes.text();
              console.error(`Failed to fetch existing payment ${existingQbId}:`, errText);
              results.failed++;
              results.errors.push(`Payment ${payment.id}: Failed to fetch existing QB record`);
              continue;
            }
            
            const existingData = await fetchRes.json();
            const syncToken = existingData.Payment.SyncToken;
            
            // Add Id and SyncToken for update
            qbPayment.Id = existingQbId;
            qbPayment.SyncToken = syncToken;
            qbPayment.sparse = true; // Use sparse update to only update provided fields
            
            console.log(`Payment ${payment.id} - Update payload:`, JSON.stringify(qbPayment, null, 2));
            
            syncRes = await fetch(`${QB_BASE_URL}/${realm_id}/payment`, {
              method: "POST",
              headers: qbHeaders,
              body: JSON.stringify(qbPayment),
            });
            
            if (syncRes.ok) {
              syncData = await syncRes.json();
              console.log(`Updated payment in QB, ID: ${syncData.Payment.Id}`);
            }
          } else {
            // CREATE new payment
            console.log(`Payment ${payment.id} - Creating new in QB:`, JSON.stringify(qbPayment, null, 2));
            
            syncRes = await fetch(`${QB_BASE_URL}/${realm_id}/payment`, {
              method: "POST",
              headers: qbHeaders,
              body: JSON.stringify(qbPayment),
            });
            
            if (syncRes.ok) {
              syncData = await syncRes.json();
              console.log(`Created payment in QB, ID: ${syncData.Payment.Id}`);
            }
          }

          if (syncRes.ok && syncData) {
            await supabase.from("quickbooks_sync_log").upsert({
              company_id: companyId,
              record_type: "payment",
              record_id: payment.id,
              quickbooks_id: syncData.Payment.Id,
              sync_status: "synced",
              synced_at: new Date().toISOString(),
            });
            results.synced++;
          } else {
            const errText = await syncRes.text();
            console.error(`Failed to sync payment ${payment.id}:`, errText);
            results.failed++;
            results.errors.push(`Payment ${payment.id}: ${errText}`);
          }
        } catch (err: unknown) {
          results.failed++;
          const errMsg = err instanceof Error ? err.message : "Unknown error";
          results.errors.push(`Payment ${payment.id}: ${errMsg}`);
        }
        }
      }
    }

    // Sync bills
    if (!syncType || syncType === "bill") {
      // Skip if syncSelected mode and no bills selected
      if (syncSelected && (!selectedBillIds || selectedBillIds.length === 0)) {
        // Skip bills
      } else {
        let billQuery = supabase
          .from("project_bills")
          .select("*, projects!inner(project_name, company_id)")
          .eq("projects.company_id", companyId)
          .eq("exclude_from_qb", false);

        if (syncSelected && selectedBillIds) {
          billQuery = billQuery.in("id", selectedBillIds);
        } else if (recordId) {
          billQuery = billQuery.eq("id", recordId);
        }

        const { data: bills, error: billsError } = await billQuery;
        
        console.log(`Found ${bills?.length || 0} bills to sync`, billsError ? `Error: ${billsError.message}` : "");

      for (const bill of bills || []) {
        try {
          // Use installer_company as the vendor name
          const vendorName = bill.installer_company || "Unknown Vendor";
          console.log(`Processing bill ${bill.id} for vendor: ${vendorName}`);
          
          const vendorResult = await findOrCreateVendor(vendorName);
          if (!vendorResult.id) {
            results.failed++;
            results.errors.push(`Bill ${bill.bill_ref || bill.id}: Failed to find/create vendor "${vendorName}"`);
            continue;
          }
          
          // Track if we created a new vendor
          if (vendorResult.isNew) {
            results.newEntities?.push({ type: "vendor", name: vendorResult.name });
          }

          // Check if this bill was already synced to QB
          const { data: existingSync } = await supabase
            .from("quickbooks_sync_log")
            .select("quickbooks_id")
            .eq("company_id", companyId)
            .eq("record_type", "bill")
            .eq("record_id", bill.id)
            .eq("sync_status", "synced")
            .single();

          const existingQbId = existingSync?.quickbooks_id;

          // Get configured expense account mapping
          const expenseAccountMapping = getMapping("expense_account");

          const qbBill: any = {
            VendorRef: { value: vendorResult.id },
            TxnDate: bill.created_at?.split("T")[0],
            Line: [
              {
                Amount: bill.bill_amount || 0,
                DetailType: "AccountBasedExpenseLineDetail",
                AccountBasedExpenseLineDetail: {
                  AccountRef: expenseAccountMapping
                    ? { value: expenseAccountMapping.qbo_id, name: expenseAccountMapping.qbo_name }
                    : { value: "1" },
                },
                Description: `${bill.category || "Bill"} - ${bill.projects?.project_name || "Project"} - Ref: ${bill.bill_ref || "N/A"}`,
              },
            ],
            PrivateNote: bill.memo || null,
          };

          let syncRes: Response;
          let syncData: any;

          if (existingQbId) {
            // UPDATE existing bill - need to fetch SyncToken first
            console.log(`Bill ${bill.bill_ref || bill.id} already exists in QB (ID: ${existingQbId}), updating...`);
            
            const fetchRes = await fetch(`${QB_BASE_URL}/${realm_id}/bill/${existingQbId}`, {
              headers: qbHeaders,
            });
            
            if (!fetchRes.ok) {
              const errText = await fetchRes.text();
              console.error(`Failed to fetch existing bill ${existingQbId}:`, errText);
              results.failed++;
              results.errors.push(`Bill ${bill.bill_ref || bill.id}: Failed to fetch existing QB record`);
              continue;
            }
            
            const existingData = await fetchRes.json();
            const syncToken = existingData.Bill.SyncToken;
            
            // Add Id and SyncToken for update
            qbBill.Id = existingQbId;
            qbBill.SyncToken = syncToken;
            qbBill.sparse = true;
            
            console.log(`Bill ${bill.bill_ref || bill.id} - Update payload:`, JSON.stringify(qbBill, null, 2));
            
            syncRes = await fetch(`${QB_BASE_URL}/${realm_id}/bill`, {
              method: "POST",
              headers: qbHeaders,
              body: JSON.stringify(qbBill),
            });
            
            if (syncRes.ok) {
              syncData = await syncRes.json();
              console.log(`Updated bill in QB, ID: ${syncData.Bill.Id}`);
            }
          } else {
            // CREATE new bill
            console.log(`Bill ${bill.bill_ref || bill.id} - Creating new in QB:`, JSON.stringify(qbBill, null, 2));
            
            syncRes = await fetch(`${QB_BASE_URL}/${realm_id}/bill`, {
              method: "POST",
              headers: qbHeaders,
              body: JSON.stringify(qbBill),
            });
            
            if (syncRes.ok) {
              syncData = await syncRes.json();
              console.log(`Created bill in QB, ID: ${syncData.Bill.Id}`);
            }
          }

          if (syncRes.ok && syncData) {
            await supabase.from("quickbooks_sync_log").upsert({
              company_id: companyId,
              record_type: "bill",
              record_id: bill.id,
              quickbooks_id: syncData.Bill.Id,
              sync_status: "synced",
              synced_at: new Date().toISOString(),
            });
            results.synced++;
          } else {
            const errText = await syncRes.text();
            console.error(`Failed to sync bill ${bill.id}:`, errText);
            results.failed++;
            results.errors.push(`Bill ${bill.bill_ref || bill.id}: ${errText}`);
          }
        } catch (err: unknown) {
          results.failed++;
          const errMsg = err instanceof Error ? err.message : "Unknown error";
          console.error(`Error syncing bill ${bill.id}:`, errMsg);
          results.errors.push(`Bill ${bill.id}: ${errMsg}`);
        }
        }
      }
    }

    // Sync bill payments
    if (!syncType || syncType === "bill_payment") {
      let billPaymentQuery = supabase
        .from("bill_payments")
        .select("*, project_bills!inner(id, bill_ref, installer_company, projects!inner(project_name, company_id))")
        .eq("project_bills.projects.company_id", companyId);

      if (recordId) {
        billPaymentQuery = billPaymentQuery.eq("id", recordId);
      }

      const { data: billPayments, error: billPaymentsError } = await billPaymentQuery;
      
      console.log(`Found ${billPayments?.length || 0} bill payments to sync`, billPaymentsError ? `Error: ${billPaymentsError.message}` : "");

      for (const billPayment of billPayments || []) {
        try {
          // Check if the parent bill was synced to QB
          const { data: billSyncLog } = await supabase
            .from("quickbooks_sync_log")
            .select("quickbooks_id")
            .eq("company_id", companyId)
            .eq("record_type", "bill")
            .eq("record_id", billPayment.bill_id)
            .eq("sync_status", "synced")
            .single();

          if (!billSyncLog?.quickbooks_id) {
            console.log(`Bill ${billPayment.bill_id} not synced to QB, skipping bill payment`);
            continue;
          }

          // Check if this bill payment was already synced
          const { data: existingSync } = await supabase
            .from("quickbooks_sync_log")
            .select("quickbooks_id")
            .eq("company_id", companyId)
            .eq("record_type", "bill_payment")
            .eq("record_id", billPayment.id)
            .eq("sync_status", "synced")
            .single();

          const existingQbId = existingSync?.quickbooks_id;

          // Find the vendor for this bill
          const vendorName = billPayment.project_bills?.installer_company || "Unknown Vendor";
          const vendorCheck = await checkVendorExists(vendorName);
          
          if (!vendorCheck.exists || !vendorCheck.id) {
            console.log(`Vendor "${vendorName}" not found in QB, skipping bill payment`);
            results.failed++;
            results.errors.push(`Bill Payment ${billPayment.id}: Vendor not found in QB`);
            continue;
          }

          const qbBillPayment: any = {
            VendorRef: { value: vendorCheck.id },
            TotalAmt: billPayment.payment_amount || 0,
            TxnDate: billPayment.payment_date?.split("T")[0],
            Line: [
              {
                Amount: billPayment.payment_amount || 0,
                LinkedTxn: [
                  {
                    TxnId: billSyncLog.quickbooks_id,
                    TxnType: "Bill",
                  },
                ],
              },
            ],
          };

          // Add payment reference as DocNumber (check/ref number field)
          if (billPayment.payment_reference) {
            qbBillPayment.DocNumber = billPayment.payment_reference;
          }

          // Add bank account if bank_name is set and has a mapping
          if (billPayment.bank_name) {
            const { data: bankRecord } = await supabase
              .from("banks")
              .select("id")
              .eq("company_id", companyId)
              .eq("name", billPayment.bank_name)
              .single();

            if (bankRecord?.id) {
              const bankMapping = getMapping("bank", bankRecord.id);
              if (bankMapping) {
                console.log(`Mapping bank "${billPayment.bank_name}" to QB account: ${bankMapping.qbo_name}`);
                qbBillPayment.PayType = "Check";
                qbBillPayment.CheckPayment = {
                  BankAccountRef: {
                    value: bankMapping.qbo_id,
                    name: bankMapping.qbo_name,
                  },
                  // If we have a check/reference number, mark as already printed (not "Print Later")
                  PrintStatus: billPayment.payment_reference ? "PrintComplete" : "NeedToPrint",
                };
              }
            }
          }

          let syncRes: Response;
          let syncData: any;

          if (existingQbId) {
            // UPDATE existing bill payment
            console.log(`Bill Payment ${billPayment.id} already exists in QB (ID: ${existingQbId}), updating...`);
            
            const fetchRes = await fetch(`${QB_BASE_URL}/${realm_id}/billpayment/${existingQbId}`, {
              headers: qbHeaders,
            });
            
            if (!fetchRes.ok) {
              const errText = await fetchRes.text();
              console.error(`Failed to fetch existing bill payment ${existingQbId}:`, errText);
              results.failed++;
              results.errors.push(`Bill Payment ${billPayment.id}: Failed to fetch existing QB record`);
              continue;
            }
            
            const existingData = await fetchRes.json();
            const syncToken = existingData.BillPayment.SyncToken;
            
            qbBillPayment.Id = existingQbId;
            qbBillPayment.SyncToken = syncToken;
            qbBillPayment.sparse = true;
            
            console.log(`Bill Payment ${billPayment.id} - Update payload:`, JSON.stringify(qbBillPayment, null, 2));
            
            syncRes = await fetch(`${QB_BASE_URL}/${realm_id}/billpayment`, {
              method: "POST",
              headers: qbHeaders,
              body: JSON.stringify(qbBillPayment),
            });
            
            if (syncRes.ok) {
              syncData = await syncRes.json();
              console.log(`Updated bill payment in QB, ID: ${syncData.BillPayment.Id}`);
            }
          } else {
            // CREATE new bill payment
            console.log(`Bill Payment ${billPayment.id} - Creating new in QB:`, JSON.stringify(qbBillPayment, null, 2));
            
            syncRes = await fetch(`${QB_BASE_URL}/${realm_id}/billpayment`, {
              method: "POST",
              headers: qbHeaders,
              body: JSON.stringify(qbBillPayment),
            });
            
            if (syncRes.ok) {
              syncData = await syncRes.json();
              console.log(`Created bill payment in QB, ID: ${syncData.BillPayment.Id}`);
            }
          }

          if (syncRes.ok && syncData) {
            await supabase.from("quickbooks_sync_log").upsert({
              company_id: companyId,
              record_type: "bill_payment",
              record_id: billPayment.id,
              quickbooks_id: syncData.BillPayment.Id,
              sync_status: "synced",
              synced_at: new Date().toISOString(),
            });
            results.synced++;
          } else {
            const errText = await syncRes.text();
            console.error(`Failed to sync bill payment ${billPayment.id}:`, errText);
            results.failed++;
            results.errors.push(`Bill Payment ${billPayment.id}: ${errText}`);
          }
        } catch (err: unknown) {
          results.failed++;
          const errMsg = err instanceof Error ? err.message : "Unknown error";
          console.error(`Error syncing bill payment ${billPayment.id}:`, errMsg);
          results.errors.push(`Bill Payment ${billPayment.id}: ${errMsg}`);
        }
      }
    }

    // Sync commission payments (as QuickBooks Checks to vendors)
    if (syncType === "commission_payment") {
      if (!recordId) {
        return new Response(
          JSON.stringify({ error: "recordId is required for commission_payment sync" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: commissionPayment, error: cpError } = await supabase
        .from("commission_payments")
        .select("*, projects!inner(id, project_name, project_number, company_id)")
        .eq("id", recordId)
        .single();

      if (cpError || !commissionPayment) {
        console.error("Failed to fetch commission payment:", cpError);
        return new Response(
          JSON.stringify({ error: "Commission payment not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        // Find salesperson record to get ID for vendor mapping
        const { data: salesperson } = await supabase
          .from("salespeople")
          .select("id, name")
          .eq("company_id", companyId)
          .eq("name", commissionPayment.salesperson_name)
          .single();

        if (!salesperson) {
          results.failed++;
          results.errors.push(`Commission Payment: Salesperson "${commissionPayment.salesperson_name}" not found`);
          return new Response(
            JSON.stringify({ success: false, ...results }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Check for vendor mapping
        const vendorMapping = getMapping("salesperson_vendor", salesperson.id);
        let vendorId: string | null = null;
        let vendorName = commissionPayment.salesperson_name;

        if (vendorMapping && vendorMapping.qbo_id !== "PENDING_CREATE") {
          vendorId = vendorMapping.qbo_id;
          console.log(`Found vendor mapping for salesperson ${salesperson.id}: QB ID ${vendorId}`);
        } else if (vendorMapping && vendorMapping.qbo_id === "PENDING_CREATE") {
          // Create vendor in QB
          console.log(`Creating vendor for salesperson ${salesperson.name}...`);
          const createResult = await findOrCreateVendor(vendorMapping.qbo_name || salesperson.name);
          if (createResult.id) {
            vendorId = createResult.id;
            vendorName = createResult.name;
            
            // Update the mapping with the real QB ID
            await supabase
              .from("quickbooks_mappings")
              .update({ qbo_id: vendorId })
              .eq("company_id", companyId)
              .eq("mapping_type", "salesperson_vendor")
              .eq("source_value", salesperson.id);
            
            if (createResult.isNew) {
              results.newEntities?.push({ type: "vendor", name: vendorName });
            }
          }
        } else {
          // No mapping - try to find or create vendor by name
          const vendorResult = await findOrCreateVendor(salesperson.name);
          if (vendorResult.id) {
            vendorId = vendorResult.id;
            vendorName = vendorResult.name;
            if (vendorResult.isNew) {
              results.newEntities?.push({ type: "vendor", name: vendorName });
            }
          }
        }

        if (!vendorId) {
          results.failed++;
          results.errors.push(`Commission Payment: Failed to find/create vendor for "${commissionPayment.salesperson_name}"`);
          return new Response(
            JSON.stringify({ success: false, ...results }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Check if already synced
        const { data: existingSync } = await supabase
          .from("quickbooks_sync_log")
          .select("quickbooks_id")
          .eq("company_id", companyId)
          .eq("record_type", "commission_payment")
          .eq("record_id", recordId)
          .eq("sync_status", "synced")
          .single();

        const existingQbId = existingSync?.quickbooks_id;

        // Get expense account mapping for commissions
        const expenseAccountMapping = getMapping("expense_account");

        // Build QuickBooks Check (Purchase) object
        // NOTE: TotalAmt is read-only and calculated from Line items - do NOT include it
        const qbCheck: any = {
          PayeeRef: { value: String(vendorId) },
          TxnDate: commissionPayment.payment_date?.split("T")[0] || new Date().toISOString().split("T")[0],
          Line: [
            {
              Amount: commissionPayment.payment_amount || 0,
              DetailType: "AccountBasedExpenseLineDetail",
              AccountBasedExpenseLineDetail: {
                AccountRef: expenseAccountMapping
                  ? { value: String(expenseAccountMapping.qbo_id), name: expenseAccountMapping.qbo_name }
                  : { value: "1" },
              },
              Description: `Commission Payment - ${commissionPayment.projects?.project_name || "Project"} - ${commissionPayment.salesperson_name}`,
            },
          ],
          PrivateNote: commissionPayment.notes || `Commission for ${commissionPayment.salesperson_name}`,
        };

        // Add check number/reference if provided
        if (commissionPayment.payment_reference) {
          qbCheck.DocNumber = commissionPayment.payment_reference;
          qbCheck.PrintStatus = "PrintComplete"; // Already printed/issued
        }

        // Add bank account - REQUIRED for Check type Purchase
        // For Purchase objects, the bank account goes in AccountRef (not BankAccountRef)
        if (commissionPayment.bank_name) {
          const { data: bankRecord } = await supabase
            .from("banks")
            .select("id")
            .eq("company_id", companyId)
            .eq("name", commissionPayment.bank_name)
            .single();

          if (bankRecord?.id) {
            const bankMapping = getMapping("bank", bankRecord.id);
            if (bankMapping) {
              console.log(`Mapping bank "${commissionPayment.bank_name}" to QB account: ${bankMapping.qbo_name}`);
              qbCheck.AccountRef = {
                value: String(bankMapping.qbo_id),
                name: bankMapping.qbo_name,
              };
            }
          }
        }
        
        // If no bank mapping found, we need a default bank account (AccountRef is required for Check)
        if (!qbCheck.AccountRef) {
          const defaultBankMapping = getMapping("default_bank");
          if (defaultBankMapping) {
            qbCheck.AccountRef = {
              value: String(defaultBankMapping.qbo_id),
              name: defaultBankMapping.qbo_name,
            };
          } else {
            results.failed++;
            results.errors.push(`Commission Payment: No bank account mapped. Please configure a bank account mapping in QuickBooks settings.`);
            return new Response(
              JSON.stringify({ success: false, ...results }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }

        let syncRes: Response;
        let syncData: any;

        if (existingQbId) {
          // UPDATE existing check
          console.log(`Commission Check ${recordId} already exists in QB (ID: ${existingQbId}), updating...`);
          
          const fetchRes = await fetch(`${QB_BASE_URL}/${realm_id}/purchase/${existingQbId}`, {
            headers: qbHeaders,
          });
          
          if (!fetchRes.ok) {
            const errText = await fetchRes.text();
            console.error(`Failed to fetch existing check ${existingQbId}:`, errText);
            results.failed++;
            results.errors.push(`Commission Payment: Failed to fetch existing QB record`);
          } else {
            const existingData = await fetchRes.json();
            const syncToken = existingData.Purchase.SyncToken;
            
            qbCheck.Id = existingQbId;
            qbCheck.SyncToken = syncToken;
            qbCheck.sparse = true;
            qbCheck.PaymentType = "Check";
            
            console.log(`Commission Check - Update payload:`, JSON.stringify(qbCheck, null, 2));
            
            syncRes = await fetch(`${QB_BASE_URL}/${realm_id}/purchase`, {
              method: "POST",
              headers: qbHeaders,
              body: JSON.stringify(qbCheck),
            });
            
            if (syncRes.ok) {
              syncData = await syncRes.json();
              console.log(`Updated commission check in QB, ID: ${syncData.Purchase.Id}`);
            }
          }
        } else {
          // CREATE new check (Purchase with PaymentType=Check)
          qbCheck.PaymentType = "Check";
          console.log(`Commission Check - Creating new in QB:`, JSON.stringify(qbCheck, null, 2));
          
          syncRes = await fetch(`${QB_BASE_URL}/${realm_id}/purchase`, {
            method: "POST",
            headers: qbHeaders,
            body: JSON.stringify(qbCheck),
          });
          
          if (syncRes!.ok) {
            syncData = await syncRes!.json();
            console.log(`Created commission check in QB, ID: ${syncData.Purchase.Id}`);
          }
        }

        if (syncRes! && syncRes!.ok && syncData) {
          await supabase.from("quickbooks_sync_log").upsert({
            company_id: companyId,
            record_type: "commission_payment",
            record_id: recordId,
            quickbooks_id: syncData.Purchase.Id,
            sync_status: "synced",
            synced_at: new Date().toISOString(),
          });
          results.synced++;
        } else if (syncRes!) {
          const errText = await syncRes!.text();
          console.error(`Failed to sync commission payment:`, errText);
          results.failed++;
          results.errors.push(`Commission Payment: ${errText}`);
        }
      } catch (err: unknown) {
        results.failed++;
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        console.error(`Error syncing commission payment:`, errMsg);
        results.errors.push(`Commission Payment: ${errMsg}`);
      }
    }

    // Update last sync time
    await supabase
      .from("quickbooks_connections")
      .update({ last_sync_at: new Date().toISOString(), sync_error: null })
      .eq("company_id", companyId);

    return new Response(
      JSON.stringify({ success: true, ...results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("QuickBooks sync error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
