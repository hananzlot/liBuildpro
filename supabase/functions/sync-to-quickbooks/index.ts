import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const QB_BASE_URL = "https://quickbooks.api.intuit.com/v3/company";

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
    // Helper to check if customer exists in QB (returns null if not found)
    async function checkCustomerExists(project: any): Promise<{ exists: boolean; id: string | null; name: string }> {
      const customerName = project.project_name || project.project_address || `Project ${project.project_number}`;
      
      const searchUrl = `${QB_BASE_URL}/${realm_id}/query?query=${encodeURIComponent(`SELECT * FROM Customer WHERE DisplayName = '${customerName.replace(/'/g, "\\'")}'`)}`;
      
      const searchRes = await fetch(searchUrl, { headers: qbHeaders });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.QueryResponse?.Customer?.length > 0) {
          return { exists: true, id: searchData.QueryResponse.Customer[0].Id, name: customerName };
        }
      }
      
      return { exists: false, id: null, name: customerName };
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
            .select("*, projects!inner(project_name, project_address, project_number)")
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
          .select("*, projects!inner(project_name, project_address, project_number)")
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
          .select("*, projects!inner(project_name, project_address, project_number)")
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

          // Get configured mappings
          const itemMapping = getMapping("default_item");
          const incomeAccountMapping = getMapping("income_account");

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

          // Add income account override if configured
          if (incomeAccountMapping) {
            lineItem.SalesItemLineDetail.IncomeAccountRef = {
              value: incomeAccountMapping.qbo_id,
              name: incomeAccountMapping.qbo_name,
            };
          }

          const qbInvoice = {
            CustomerRef: { value: customerResult.id },
            DocNumber: invoice.invoice_number?.toString(),
            TxnDate: invoice.invoice_date?.split("T")[0],
            DueDate: invoice.due_date?.split("T")[0],
            Line: [lineItem],
            PrivateNote: invoice.notes,
          };

          const createRes = await fetch(`${QB_BASE_URL}/${realm_id}/invoice`, {
            method: "POST",
            headers: qbHeaders,
            body: JSON.stringify(qbInvoice),
          });

          if (createRes.ok) {
            const created = await createRes.json();
            await supabase.from("quickbooks_sync_log").upsert({
              company_id: companyId,
              record_type: "invoice",
              record_id: invoice.id,
              quickbooks_id: created.Invoice.Id,
              sync_status: "synced",
              synced_at: new Date().toISOString(),
            });
            results.synced++;
          } else {
            const errText = await createRes.text();
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
          .select("*, projects!inner(project_name, project_address, project_number, company_id)")
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

          const createRes = await fetch(`${QB_BASE_URL}/${realm_id}/payment`, {
            method: "POST",
            headers: qbHeaders,
            body: JSON.stringify(qbPayment),
          });

          if (createRes.ok) {
            const created = await createRes.json();
            await supabase.from("quickbooks_sync_log").upsert({
              company_id: companyId,
              record_type: "payment",
              record_id: payment.id,
              quickbooks_id: created.Payment.Id,
              sync_status: "synced",
              synced_at: new Date().toISOString(),
            });
            results.synced++;
          } else {
            results.failed++;
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

          // Get configured expense account mapping
          const expenseAccountMapping = getMapping("expense_account");

          const qbBill = {
            VendorRef: { value: vendorResult.id },
            TxnDate: bill.created_at?.split("T")[0], // Use created_at since no bill_date column
            Line: [
              {
                Amount: bill.bill_amount || 0,
                DetailType: "AccountBasedExpenseLineDetail",
                AccountBasedExpenseLineDetail: {
                  AccountRef: expenseAccountMapping
                    ? { value: expenseAccountMapping.qbo_id, name: expenseAccountMapping.qbo_name }
                    : { value: "1" }, // Default expense account
                },
                Description: `${bill.category || "Bill"} - ${bill.projects?.project_name || "Project"} - Ref: ${bill.bill_ref || "N/A"}`,
              },
            ],
            PrivateNote: bill.memo || null,
          };

          console.log(`Syncing bill to QB:`, JSON.stringify(qbBill));

          const createRes = await fetch(`${QB_BASE_URL}/${realm_id}/bill`, {
            method: "POST",
            headers: qbHeaders,
            body: JSON.stringify(qbBill),
          });

          if (createRes.ok) {
            const created = await createRes.json();
            console.log(`Bill synced successfully, QB ID: ${created.Bill.Id}`);
            await supabase.from("quickbooks_sync_log").upsert({
              company_id: companyId,
              record_type: "bill",
              record_id: bill.id,
              quickbooks_id: created.Bill.Id,
              sync_status: "synced",
              synced_at: new Date().toISOString(),
            });
            results.synced++;
          } else {
            const errText = await createRes.text();
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
