import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const QB_BASE_URL = "https://quickbooks.api.intuit.com/v3/company";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { companyId, recordType, recordId, action = "void" } = await req.json();

    if (!companyId || !recordType || !recordId) {
      return new Response(
        JSON.stringify({ error: "companyId, recordType, and recordId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${action} for ${recordType} ${recordId} in company ${companyId}`);

    // Check if record was synced to QuickBooks
    const { data: syncLog, error: syncError } = await supabase
      .from("quickbooks_sync_log")
      .select("quickbooks_id, sync_status")
      .eq("company_id", companyId)
      .eq("record_type", recordType)
      .eq("record_id", recordId)
      .eq("sync_status", "synced")
      .maybeSingle();

    if (syncError) {
      console.error("Error checking sync log:", syncError);
      throw syncError;
    }

    if (!syncLog?.quickbooks_id) {
      console.log(`Record ${recordId} was not synced to QuickBooks, skipping`);
      return new Response(
        JSON.stringify({ success: true, skipped: true, message: "Record was not synced to QuickBooks" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const qbId = syncLog.quickbooks_id;
    console.log(`Found QuickBooks ID: ${qbId}`);

    // Get QuickBooks tokens
    const { data: tokenData, error: tokenError } = await supabase.rpc("get_quickbooks_tokens", {
      p_company_id: companyId,
    });

    if (tokenError || !tokenData || tokenData.length === 0) {
      console.log("QuickBooks not connected, updating sync log only");
      // Update sync log to mark as deleted locally
      await supabase
        .from("quickbooks_sync_log")
        .update({ sync_status: "deleted_locally", synced_at: new Date().toISOString() })
        .eq("company_id", companyId)
        .eq("record_type", recordType)
        .eq("record_id", recordId);
      
      return new Response(
        JSON.stringify({ success: true, message: "QuickBooks not connected, marked as deleted locally" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        console.log("Token refresh failed, updating sync log only");
        await supabase
          .from("quickbooks_sync_log")
          .update({ sync_status: "deleted_locally", synced_at: new Date().toISOString() })
          .eq("company_id", companyId)
          .eq("record_type", recordType)
          .eq("record_id", recordId);
        
        return new Response(
          JSON.stringify({ success: true, message: "Token refresh failed, marked as deleted locally" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

    // Map record type to QuickBooks entity type
    const qbEntityMap: Record<string, string> = {
      invoice: "Invoice",
      payment: "Payment",
      bill: "Bill",
      bill_payment: "BillPayment",
    };

    const qbEntityType = qbEntityMap[recordType];
    if (!qbEntityType) {
      return new Response(
        JSON.stringify({ error: `Unsupported record type: ${recordType}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // First, fetch the current entity to get SyncToken (required for updates/deletes)
    const fetchUrl = `${QB_BASE_URL}/${realm_id}/${qbEntityType.toLowerCase()}/${qbId}`;
    console.log(`Fetching entity from: ${fetchUrl}`);
    
    const fetchRes = await fetch(fetchUrl, { headers: qbHeaders });
    
    if (!fetchRes.ok) {
      const errText = await fetchRes.text();
      console.error(`Failed to fetch ${qbEntityType}:`, errText);
      
      // If record not found in QB, just update sync log
      if (fetchRes.status === 404 || errText.includes("Object Not Found")) {
        await supabase
          .from("quickbooks_sync_log")
          .update({ sync_status: "deleted", synced_at: new Date().toISOString() })
          .eq("company_id", companyId)
          .eq("record_type", recordType)
          .eq("record_id", recordId);
        
        return new Response(
          JSON.stringify({ success: true, message: "Record not found in QuickBooks, marked as deleted" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`Failed to fetch ${qbEntityType}: ${errText}`);
    }

    const entityData = await fetchRes.json();
    const entity = entityData[qbEntityType];
    const syncToken = entity.SyncToken;

    console.log(`Got SyncToken: ${syncToken}, proceeding with ${action}`);

    // For voiding: Update the entity with voided status
    // For deleting: Use the delete endpoint (only works for certain entity types)
    let result;

    if (action === "void") {
      // Void the transaction - different entities have different void mechanisms
      let voidUrl: string;
      let voidBody: Record<string, unknown>;

      if (recordType === "invoice") {
        // Invoices use operation=void query param
        voidUrl = `${QB_BASE_URL}/${realm_id}/invoice?operation=void`;
        voidBody = {
          Id: qbId,
          SyncToken: syncToken,
        };
      } else if (recordType === "payment") {
        // Payments use operation=void query param
        voidUrl = `${QB_BASE_URL}/${realm_id}/payment?operation=void`;
        voidBody = {
          Id: qbId,
          SyncToken: syncToken,
        };
      } else if (recordType === "bill") {
        // Bills don't support void in QBO - we'll delete instead
        voidUrl = `${QB_BASE_URL}/${realm_id}/bill?operation=delete`;
        voidBody = {
          Id: qbId,
          SyncToken: syncToken,
        };
      } else if (recordType === "bill_payment") {
        // Bill payments use operation=delete
        voidUrl = `${QB_BASE_URL}/${realm_id}/billpayment?operation=delete`;
        voidBody = {
          Id: qbId,
          SyncToken: syncToken,
        };
      } else {
        throw new Error(`Void not supported for ${recordType}`);
      }

      console.log(`Voiding/deleting at: ${voidUrl}`);
      
      const voidRes = await fetch(voidUrl, {
        method: "POST",
        headers: qbHeaders,
        body: JSON.stringify(voidBody),
      });

      if (!voidRes.ok) {
        const errText = await voidRes.text();
        console.error(`Failed to void/delete ${qbEntityType}:`, errText);
        
        // Check if this is a credit card payment that can't be voided
        // QuickBooks error 6000: "You can't void this credit card amount..."
        if (errText.includes("6000") || errText.includes("credit card")) {
          console.log("Credit card payment cannot be voided in QB, marking as deleted locally");
          await supabase
            .from("quickbooks_sync_log")
            .update({ 
              sync_status: "deleted_locally", 
              synced_at: new Date().toISOString() 
            })
            .eq("company_id", companyId)
            .eq("record_type", recordType)
            .eq("record_id", recordId);
          
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: "Credit card payment cannot be voided in QuickBooks - marked as deleted locally. You may need to void it manually in QuickBooks.",
              quickbooks_id: qbId,
              manual_action_required: true
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        throw new Error(`Failed to void ${qbEntityType}: ${errText}`);
      }

      result = await voidRes.json();
      console.log(`Successfully voided/deleted ${qbEntityType} in QuickBooks`);
    } else if (action === "delete") {
      // Hard delete (only works for certain entity types)
      const deleteUrl = `${QB_BASE_URL}/${realm_id}/${qbEntityType.toLowerCase()}?operation=delete`;
      
      const deleteRes = await fetch(deleteUrl, {
        method: "POST",
        headers: qbHeaders,
        body: JSON.stringify({
          Id: qbId,
          SyncToken: syncToken,
        }),
      });

      if (!deleteRes.ok) {
        const errText = await deleteRes.text();
        console.error(`Failed to delete ${qbEntityType}:`, errText);
        throw new Error(`Failed to delete ${qbEntityType}: ${errText}`);
      }

      result = await deleteRes.json();
      console.log(`Successfully deleted ${qbEntityType} from QuickBooks`);
    }

    // Update sync log
    await supabase
      .from("quickbooks_sync_log")
      .update({ 
        sync_status: action === "void" ? "voided" : "deleted", 
        synced_at: new Date().toISOString() 
      })
      .eq("company_id", companyId)
      .eq("record_type", recordType)
      .eq("record_id", recordId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Successfully ${action}ed ${recordType} in QuickBooks`,
        quickbooks_id: qbId
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("QuickBooks delete error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
