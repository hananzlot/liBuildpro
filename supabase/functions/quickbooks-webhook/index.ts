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
  const startTime = Date.now();
  const requestId = crypto.randomUUID().slice(0, 8);
  
  const log = (level: string, message: string, data?: unknown) => {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${requestId}] [${level.toUpperCase()}]`;
    if (data) {
      console.log(`${prefix} ${message}`, JSON.stringify(data, null, 2));
    } else {
      console.log(`${prefix} ${message}`);
    }
  };

  log("info", `Incoming ${req.method} request from ${req.headers.get("user-agent") || "unknown"}`);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    log("info", "Responding to CORS preflight");
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const webhookVerifierToken = Deno.env.get("QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN");

  try {
    // Get the raw body for signature verification
    const rawBody = await req.text();
    log("info", `Request body length: ${rawBody.length} bytes`);
    
    // Handle QuickBooks verification challenge (GET request with challenge param)
    if (req.method === "GET") {
      const url = new URL(req.url);
      const challenge = url.searchParams.get("challenge");
      if (challenge) {
        log("info", "Responding to QuickBooks verification challenge", { challenge: challenge.slice(0, 20) + "..." });
        return new Response(challenge, {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "text/plain" },
        });
      }
      log("warn", "GET request without challenge parameter");
    }

    // For POST requests, verify signature if token is configured
    if (req.method === "POST") {
      const intuitSignature = req.headers.get("intuit-signature");
      
      log("info", "Signature verification", { 
        hasToken: !!webhookVerifierToken, 
        hasSignature: !!intuitSignature 
      });
      
      if (webhookVerifierToken && intuitSignature) {
        // Verify HMAC-SHA256 signature
        const hmac = createHmac("sha256", webhookVerifierToken);
        hmac.update(rawBody);
        const expectedSignature = hmac.digest("base64");
        
        if (intuitSignature !== expectedSignature) {
          log("error", "Invalid webhook signature - rejecting request");
          return new Response(
            JSON.stringify({ error: "Invalid signature" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        log("info", "✓ Webhook signature verified successfully");
      } else if (webhookVerifierToken && !intuitSignature) {
        log("warn", "Webhook verifier token configured but no signature received - allowing for testing");
      } else {
        log("warn", "No webhook verifier token configured - skipping signature verification");
      }

      // Parse the webhook payload
      let payload: WebhookPayload;
      try {
        payload = JSON.parse(rawBody);
      } catch (parseError) {
        log("error", "Failed to parse webhook payload", { error: String(parseError) });
        return new Response(
          JSON.stringify({ error: "Invalid JSON payload" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const notificationCount = payload.eventNotifications?.length || 0;
      const entityCount = payload.eventNotifications?.reduce(
        (sum, n) => sum + (n.dataChangeEvent?.entities?.length || 0), 0
      ) || 0;
      
      log("info", `Processing webhook payload`, { 
        notifications: notificationCount,
        totalEntities: entityCount 
      });

      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      let processedCount = 0;
      let errorCount = 0;

      // Process each notification
      for (const eventNotification of payload.eventNotifications || []) {
        const realmId = eventNotification.realmId;
        
        log("info", `Processing notification for realmId: ${realmId}`);
        
        // Find the company associated with this realmId
        const { data: connection, error: connError } = await supabase
          .from("quickbooks_connections")
          .select("company_id")
          .eq("realm_id", realmId)
          .eq("is_active", true)
          .maybeSingle();

        if (connError) {
          log("error", `Database error looking up connection`, { realmId, error: connError.message });
          continue;
        }
        
        if (!connection) {
          log("warn", `No active QuickBooks connection found for realmId: ${realmId}`);
          continue;
        }

        const companyId = connection.company_id;
        log("info", `Found company: ${companyId} for realmId: ${realmId}`);

        // Process each entity change
        for (const entity of eventNotification.dataChangeEvent?.entities || []) {
          log("info", `Processing entity change`, {
            operation: entity.operation,
            entityType: entity.name,
            entityId: entity.id,
            lastUpdated: entity.lastUpdated
          });

          try {
            await processEntityChange(supabase, companyId, realmId, entity, log);
            processedCount++;
          } catch (err) {
            errorCount++;
            log("error", `Failed to process entity`, {
              entityType: entity.name,
              entityId: entity.id,
              error: err instanceof Error ? err.message : String(err)
            });
          }
        }
      }

      const duration = Date.now() - startTime;
      log("info", `✓ Webhook processing complete`, {
        duration: `${duration}ms`,
        processed: processedCount,
        errors: errorCount
      });

      return new Response(
        JSON.stringify({ success: true, processed: processedCount, errors: errorCount }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    log("warn", `Method not allowed: ${req.method}`);
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const duration = Date.now() - startTime;
    log("error", `Webhook processing failed after ${duration}ms`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
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
  realmId: string,
  entity: WebhookNotification,
  log: (level: string, message: string, data?: unknown) => void
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
    log("info", `Skipping unsupported entity type: ${entityType}`);
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

  log("info", `Sync log lookup for ${entityType} ${qbId}`, { found: !!syncLog });

  if (operation === "Delete") {
    // Handle deletion - mark as deleted or remove sync log
    if (syncLog) {
      log("info", `Marking ${entityType} ${qbId} as deleted in QuickBooks`);
      const { error: updateError } = await supabase
        .from("quickbooks_sync_log")
        .update({ 
          sync_status: "deleted_in_qb",
          last_sync_at: new Date().toISOString(),
          error_message: "Deleted in QuickBooks"
        })
        .eq("id", syncLog.id);
      
      if (updateError) {
        log("error", `Failed to update sync log for deletion`, { error: updateError.message });
      } else {
        log("info", `✓ Successfully marked ${entityType} ${qbId} as deleted`);
      }
    } else {
      log("info", `No sync log found for deleted ${entityType} ${qbId} - nothing to update`);
    }
    return;
  }

  // For Create/Update operations
  if (operation === "Create" || operation === "Update") {
    if (syncLog) {
      // We have this record - mark it as needing refresh
      log("info", `Marking existing ${entityType} ${qbId} for refresh`);
      const { error: updateError } = await supabase
        .from("quickbooks_sync_log")
        .update({
          sync_status: "pending_refresh",
          last_sync_at: new Date().toISOString(),
          error_message: `${operation} detected in QuickBooks at ${entity.lastUpdated}`
        })
        .eq("id", syncLog.id);
      
      if (updateError) {
        log("error", `Failed to mark for refresh`, { error: updateError.message });
      } else {
        log("info", `✓ Marked ${entityType} ${qbId} as pending_refresh`);
      }
    } else if (operation === "Create") {
      // New entity created in QuickBooks that we don't have
      log("info", `New ${entityType} created in QuickBooks - processing import`);
      
      // For invoices, automatically fetch and import
      if (entityType === "Invoice") {
        log("info", `Triggering automatic import for new invoice ${qbId}`);
        
        try {
          const fetchResult = await supabase.functions.invoke("quickbooks-fetch-invoice", {
            body: {
              companyId,
              qbInvoiceId: qbId,
              realmId,
              action: "fetch-single"
            }
          });

          if (fetchResult.error) {
            log("error", `Failed to fetch invoice ${qbId}`, { error: fetchResult.error });
            // Still create sync log entry for manual retry
            await supabase
              .from("quickbooks_sync_log")
              .insert({
                company_id: companyId,
                record_type: recordType,
                record_id: null,
                quickbooks_id: qbId,
                sync_status: "import_failed",
                last_sync_at: new Date().toISOString(),
                error_message: `Auto-import failed: ${fetchResult.error}`
              });
          } else if (fetchResult.data?.error) {
            log("warn", `Invoice import returned error`, { error: fetchResult.data.error });
            // Create sync log for failed import (e.g., no matching project)
            await supabase
              .from("quickbooks_sync_log")
              .insert({
                company_id: companyId,
                record_type: recordType,
                record_id: null,
                quickbooks_id: qbId,
                sync_status: "import_failed",
                last_sync_at: new Date().toISOString(),
                error_message: fetchResult.data.error
              });
          } else {
            log("info", `✓ Successfully imported invoice ${qbId}`, { 
              invoiceId: fetchResult.data?.invoiceId,
              matchMethod: fetchResult.data?.matchMethod
            });
            // Sync log is created by the fetch function
          }
        } catch (err) {
          log("error", `Exception importing invoice ${qbId}`, { 
            error: err instanceof Error ? err.message : String(err) 
          });
          // Create placeholder sync log for manual retry
          await supabase
            .from("quickbooks_sync_log")
            .insert({
              company_id: companyId,
              record_type: recordType,
              record_id: null,
              quickbooks_id: qbId,
              sync_status: "created_in_qb",
              last_sync_at: new Date().toISOString(),
              error_message: `Exception during auto-import: ${err instanceof Error ? err.message : String(err)}`
            });
        }
      } else {
        // For other entity types, just log the creation
        const { error: insertError } = await supabase
          .from("quickbooks_sync_log")
          .insert({
            company_id: companyId,
            record_type: recordType,
            record_id: null,
            quickbooks_id: qbId,
            sync_status: "created_in_qb",
            last_sync_at: new Date().toISOString(),
            error_message: `Created in QuickBooks at ${entity.lastUpdated}`
          });
        
        if (insertError) {
          log("error", `Failed to insert sync log for new entity`, { error: insertError.message });
        } else {
          log("info", `✓ Created sync log entry for new ${entityType} ${qbId}`);
        }
      }
    } else {
      log("info", `Update for ${entityType} ${qbId} but no sync log exists - may be external record`);
    }
  }
}
