import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, intuit-signature",
};

interface WebhookNotification {
  realmId: string;
  name: string;
  id: string;
  operation: string;
  lastUpdated: string;
}

interface WebhookPayload {
  eventNotifications: Array<{
    realmId: string;
    dataChangeEvent: {
      entities: WebhookNotification[];
    };
  }>;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const webhookVerifierToken = Deno.env.get("QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN");

  try {
    // Get the raw body for signature verification
    const rawBody = await req.text();
    
    // Handle QuickBooks verification challenge (GET request with challenge param)
    if (req.method === "GET") {
      const url = new URL(req.url);
      const challenge = url.searchParams.get("challenge");
      if (challenge) {
        console.log("Responding to QuickBooks verification challenge");
        return new Response(challenge, {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "text/plain" },
        });
      }
    }

    // For POST requests, verify signature if token is configured
    if (req.method === "POST") {
      const intuitSignature = req.headers.get("intuit-signature");
      
      if (webhookVerifierToken && intuitSignature) {
        // Verify HMAC-SHA256 signature
        const hmac = createHmac("sha256", webhookVerifierToken);
        hmac.update(rawBody);
        const expectedSignature = hmac.digest("base64");
        
        if (intuitSignature !== expectedSignature) {
          console.error("Invalid webhook signature");
          return new Response(
            JSON.stringify({ error: "Invalid signature" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        console.log("Webhook signature verified successfully");
      } else if (webhookVerifierToken && !intuitSignature) {
        console.warn("Webhook verifier token configured but no signature received");
      }

      // Parse the webhook payload
      const payload: WebhookPayload = JSON.parse(rawBody);
      console.log("Received webhook payload:", JSON.stringify(payload, null, 2));

      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Process each notification
      for (const eventNotification of payload.eventNotifications || []) {
        const realmId = eventNotification.realmId;
        
        // Find the company associated with this realmId
        const { data: connection, error: connError } = await supabase
          .from("quickbooks_connections")
          .select("company_id")
          .eq("realm_id", realmId)
          .eq("is_active", true)
          .maybeSingle();

        if (connError || !connection) {
          console.error(`No active connection found for realmId: ${realmId}`);
          continue;
        }

        const companyId = connection.company_id;

        // Process each entity change
        for (const entity of eventNotification.dataChangeEvent?.entities || []) {
          console.log(`Processing ${entity.operation} for ${entity.name} (ID: ${entity.id})`);

          try {
            await processEntityChange(supabase, companyId, realmId, entity);
          } catch (err) {
            console.error(`Error processing entity ${entity.name}:${entity.id}:`, err);
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Webhook processing error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// deno-lint-ignore no-explicit-any
async function processEntityChange(
  supabase: any,
  companyId: string,
  _realmId: string,
  entity: WebhookNotification
) {
  const { name: entityType, id: qbId, operation } = entity;

  // Map QuickBooks entity types to our record types
  const entityTypeMap: Record<string, string> = {
    "Invoice": "invoice",
    "Payment": "payment",
    "Bill": "bill",
    "BillPayment": "bill_payment",
    "Customer": "customer",
    "Vendor": "vendor",
  };

  const recordType = entityTypeMap[entityType];
  if (!recordType) {
    console.log(`Skipping unsupported entity type: ${entityType}`);
    return;
  }

  // Check if we have a sync log entry for this QuickBooks entity
  const { data: syncLog } = await supabase
    .from("quickbooks_sync_log")
    .select("*")
    .eq("company_id", companyId)
    .eq("quickbooks_id", qbId)
    .eq("record_type", recordType)
    .maybeSingle();

  if (operation === "Delete") {
    // Handle deletion - mark as deleted or remove sync log
    if (syncLog) {
      console.log(`QuickBooks ${entityType} ${qbId} was deleted`);
      // Update sync log to indicate deletion from QB
      await supabase
        .from("quickbooks_sync_log")
        .update({ 
          sync_status: "deleted_in_qb",
          last_sync_at: new Date().toISOString(),
          error_message: "Deleted in QuickBooks"
        })
        .eq("id", syncLog.id);
    }
    return;
  }

  // For Create/Update operations, we need to fetch the full entity from QuickBooks
  // and update our local records
  if (operation === "Create" || operation === "Update") {
    // Log the incoming change for processing
    // The actual sync will be handled by fetching fresh data from QuickBooks
    
    if (syncLog) {
      // We have this record - mark it as needing refresh
      await supabase
        .from("quickbooks_sync_log")
        .update({
          sync_status: "pending_refresh",
          last_sync_at: new Date().toISOString(),
          error_message: `${operation} detected in QuickBooks at ${entity.lastUpdated}`
        })
        .eq("id", syncLog.id);
      
      console.log(`Marked ${entityType} ${qbId} for refresh (${operation})`);
    } else if (operation === "Create") {
      // New entity created in QuickBooks that we don't have
      // Log it for potential import
      console.log(`New ${entityType} created in QuickBooks: ${qbId}`);
      
      // Insert a placeholder sync log entry
      await supabase
        .from("quickbooks_sync_log")
        .insert({
          company_id: companyId,
          record_type: recordType,
          record_id: null, // We don't have a local record yet
          quickbooks_id: qbId,
          sync_status: "created_in_qb",
          last_sync_at: new Date().toISOString(),
          error_message: `Created in QuickBooks at ${entity.lastUpdated}`
        });
    }
  }
}
