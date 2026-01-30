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

// CloudEvents format (new QBO webhook format)
interface CloudEventsPayload {
  specversion: string;
  id: string;
  source: string;
  type: string; // e.g., "qbo.invoice.created.v1"
  time: string;
  intuitentityid: string; // The QB entity ID
  intuitaccountid: string; // The realm ID
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
      let rawPayload: unknown;
      try {
        rawPayload = JSON.parse(rawBody);
        log("info", "Parsed payload", { 
          isArray: Array.isArray(rawPayload),
          keys: Array.isArray(rawPayload) ? `array[${rawPayload.length}]` : Object.keys(rawPayload as object)
        });
      } catch (parseError) {
        log("error", "Failed to parse webhook payload", { error: String(parseError) });
        return new Response(
          JSON.stringify({ error: "Invalid JSON payload" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      // QuickBooks may send CloudEvents as an array or single object
      // Handle both formats
      const payloadItems: unknown[] = Array.isArray(rawPayload) ? rawPayload : [rawPayload];
      
      // Check if this is CloudEvents format (new QBO webhook format)
      // CloudEvents have specversion field
      const firstItem = payloadItems[0] as Record<string, unknown> | undefined;
      const isCloudEvents = firstItem && typeof firstItem === 'object' && 'specversion' in firstItem;
      log("info", "Format detection", { isCloudEvents, itemCount: payloadItems.length });
      
      if (isCloudEvents) {
        // Process all CloudEvents in the array
        let totalProcessed = 0;
        let totalErrors = 0;
        
        for (const item of payloadItems) {
          const cloudEvent = item as CloudEventsPayload;
          log("info", "Processing CloudEvent", {
            type: cloudEvent.type,
            entityId: cloudEvent.intuitentityid,
            realmId: cloudEvent.intuitaccountid
          });
          
          // Parse the event type: "qbo.{entity}.{operation}.v1"
          const typeMatch = cloudEvent.type.match(/^qbo\.(\w+)\.(\w+)\.v\d+$/);
          if (!typeMatch) {
            log("error", "Invalid CloudEvents type format", { type: cloudEvent.type });
            totalErrors++;
            continue;
          }
          
          const entityTypeLower = typeMatch[1];
          const operationLower = typeMatch[2];
          
          const entityTypeMap: Record<string, string> = {
            "invoice": "Invoice",
            "payment": "Payment",
            "bill": "Bill",
            "billpayment": "BillPayment",
            "customer": "Customer",
            "vendor": "Vendor",
          };
          
          const operationMap: Record<string, string> = {
            "created": "Create",
            "updated": "Update",
            "deleted": "Delete",
          };
          
          const entityType = entityTypeMap[entityTypeLower];
          const operation = operationMap[operationLower];
          
          if (!entityType) {
            log("info", `Skipping unsupported entity type: ${entityTypeLower}`);
            continue;
          }
          
          if (!operation) {
            log("info", `Skipping unsupported operation: ${operationLower}`);
            continue;
          }
          
          const realmId = cloudEvent.intuitaccountid;
          const qbEntityId = cloudEvent.intuitentityid;
          
          const { data: connection, error: connError } = await supabase
            .from("quickbooks_connections")
            .select("company_id")
            .eq("realm_id", realmId)
            .eq("is_active", true)
            .maybeSingle();

          if (connError) {
            log("error", `Database error looking up connection`, { realmId, error: connError.message });
            totalErrors++;
            continue;
          }
          
          if (!connection) {
            log("warn", `No active QuickBooks connection found for realmId: ${realmId}`);
            continue;
          }

          const companyId = connection.company_id;
          log("info", `Found company: ${companyId} for realmId: ${realmId}`);

          const entity: WebhookNotification = {
            realmId: realmId,
            name: entityType,
            id: qbEntityId,
            operation: operation,
            lastUpdated: cloudEvent.time
          };

          try {
            await processEntityChange(supabase, companyId, realmId, entity, log);
            totalProcessed++;
            log("info", `✓ Processed CloudEvent`, { entityType, entityId: qbEntityId, operation });
          } catch (err) {
            totalErrors++;
            log("error", `Failed to process CloudEvents entity`, {
              entityType,
              entityId: qbEntityId,
              error: err instanceof Error ? err.message : String(err)
            });
          }
        }
        
        const duration = Date.now() - startTime;
        log("info", `✓ CloudEvents webhook processing complete`, {
          duration: `${duration}ms`,
          processed: totalProcessed,
          errors: totalErrors
        });
        
        return new Response(
          JSON.stringify({ success: true, processed: totalProcessed, errors: totalErrors }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Legacy format processing
      const legacyPayload = (firstItem as unknown) as WebhookPayload;
      const notificationCount = legacyPayload?.eventNotifications?.length || 0;
      const entityCount = legacyPayload?.eventNotifications?.reduce(
        (sum, n) => sum + (n.dataChangeEvent?.entities?.length || 0), 0
      ) || 0;
      
      log("info", `Processing legacy webhook payload`, { 
        notifications: notificationCount,
        totalEntities: entityCount 
      });

      let processedCount = 0;
      let errorCount = 0;

      // Process each notification
      for (const eventNotification of legacyPayload?.eventNotifications || []) {
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
    // Handle deletion - update the local record and sync log
    log("info", `Processing delete for ${entityType} ${qbId}`);
    
    // For invoices, try to find and update by QuickBooks ID in doc number
    if (entityType === "Invoice") {
      // First try to find by sync log
      let invoiceId = syncLog?.record_id;
      
      // If no sync log, try to find by invoice_number pattern (QB-{id})
      if (!invoiceId) {
        const { data: invoice } = await supabase
          .from("project_invoices")
          .select("id")
          .eq("company_id", companyId)
          .or(`invoice_number.eq.QB-${qbId},invoice_number.eq.${qbId}`)
          .maybeSingle();
        
        if (invoice) {
          invoiceId = invoice.id;
          log("info", `Found invoice by number pattern: ${invoiceId}`);
        }
      }
      
      if (invoiceId) {
        // Mark the invoice as deleted in local DB (no explicit status column exists)
        // We:
        // - zero out financials
        // - set exclude_from_qb=true to prevent re-sync attempts
        // - prefix invoice_number so the UI clearly reflects the deleted state

        const { data: existingInvoice, error: existingInvoiceError } = await supabase
          .from("project_invoices")
          .select("invoice_number")
          .eq("company_id", companyId)
          .eq("id", invoiceId)
          .maybeSingle();

        if (existingInvoiceError) {
          log("warn", `Failed to load existing invoice_number before marking deleted`, {
            error: existingInvoiceError.message,
          });
        }

        const currentInvoiceNumber = existingInvoice?.invoice_number || `QB-${qbId}`;
        const deletedInvoiceNumber = currentInvoiceNumber.startsWith("DELETED-")
          ? currentInvoiceNumber
          : `DELETED-${currentInvoiceNumber}`;

        const { error: deleteError } = await supabase
          .from("project_invoices")
          .update({
            invoice_number: deletedInvoiceNumber,
            amount: 0,
            total_expected: 0,
            payments_received: 0,
            open_balance: 0,
            exclude_from_qb: true,
          })
          .eq("company_id", companyId)
          .eq("id", invoiceId);
        
        if (deleteError) {
          log("error", `Failed to update deleted invoice`, { error: deleteError.message });
        } else {
          log("info", `✓ Marked local invoice ${invoiceId} as deleted (zeroed amounts)`);
        }
      } else {
        log("info", `No local invoice found for deleted QB Invoice ${qbId}`);
      }
    }
    
    // For payments, find and handle deletion
    if (entityType === "Payment") {
      let paymentId = syncLog?.record_id;
      
      if (paymentId) {
        // Delete the local payment record
        const { error: deleteError } = await supabase
          .from("project_payments")
          .delete()
          .eq("id", paymentId);
        
        if (deleteError) {
          log("error", `Failed to delete local payment`, { error: deleteError.message });
        } else {
          log("info", `✓ Deleted local payment ${paymentId}`);
        }
      } else {
        log("info", `No local payment found for deleted QB Payment ${qbId}`);
      }
    }
    
    // For bills, find and handle deletion
    if (entityType === "Bill") {
      let billId = syncLog?.record_id;
      
      if (billId) {
        // Mark the bill as voided/deleted in local DB
        const { error: deleteError } = await supabase
          .from("project_bills")
          .update({
            is_voided: true,
            balance: 0,
          })
          .eq("id", billId);
        
        if (deleteError) {
          log("error", `Failed to mark local bill as voided`, { error: deleteError.message });
        } else {
          log("info", `✓ Marked local bill ${billId} as voided (deleted in QB)`);
        }
      } else {
        log("info", `No local bill found for deleted QB Bill ${qbId}`);
      }
    }
    
    // For bill payments, find and handle deletion
    if (entityType === "BillPayment") {
      let billPaymentId = syncLog?.record_id;
      
      if (billPaymentId) {
        // Delete the local bill payment record
        const { error: deleteError } = await supabase
          .from("bill_payments")
          .delete()
          .eq("id", billPaymentId);
        
        if (deleteError) {
          log("error", `Failed to delete local bill payment`, { error: deleteError.message });
        } else {
          log("info", `✓ Deleted local bill payment ${billPaymentId}`);
        }
      } else {
        log("info", `No local bill payment found for deleted QB BillPayment ${qbId}`);
      }
    }
    
    // Update sync log if exists
    if (syncLog) {
      log("info", `Marking sync log for ${entityType} ${qbId} as deleted_in_qb`);
      const { error: updateError } = await supabase
        .from("quickbooks_sync_log")
        .update({ 
          sync_status: "deleted_in_qb",
          synced_at: new Date().toISOString(),
          sync_error: "Deleted in QuickBooks"
        })
        .eq("id", syncLog.id);
      
      if (updateError) {
        log("error", `Failed to update sync log for deletion`, { error: updateError.message });
      } else {
        log("info", `✓ Successfully marked sync log as deleted`);
      }
    } else {
      log("info", `No sync log found for deleted ${entityType} ${qbId}`);
    }
    return;
  }

  // For Create/Update operations
  if (operation === "Create" || operation === "Update") {
    if (syncLog) {
      // If this record was already deleted in QB, ignore subsequent updates.
      if (syncLog.sync_status === "deleted_in_qb") {
        log("info", `Ignoring update for ${entityType} ${qbId} because sync log is deleted_in_qb`);
        return;
      }

      // For updates, immediately fetch the latest from QB and update locally.
      if (operation === "Update") {
        if (entityType === "Invoice") {
          log("info", `Invoice update detected in QuickBooks - fetching latest invoice ${qbId}`);

          try {
            const fetchResult = await supabase.functions.invoke("quickbooks-fetch-invoice", {
              body: {
                companyId,
                qbInvoiceId: qbId,
                realmId,
                action: "update-existing",
              },
            });

            if (fetchResult.error) {
              log("error", `Failed to invoke quickbooks-fetch-invoice for update`, { error: fetchResult.error });
            } else if (fetchResult.data?.error) {
              log("warn", `quickbooks-fetch-invoice returned error for update`, { error: fetchResult.data.error });
            } else {
              log("info", `✓ Updated local invoice from QB update webhook`, fetchResult.data);
              return;
            }
          } catch (err) {
            log("error", `Exception invoking quickbooks-fetch-invoice for update`, {
              error: err instanceof Error ? err.message : String(err),
            });
          }
        } else if (entityType === "Payment") {
          log("info", `Payment update detected in QuickBooks - fetching latest payment ${qbId}`);

          try {
            const fetchResult = await supabase.functions.invoke("quickbooks-fetch-payment", {
              body: {
                companyId,
                qbPaymentId: qbId,
                realmId,
                action: "update-existing",
              },
            });

            if (fetchResult.error) {
              log("error", `Failed to invoke quickbooks-fetch-payment for update`, { error: fetchResult.error });
            } else if (fetchResult.data?.error) {
              log("warn", `quickbooks-fetch-payment returned error for update`, { error: fetchResult.data.error });
            } else {
              log("info", `✓ Updated local payment from QB update webhook`, fetchResult.data);
              return;
            }
          } catch (err) {
            log("error", `Exception invoking quickbooks-fetch-payment for update`, {
              error: err instanceof Error ? err.message : String(err),
            });
          }
        } else if (entityType === "Bill") {
          log("info", `Bill update detected in QuickBooks - fetching latest bill ${qbId}`);

          try {
            const fetchResult = await supabase.functions.invoke("quickbooks-fetch-bill", {
              body: {
                companyId,
                qbBillId: qbId,
                realmId,
                action: "update-existing",
              },
            });

            if (fetchResult.error) {
              log("error", `Failed to invoke quickbooks-fetch-bill for update`, { error: fetchResult.error });
            } else if (fetchResult.data?.error) {
              log("warn", `quickbooks-fetch-bill returned error for update`, { error: fetchResult.data.error });
            } else {
              log("info", `✓ Updated local bill from QB update webhook`, fetchResult.data);
              return;
            }
          } catch (err) {
            log("error", `Exception invoking quickbooks-fetch-bill for update`, {
              error: err instanceof Error ? err.message : String(err),
            });
          }
        } else if (entityType === "BillPayment") {
          log("info", `Bill payment update detected in QuickBooks - fetching latest bill payment ${qbId}`);

          try {
            const fetchResult = await supabase.functions.invoke("quickbooks-fetch-bill-payment", {
              body: {
                companyId,
                qbBillPaymentId: qbId,
                realmId,
                action: "update-existing",
              },
            });

            if (fetchResult.error) {
              log("error", `Failed to invoke quickbooks-fetch-bill-payment for update`, { error: fetchResult.error });
            } else if (fetchResult.data?.error) {
              log("warn", `quickbooks-fetch-bill-payment returned error for update`, { error: fetchResult.data.error });
            } else {
              log("info", `✓ Updated local bill payment from QB update webhook`, fetchResult.data);
              return;
            }
          } catch (err) {
            log("error", `Exception invoking quickbooks-fetch-bill-payment for update`, {
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }

      // Fallback: mark as pending_refresh if the immediate fetch failed
      log("info", `Marking existing ${entityType} ${qbId} for refresh`);
      const { error: updateError } = await supabase
        .from("quickbooks_sync_log")
        .update({
          sync_status: "pending_refresh",
          synced_at: new Date().toISOString(),
          sync_error: `${operation} detected in QuickBooks at ${entity.lastUpdated}`
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
            await supabase
              .from("quickbooks_sync_log")
              .insert({
                company_id: companyId,
                record_type: recordType,
                record_id: null,
                quickbooks_id: qbId,
                sync_status: "import_failed",
                synced_at: new Date().toISOString(),
                sync_error: `Auto-import failed: ${fetchResult.error}`
              });
          } else if (fetchResult.data?.error) {
            log("warn", `Invoice import returned error`, { error: fetchResult.data.error });
            await supabase
              .from("quickbooks_sync_log")
              .insert({
                company_id: companyId,
                record_type: recordType,
                record_id: null,
                quickbooks_id: qbId,
                sync_status: "import_failed",
                synced_at: new Date().toISOString(),
                sync_error: fetchResult.data.error
              });
          } else {
            log("info", `✓ Successfully imported invoice ${qbId}`, { 
              invoiceId: fetchResult.data?.invoiceId,
              matchMethod: fetchResult.data?.matchMethod
            });
          }
        } catch (err) {
          log("error", `Exception importing invoice ${qbId}`, { 
            error: err instanceof Error ? err.message : String(err) 
          });
          await supabase
            .from("quickbooks_sync_log")
            .insert({
              company_id: companyId,
              record_type: recordType,
              record_id: null,
              quickbooks_id: qbId,
              sync_status: "created_in_qb",
              synced_at: new Date().toISOString(),
              sync_error: `Exception during auto-import: ${err instanceof Error ? err.message : String(err)}`
            });
        }
      } else if (entityType === "Payment") {
        // For payments, automatically fetch and import
        log("info", `Triggering automatic import for new payment ${qbId}`);
        
        try {
          const fetchResult = await supabase.functions.invoke("quickbooks-fetch-payment", {
            body: {
              companyId,
              qbPaymentId: qbId,
              realmId,
              action: "fetch-single"
            }
          });

          if (fetchResult.error) {
            log("error", `Failed to fetch payment ${qbId}`, { error: fetchResult.error });
            await supabase
              .from("quickbooks_sync_log")
              .insert({
                company_id: companyId,
                record_type: recordType,
                record_id: null,
                quickbooks_id: qbId,
                sync_status: "import_failed",
                synced_at: new Date().toISOString(),
                sync_error: `Auto-import failed: ${fetchResult.error}`
              });
          } else if (fetchResult.data?.error) {
            log("warn", `Payment import returned error`, { error: fetchResult.data.error });
            await supabase
              .from("quickbooks_sync_log")
              .insert({
                company_id: companyId,
                record_type: recordType,
                record_id: null,
                quickbooks_id: qbId,
                sync_status: "import_failed",
                synced_at: new Date().toISOString(),
                sync_error: fetchResult.data.error
              });
          } else {
            log("info", `✓ Successfully imported payment ${qbId}`, { 
              paymentId: fetchResult.data?.paymentId,
              matchMethod: fetchResult.data?.matchMethod,
              invoiceId: fetchResult.data?.invoiceId
            });
          }
        } catch (err) {
          log("error", `Exception importing payment ${qbId}`, { 
            error: err instanceof Error ? err.message : String(err) 
          });
          await supabase
            .from("quickbooks_sync_log")
            .insert({
              company_id: companyId,
              record_type: recordType,
              record_id: null,
              quickbooks_id: qbId,
              sync_status: "created_in_qb",
              synced_at: new Date().toISOString(),
              sync_error: `Exception during auto-import: ${err instanceof Error ? err.message : String(err)}`
            });
        }
      } else if (entityType === "Bill") {
        // For bills, automatically fetch and import
        log("info", `Triggering automatic import for new bill ${qbId}`);
        
        try {
          const fetchResult = await supabase.functions.invoke("quickbooks-fetch-bill", {
            body: {
              companyId,
              qbBillId: qbId,
              realmId,
              action: "fetch-single"
            }
          });

          if (fetchResult.error) {
            log("error", `Failed to fetch bill ${qbId}`, { error: fetchResult.error });
            await supabase
              .from("quickbooks_sync_log")
              .insert({
                company_id: companyId,
                record_type: recordType,
                record_id: null,
                quickbooks_id: qbId,
                sync_status: "import_failed",
                synced_at: new Date().toISOString(),
                sync_error: `Auto-import failed: ${fetchResult.error}`
              });
          } else if (fetchResult.data?.error) {
            log("warn", `Bill import returned error`, { error: fetchResult.data.error });
            await supabase
              .from("quickbooks_sync_log")
              .insert({
                company_id: companyId,
                record_type: recordType,
                record_id: null,
                quickbooks_id: qbId,
                sync_status: "import_failed",
                synced_at: new Date().toISOString(),
                sync_error: fetchResult.data.error
              });
          } else {
            log("info", `✓ Successfully imported bill ${qbId}`, { 
              billId: fetchResult.data?.billId,
              matchMethod: fetchResult.data?.matchMethod,
              projectId: fetchResult.data?.projectId,
              subcontractorId: fetchResult.data?.subcontractorId
            });
          }
        } catch (err) {
          log("error", `Exception importing bill ${qbId}`, { 
            error: err instanceof Error ? err.message : String(err) 
          });
          await supabase
            .from("quickbooks_sync_log")
            .insert({
              company_id: companyId,
              record_type: recordType,
              record_id: null,
              quickbooks_id: qbId,
              sync_status: "created_in_qb",
              synced_at: new Date().toISOString(),
              sync_error: `Exception during auto-import: ${err instanceof Error ? err.message : String(err)}`
            });
        }
      } else if (entityType === "BillPayment") {
        // For bill payments, automatically fetch and import
        log("info", `Triggering automatic import for new bill payment ${qbId}`);
        
        try {
          const fetchResult = await supabase.functions.invoke("quickbooks-fetch-bill-payment", {
            body: {
              companyId,
              qbBillPaymentId: qbId,
              realmId,
              action: "fetch-single"
            }
          });

          if (fetchResult.error) {
            log("error", `Failed to fetch bill payment ${qbId}`, { error: fetchResult.error });
            await supabase
              .from("quickbooks_sync_log")
              .insert({
                company_id: companyId,
                record_type: recordType,
                record_id: null,
                quickbooks_id: qbId,
                sync_status: "import_failed",
                synced_at: new Date().toISOString(),
                sync_error: `Auto-import failed: ${fetchResult.error}`
              });
          } else if (fetchResult.data?.error) {
            log("warn", `Bill payment import returned error`, { error: fetchResult.data.error });
            await supabase
              .from("quickbooks_sync_log")
              .insert({
                company_id: companyId,
                record_type: recordType,
                record_id: null,
                quickbooks_id: qbId,
                sync_status: "import_failed",
                synced_at: new Date().toISOString(),
                sync_error: fetchResult.data.error
              });
          } else {
            log("info", `✓ Successfully imported bill payment ${qbId}`, { 
              billPaymentId: fetchResult.data?.billPaymentId,
              matchMethod: fetchResult.data?.matchMethod,
              billId: fetchResult.data?.billId
            });
          }
        } catch (err) {
          log("error", `Exception importing bill payment ${qbId}`, { 
            error: err instanceof Error ? err.message : String(err) 
          });
          await supabase
            .from("quickbooks_sync_log")
            .insert({
              company_id: companyId,
              record_type: recordType,
              record_id: null,
              quickbooks_id: qbId,
              sync_status: "created_in_qb",
              synced_at: new Date().toISOString(),
              sync_error: `Exception during auto-import: ${err instanceof Error ? err.message : String(err)}`
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
            synced_at: new Date().toISOString(),
            sync_error: `Created in QuickBooks at ${entity.lastUpdated}`
          });
        
        if (insertError) {
          log("error", `Failed to insert sync log for new entity`, { error: insertError.message });
        } else {
          log("info", `✓ Created sync log entry for new ${entityType} ${qbId}`);
        }
      }
    } else if (operation === "Update") {
      // Update operation but no sync log - try to find and update the local record
      log("info", `Update for ${entityType} ${qbId} without sync log - attempting to find and update local record`);
      
      if (entityType === "Invoice") {
        try {
          const fetchResult = await supabase.functions.invoke("quickbooks-fetch-invoice", {
            body: {
              companyId,
              qbInvoiceId: qbId,
              realmId,
              action: "update-existing"
            }
          });

          if (fetchResult.error) {
            log("error", `Failed to update invoice ${qbId}`, { error: fetchResult.error });
          } else if (fetchResult.data?.error) {
            log("warn", `Invoice update returned error`, { error: fetchResult.data.error });
          } else {
            log("info", `✓ Successfully updated invoice ${qbId}`, fetchResult.data);
          }
        } catch (err) {
          log("error", `Exception updating invoice ${qbId}`, { 
            error: err instanceof Error ? err.message : String(err) 
          });
        }
      } else if (entityType === "Payment") {
        try {
          const fetchResult = await supabase.functions.invoke("quickbooks-fetch-payment", {
            body: {
              companyId,
              qbPaymentId: qbId,
              realmId,
              action: "update-existing"
            }
          });

          if (fetchResult.error) {
            log("error", `Failed to update payment ${qbId}`, { error: fetchResult.error });
          } else if (fetchResult.data?.error) {
            log("warn", `Payment update returned error`, { error: fetchResult.data.error });
          } else {
            log("info", `✓ Successfully updated payment ${qbId}`, fetchResult.data);
          }
        } catch (err) {
          log("error", `Exception updating payment ${qbId}`, { 
            error: err instanceof Error ? err.message : String(err) 
          });
        }
      } else if (entityType === "Bill") {
        try {
          const fetchResult = await supabase.functions.invoke("quickbooks-fetch-bill", {
            body: {
              companyId,
              qbBillId: qbId,
              realmId,
              action: "update-existing"
            }
          });

          if (fetchResult.error) {
            log("error", `Failed to update bill ${qbId}`, { error: fetchResult.error });
          } else if (fetchResult.data?.error) {
            log("warn", `Bill update returned error`, { error: fetchResult.data.error });
          } else {
            log("info", `✓ Successfully updated bill ${qbId}`, fetchResult.data);
          }
        } catch (err) {
          log("error", `Exception updating bill ${qbId}`, { 
            error: err instanceof Error ? err.message : String(err) 
          });
        }
      } else if (entityType === "BillPayment") {
        try {
          const fetchResult = await supabase.functions.invoke("quickbooks-fetch-bill-payment", {
            body: {
              companyId,
              qbBillPaymentId: qbId,
              realmId,
              action: "update-existing"
            }
          });

          if (fetchResult.error) {
            log("error", `Failed to update bill payment ${qbId}`, { error: fetchResult.error });
          } else if (fetchResult.data?.error) {
            log("warn", `Bill payment update returned error`, { error: fetchResult.data.error });
          } else {
            log("info", `✓ Successfully updated bill payment ${qbId}`, fetchResult.data);
          }
        } catch (err) {
          log("error", `Exception updating bill payment ${qbId}`, { 
            error: err instanceof Error ? err.message : String(err) 
          });
        }
      } else {
        log("info", `Update for ${entityType} ${qbId} but no sync log exists - may be external record`);
      }
    }
  }
}
