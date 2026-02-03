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

    const { companyId, syncType, recordId, syncAll, syncSelected, selectedRecords, checkOnly, checkVendorName, qbBillId, forceCreateBill } = await req.json();

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

    // Track just-synced bills in this request to avoid stale sync_log lookups
    // Key: local bill ID, Value: QB bill ID
    const justSyncedBillQbIds: Map<string, string> = new Map();

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
      
      // Check for bills - support both recordId lookup and direct vendor name check
      if (syncType === "bill") {
        let vendorNameToCheck: string | null = null;
        
        if (recordId) {
          // Lookup vendor from existing bill record
          const { data: bill } = await supabase
            .from("project_bills")
            .select("installer_company")
            .eq("id", recordId)
            .single();
          vendorNameToCheck = bill?.installer_company || null;
        } else if (checkVendorName) {
          // Direct vendor name check (pre-save mode)
          vendorNameToCheck = checkVendorName;
        }
        
        if (vendorNameToCheck) {
          const check = await checkVendorExists(vendorNameToCheck);
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

    // Handle link_bill mode - link a local bill to an existing QB bill without re-syncing
    if (syncType === "link_bill") {
      if (!recordId || !qbBillId) {
        return new Response(
          JSON.stringify({ error: "recordId and qbBillId are required for link_bill sync type" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Linking local bill ${recordId} to QB bill ${qbBillId}`);

      // Verify the QB bill exists in QuickBooks
      const verifyRes = await fetch(`${QB_BASE_URL}/${realm_id}/bill/${qbBillId}`, {
        headers: qbHeaders,
      });

      if (!verifyRes.ok) {
        const errText = await verifyRes.text();
        console.error(`QB bill ${qbBillId} not found:`, errText);
        return new Response(
          JSON.stringify({ 
            error: `QuickBooks bill ${qbBillId} not found or inaccessible`,
            synced: 0,
            failed: 1,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const qbBillData = await verifyRes.json();
      console.log(`Verified QB bill ${qbBillId} exists:`, qbBillData.Bill?.DocNumber);

      // Upsert the sync log entry to link local bill to QB bill
      const { error: upsertError } = await supabase
        .from("quickbooks_sync_log")
        .upsert({
          company_id: companyId,
          record_type: "bill",
          record_id: recordId,
          quickbooks_id: qbBillId,
          sync_status: "synced",
          synced_at: new Date().toISOString(),
        }, { onConflict: "company_id,record_type,record_id" });

      if (upsertError) {
        console.error(`Failed to upsert sync log:`, upsertError);
        return new Response(
          JSON.stringify({ 
            error: `Failed to link bill: ${upsertError.message}`,
            synced: 0,
            failed: 1,
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Successfully linked local bill ${recordId} to QB bill ${qbBillId}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          synced: 1, 
          failed: 0,
          linkedQbBillId: qbBillId,
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
          .select("*, projects!inner(id, project_name, project_address, project_number, contact_uuid, contact_id, auto_sync_to_quickbooks)")
          .eq("projects.company_id", companyId)
          .eq("projects.auto_sync_to_quickbooks", true)
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
            }, { onConflict: "company_id,record_type,record_id" });
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
          .select("*, projects!inner(id, project_name, project_address, project_number, company_id, contact_uuid, contact_id, auto_sync_to_quickbooks)")
          .eq("projects.company_id", companyId)
          .eq("projects.auto_sync_to_quickbooks", true)
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
            }, { onConflict: "company_id,record_type,record_id" });
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
          .select("*, projects!inner(id, project_name, company_id, auto_sync_to_quickbooks, contact_uuid, contact_id)")
          .eq("projects.company_id", companyId)
          .eq("projects.auto_sync_to_quickbooks", true)
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

          // Check if this bill was already synced to QB.
          // IMPORTANT: we must treat `pending_refresh` as an existing QB record too.
          // The inbound webhook can mark records as `pending_refresh`, and if we only
          // look for `synced`, we can incorrectly POST a *new* Bill (duplicate in QB).
          const { data: existingSync } = await supabase
            .from("quickbooks_sync_log")
            .select("quickbooks_id")
            .eq("company_id", companyId)
            .eq("record_type", "bill")
            .eq("record_id", bill.id)
            .in("sync_status", ["synced", "pending_refresh"])
            .not("quickbooks_id", "is", null)
            .order("synced_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          // If the existingQbId starts with "backfill-", it's a placeholder from data migration
          // and not a real QuickBooks ID - treat as new bill
          const rawExistingQbId = existingSync?.quickbooks_id || null;
          const shouldForceCreateThisBill = Boolean(forceCreateBill && recordId && bill.id === recordId);

          const existingQbId = shouldForceCreateThisBill
            ? null
            : (rawExistingQbId?.startsWith("backfill-") ? null : rawExistingQbId);

          if (shouldForceCreateThisBill) {
            console.log(
              `forceCreateBill=true for ${recordId}. Ignoring existing QB bill mapping (${rawExistingQbId || "none"}) and creating a new Bill in QuickBooks.`
            );
          }
          
          if (rawExistingQbId?.startsWith("backfill-")) {
            console.log(`Bill ${bill.id} has backfill placeholder ID (${rawExistingQbId}), will create new in QB`);
          }

          // Get configured expense account mapping (global default)
          const globalExpenseAccountMapping = getMapping("expense_account");

          // Look up vendor-specific expense account by finding the subcontractor mapping
          // First, find subcontractor by vendor name (installer_company)
          const { data: subcontractor } = await supabase
            .from("subcontractors")
            .select("id")
            .eq("company_id", companyId)
            .eq("company_name", vendorName)
            .maybeSingle();

          let vendorExpenseAccount: { value: string; name: string } | null = null;
          if (subcontractor?.id) {
            // Find vendor mapping with optional expense account override
            const vendorMapping = mappings?.find(m => 
              m.mapping_type === "vendor" && m.source_value === subcontractor.id
            );
            if (vendorMapping?.default_expense_account_id && vendorMapping?.default_expense_account_name) {
              vendorExpenseAccount = {
                value: vendorMapping.default_expense_account_id,
                name: vendorMapping.default_expense_account_name,
              };
              console.log(`Using vendor-specific expense account: ${vendorExpenseAccount.name}`);
            }
          }

          // Use vendor-specific account if available, otherwise fall back to global
          const expenseAccountRef = vendorExpenseAccount 
            ? vendorExpenseAccount
            : globalExpenseAccountMapping 
              ? { value: globalExpenseAccountMapping.qbo_id, name: globalExpenseAccountMapping.qbo_name }
              : { value: "1" };

          // Look up customer mapping for job costing (link bill to project)
          let customerRef: { value: string; name?: string } | undefined;
          const projectId = bill.projects?.id;
          const contactUuid = bill.projects?.contact_uuid;
          const contactGhlId = bill.projects?.contact_id;

          // Priority 1: Check for direct project_customer mapping
          if (projectId) {
            const projectMapping = mappings?.find(m => 
              m.mapping_type === "project_customer" && 
              m.source_value === projectId
            );
            
            if (projectMapping && projectMapping.qbo_id) {
              customerRef = { 
                value: projectMapping.qbo_id, 
                name: projectMapping.qbo_name || undefined 
              };
              console.log(`Found project_customer mapping for bill job costing:`, customerRef);
            }
          }

          // Priority 2: Fall back to contact-based customer mapping
          if (!customerRef && (contactUuid || contactGhlId)) {
            const contactMapping = mappings?.find(m => 
              m.mapping_type === "customer" && 
              (m.source_value === contactUuid || m.source_value === contactGhlId)
            );
            
            if (contactMapping && contactMapping.qbo_id) {
              customerRef = { 
                value: contactMapping.qbo_id, 
                name: contactMapping.qbo_name || undefined 
              };
              console.log(`Found contact customer mapping for bill job costing:`, customerRef);
            }
          }

          const qbBill: any = {
            VendorRef: { value: vendorResult.id },
            TxnDate: bill.created_at?.split("T")[0],
            Line: [
              {
                Amount: bill.bill_amount || 0,
                DetailType: "AccountBasedExpenseLineDetail",
                AccountBasedExpenseLineDetail: {
                  AccountRef: expenseAccountRef,
                  // Add CustomerRef for job costing - links expense to the project/customer
                  ...(customerRef && { CustomerRef: customerRef }),
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
            const existingBillData = existingData.Bill;
            
            // Add Id and SyncToken for update
            qbBill.Id = existingQbId;
            qbBill.SyncToken = syncToken;
            qbBill.sparse = true;
            
            // Preserve CustomerRef from existing line items to maintain job costing association
            // QB requires CustomerRef to be included to maintain the project/customer link
            if (existingBillData.Line && existingBillData.Line.length > 0) {
              const existingLine = existingBillData.Line.find((l: any) => 
                l.DetailType === "AccountBasedExpenseLineDetail" || l.DetailType === "ItemBasedExpenseLineDetail"
              );
              
              if (existingLine) {
                const customerRef = existingLine.AccountBasedExpenseLineDetail?.CustomerRef || 
                                    existingLine.ItemBasedExpenseLineDetail?.CustomerRef;
                
                if (customerRef && qbBill.Line && qbBill.Line[0]) {
                  // Add CustomerRef to our update payload to preserve it
                  if (qbBill.Line[0].AccountBasedExpenseLineDetail) {
                    qbBill.Line[0].AccountBasedExpenseLineDetail.CustomerRef = customerRef;
                    console.log(`Preserving CustomerRef on bill update:`, customerRef);
                  }
                }
              }
            }
            
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
            const newQbId = syncData.Bill.Id;
            
            // Track this bill's QB ID for bill payment sync later in this request
            justSyncedBillQbIds.set(bill.id, newQbId);
            
            await supabase.from("quickbooks_sync_log").upsert({
              company_id: companyId,
              record_type: "bill",
              record_id: bill.id,
              quickbooks_id: newQbId,
              sync_status: "synced",
              synced_at: new Date().toISOString(),
            }, { onConflict: "company_id,record_type,record_id" });
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
        .select("*, project_bills!inner(id, bill_ref, installer_company, projects!inner(project_name, company_id, auto_sync_to_quickbooks))")
        .eq("project_bills.projects.company_id", companyId)
        .eq("project_bills.projects.auto_sync_to_quickbooks", true);

      if (recordId) {
        billPaymentQuery = billPaymentQuery.eq("id", recordId);
      }

      const { data: billPayments, error: billPaymentsError } = await billPaymentQuery;
      
      console.log(`Found ${billPayments?.length || 0} bill payments to sync`, billPaymentsError ? `Error: ${billPaymentsError.message}` : "");

      for (const billPayment of billPayments || []) {
        try {
          // First check if we just synced this bill in the current request
          let billQbId = justSyncedBillQbIds.get(billPayment.bill_id);
          let billQbIdSource = billQbId ? "just_synced" : "sync_log";
          
          // If not just synced, check the sync log
          if (!billQbId) {
            const { data: billSyncLog } = await supabase
              .from("quickbooks_sync_log")
              .select("quickbooks_id")
              .eq("company_id", companyId)
              .eq("record_type", "bill")
              .eq("record_id", billPayment.bill_id)
              .in("sync_status", ["synced", "pending_refresh"])
              .not("quickbooks_id", "is", null)
              .order("synced_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            billQbId = billSyncLog?.quickbooks_id || null;
          }

          // Skip if bill not synced OR if it has an invalid backfill placeholder ID
          if (!billQbId || billQbId.startsWith("backfill-")) {
            console.log(`Bill ${billPayment.bill_id} not synced to QB (qbId: ${billQbId || 'none'}), skipping bill payment`);
            continue;
          }

          // CRITICAL: Verify the bill still exists in QuickBooks before linking
          // This prevents QB from auto-creating a blank bill when we reference a deleted one
          console.log(`Verifying bill ${billQbId} exists in QB (source: ${billQbIdSource})`);
          const billCheckRes = await fetch(`${QB_BASE_URL}/${realm_id}/bill/${billQbId}`, {
            headers: qbHeaders,
          });
          
          if (!billCheckRes.ok) {
            const errText = await billCheckRes.text();
            console.error(`Bill ${billQbId} no longer exists in QB or fetch failed:`, errText);
            
            // Mark the sync log as stale so it gets re-synced
            await supabase
              .from("quickbooks_sync_log")
              .update({ 
                sync_status: "needs_resync",
                sync_error: `Bill ${billQbId} not found in QuickBooks - needs to be re-synced`
              })
              .eq("company_id", companyId)
              .eq("record_type", "bill")
              .eq("record_id", billPayment.bill_id);
            
            results.failed++;
            results.errors.push(`Bill Payment ${billPayment.id}: Parent bill ${billQbId} not found in QB - bill needs to be re-synced first`);
            continue;
          }
          
          console.log(`Bill ${billQbId} verified to exist in QB`);

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
                    TxnId: billQbId,
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

          // Determine PayType based on payment_method from the record
          // QB BillPayment only supports Check or CreditCard
          const paymentMethod = billPayment.payment_method?.toLowerCase() || "check";
          
          if (paymentMethod === "credit card") {
            qbBillPayment.PayType = "CreditCard";
            qbBillPayment.CreditCardPayment = {};
          } else {
            // Check, ACH, Wire, Cash, Other all map to Check type in QB
            // Note: QB will show these as "offline" payments because they weren't processed
            // through QuickBooks Payments - this is expected behavior for manually recorded payments
            qbBillPayment.PayType = "Check";
            qbBillPayment.CheckPayment = {
              // If we have a reference number, mark as already printed
              PrintStatus: billPayment.payment_reference ? "PrintComplete" : "NeedToPrint",
            };
          }

          // Add bank account if bank_name is set and has a mapping (only for Check payments)
          if (billPayment.bank_name && qbBillPayment.PayType === "Check") {
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
                qbBillPayment.CheckPayment.BankAccountRef = {
                  value: bankMapping.qbo_id,
                  name: bankMapping.qbo_name,
                };
              } else {
                console.log(`No QB bank mapping found for bank "${billPayment.bank_name}"`);
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
            }, { onConflict: "company_id,record_type,record_id" });
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
        .select("*, projects!inner(id, project_name, project_number, project_address, contact_uuid, contact_id, company_id, auto_sync_to_quickbooks)")
        .eq("id", recordId)
        .eq("projects.auto_sync_to_quickbooks", true)
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

        // Find or create customer for the project so we can assign the expense
        const customerResult = await findOrCreateCustomer(commissionPayment.projects);
        let customerRef: { value: string; name?: string } | undefined;
        
        if (customerResult.id) {
          customerRef = { value: String(customerResult.id), name: customerResult.name };
          console.log(`Linking commission to customer: ${customerResult.name} (ID: ${customerResult.id})`);
          if (customerResult.isNew) {
            results.newEntities?.push({ type: "customer", name: customerResult.name });
          }
        } else {
          console.log(`Warning: Could not find/create customer for project, commission will not be linked to customer`);
        }

        // Build QuickBooks Check (Purchase) object
        // NOTE: TotalAmt is read-only and calculated from Line items - do NOT include it
        const lineDetail: any = {
          AccountRef: expenseAccountMapping
            ? { value: String(expenseAccountMapping.qbo_id), name: expenseAccountMapping.qbo_name }
            : { value: "1" },
        };
        
        // Add CustomerRef to the line item to link expense to the project/customer
        if (customerRef) {
          lineDetail.CustomerRef = customerRef;
        }

        const qbCheck: any = {
          // Purchase uses EntityRef (not PayeeRef)
          EntityRef: {
            value: String(vendorId),
            name: vendorName,
            type: "Vendor",
          },
          TxnDate: commissionPayment.payment_date?.split("T")[0] || new Date().toISOString().split("T")[0],
          Line: [
            {
              Amount: commissionPayment.payment_amount || 0,
              DetailType: "AccountBasedExpenseLineDetail",
              AccountBasedExpenseLineDetail: lineDetail,
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
          }, { onConflict: "company_id,record_type,record_id" });
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
