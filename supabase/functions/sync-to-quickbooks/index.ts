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

    const { companyId, syncType, recordId, syncAll } = await req.json();

    if (!companyId) {
      return new Response(
        JSON.stringify({ error: "companyId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    const results: { synced: number; failed: number; errors: string[] } = {
      synced: 0,
      failed: 0,
      errors: [],
    };

    // Helper to find or create customer in QB
    async function findOrCreateCustomer(project: any): Promise<string | null> {
      const customerName = project.project_name || project.project_address || `Project ${project.project_number}`;
      
      // Search for existing customer
      const searchUrl = `${QB_BASE_URL}/${realm_id}/query?query=${encodeURIComponent(`SELECT * FROM Customer WHERE DisplayName = '${customerName.replace(/'/g, "\\'")}'`)}`;
      
      const searchRes = await fetch(searchUrl, { headers: qbHeaders });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.QueryResponse?.Customer?.length > 0) {
          return searchData.QueryResponse.Customer[0].Id;
        }
      }

      // Create new customer
      const customerData: QBCustomer = {
        DisplayName: customerName.substring(0, 100),
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
        return created.Customer.Id;
      }

      console.error("Failed to create customer:", await createRes.text());
      return null;
    }

    // Helper to find or create vendor in QB
    async function findOrCreateVendor(vendorName: string): Promise<string | null> {
      const searchUrl = `${QB_BASE_URL}/${realm_id}/query?query=${encodeURIComponent(`SELECT * FROM Vendor WHERE DisplayName = '${vendorName.replace(/'/g, "\\'")}'`)}`;
      
      const searchRes = await fetch(searchUrl, { headers: qbHeaders });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.QueryResponse?.Vendor?.length > 0) {
          return searchData.QueryResponse.Vendor[0].Id;
        }
      }

      // Create new vendor
      const createRes = await fetch(`${QB_BASE_URL}/${realm_id}/vendor`, {
        method: "POST",
        headers: qbHeaders,
        body: JSON.stringify({ DisplayName: vendorName.substring(0, 100) }),
      });

      if (createRes.ok) {
        const created = await createRes.json();
        return created.Vendor.Id;
      }

      return null;
    }

    // Sync invoices
    if (!syncType || syncType === "invoice") {
      let invoiceQuery = supabase
        .from("project_invoices")
        .select("*, projects!inner(project_name, project_address, project_number)")
        .eq("projects.company_id", companyId);

      if (recordId) {
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
          const customerId = await findOrCreateCustomer(invoice.projects);
          if (!customerId) {
            results.failed++;
            results.errors.push(`Invoice ${invoice.invoice_number}: Failed to find/create customer`);
            continue;
          }

          const qbInvoice = {
            CustomerRef: { value: customerId },
            DocNumber: invoice.invoice_number?.toString(),
            TxnDate: invoice.invoice_date?.split("T")[0],
            DueDate: invoice.due_date?.split("T")[0],
            Line: [
              {
                Amount: invoice.amount || 0,
                DetailType: "SalesItemLineDetail",
                SalesItemLineDetail: {
                  ItemRef: { value: "1", name: "Services" }, // Default item
                },
                Description: invoice.description || `Invoice for ${invoice.projects?.project_name || "Project"}`,
              },
            ],
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

    // Sync payments
    if (!syncType || syncType === "payment") {
      let paymentQuery = supabase
        .from("project_payments")
        .select("*, projects!inner(project_name, project_address, project_number, company_id)")
        .eq("projects.company_id", companyId);

      if (recordId) {
        paymentQuery = paymentQuery.eq("id", recordId);
      }

      const { data: payments } = await paymentQuery;

      for (const payment of payments || []) {
        try {
          const customerId = await findOrCreateCustomer(payment.projects);
          if (!customerId) {
            results.failed++;
            results.errors.push(`Payment ${payment.id}: Failed to find/create customer`);
            continue;
          }

          const qbPayment = {
            CustomerRef: { value: customerId },
            TotalAmt: payment.payment_amount || 0,
            TxnDate: payment.payment_date?.split("T")[0],
            PrivateNote: payment.payment_method ? `${payment.payment_method} - ${payment.payment_reference || ""}` : null,
          };

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

    // Sync bills
    if (!syncType || syncType === "bill") {
      let billQuery = supabase
        .from("project_bills")
        .select("*, projects!inner(project_name, company_id), subcontractors(name)")
        .eq("projects.company_id", companyId);

      if (recordId) {
        billQuery = billQuery.eq("id", recordId);
      }

      const { data: bills } = await billQuery;

      for (const bill of bills || []) {
        try {
          const vendorName = bill.subcontractors?.name || bill.vendor_name || "Unknown Vendor";
          const vendorId = await findOrCreateVendor(vendorName);
          if (!vendorId) {
            results.failed++;
            results.errors.push(`Bill ${bill.id}: Failed to find/create vendor`);
            continue;
          }

          const qbBill = {
            VendorRef: { value: vendorId },
            TxnDate: bill.bill_date?.split("T")[0],
            DueDate: bill.due_date?.split("T")[0],
            Line: [
              {
                Amount: bill.amount || 0,
                DetailType: "AccountBasedExpenseLineDetail",
                AccountBasedExpenseLineDetail: {
                  AccountRef: { value: "1" }, // Default expense account
                },
                Description: bill.description || `Bill for ${bill.projects?.project_name || "Project"}`,
              },
            ],
            PrivateNote: bill.notes,
          };

          const createRes = await fetch(`${QB_BASE_URL}/${realm_id}/bill`, {
            method: "POST",
            headers: qbHeaders,
            body: JSON.stringify(qbBill),
          });

          if (createRes.ok) {
            const created = await createRes.json();
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
            results.failed++;
          }
        } catch (err: unknown) {
          results.failed++;
          const errMsg = err instanceof Error ? err.message : "Unknown error";
          results.errors.push(`Bill ${bill.id}: ${errMsg}`);
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
