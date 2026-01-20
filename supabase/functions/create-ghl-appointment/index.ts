import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Helper to get GHL API key from database - throws error if not configured for GHL sync
async function getGHLApiKey(supabase: any, locationId: string): Promise<string> {
  if (!locationId) {
    throw new Error("Location ID is required for GHL sync");
  }

  const { data: integration, error } = await supabase
    .from("company_integrations")
    .select("id, api_key_encrypted")
    .eq("provider", "ghl")
    .eq("location_id", locationId)
    .eq("is_active", true)
    .single();

  if (error || !integration || !integration.api_key_encrypted) {
    throw new Error(
      `GHL integration not configured for location ${locationId}. ` +
      `Please add the integration in Admin Settings → GHL tab.`
    );
  }

  const { data: apiKey, error: vaultError } = await supabase.rpc(
    "get_ghl_api_key_encrypted",
    { p_integration_id: integration.id }
  );

  if (vaultError || !apiKey) {
    throw new Error(
      `Failed to retrieve GHL API key for location ${locationId}: ${vaultError?.message || "Key not found"}`
    );
  }

  return apiKey;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const {
      contactId,
      locationId,
      title,
      startTime,  // ISO string in UTC
      endTime,    // ISO string in UTC (optional - defaults to 1 hour after start)
      calendarId,
      assignedUserId,
      address,
      notes,
      enteredBy,
      skipGHLSync, // If true, only save to Supabase without calling GHL API
      companyId,   // Company ID for multi-tenancy
    } = await req.json();

    // calendarId is required only when syncing to GHL
    if (!contactId || !title || !startTime) {
      return jsonResponse(
        { error: "contactId, title, and startTime are required" },
        400,
      );
    }

    if (!skipGHLSync && !calendarId) {
      return jsonResponse(
        { error: "calendarId is required when syncing to GHL" },
        400,
      );
    }

    // If locationId or companyId not provided, look them up from the contact
    let effectiveLocationId = locationId;
    let effectiveCompanyId = companyId;
    
    if (!effectiveLocationId || !effectiveCompanyId) {
      const { data: contactData } = await supabase
        .from('contacts')
        .select('location_id, company_id')
        .eq('ghl_id', contactId)
        .single();
      
      if (!effectiveLocationId) {
        effectiveLocationId = contactData?.location_id;
      }
      if (!effectiveCompanyId) {
        effectiveCompanyId = contactData?.company_id;
      }
    }

    // Calculate end time if not provided (default 1 hour)
    const startDate = new Date(startTime);
    const endDate = endTime ? new Date(endTime) : new Date(startDate.getTime() + 60 * 60 * 1000);

    // If skipGHLSync, save directly to Supabase with a local ID
    if (skipGHLSync) {
      console.log(`Creating LOCAL appointment for contact ${contactId} (location: ${effectiveLocationId}): ${title}`);
      
      // Generate a local-only ID prefixed with "local_"
      const localId = `local_${crypto.randomUUID()}`;
      
      const { error: dbError } = await supabase.from("appointments").insert({
        ghl_id: localId,
        location_id: effectiveLocationId,
        contact_id: contactId,
        calendar_id: calendarId || null,
        title,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        appointment_status: "confirmed",
        assigned_user_id: assignedUserId || null,
        address: address || null,
        notes: notes ? `[LOCAL] ${notes}` : "[LOCAL - not synced to GHL]",
        ghl_date_added: new Date().toISOString(),
        entered_by: enteredBy || null,
        company_id: effectiveCompanyId || null,
      });

      if (dbError) {
        console.error("Error saving local appointment:", dbError);
        return jsonResponse({ error: "Failed to save appointment locally" }, 500);
      }

      console.log("Local appointment created:", localId);
      return jsonResponse({
        success: true,
        appointmentId: localId,
        local: true,
        message: "Appointment saved locally (not synced to GHL)",
      });
    }

    // --- Full GHL sync path ---
    const GHL_API_KEY = await getGHLApiKey(supabase, effectiveLocationId);

    console.log(`Creating appointment for contact ${contactId} (location: ${effectiveLocationId}): ${title}`);

    const apptPayload: Record<string, unknown> = {
      contactId,
      locationId: effectiveLocationId,
      title,
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
      appointmentStatus: "confirmed",
      calendarId,
    };

    if (assignedUserId) apptPayload.assignedUserId = assignedUserId;
    if (address) apptPayload.address = address;
    if (notes) apptPayload.notes = notes;

    console.log("Sending to GHL:", JSON.stringify(apptPayload));

    const apptResponse = await fetch(
      "https://services.leadconnectorhq.com/calendars/events/appointments",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GHL_API_KEY}`,
          "Content-Type": "application/json",
          Version: "2021-04-15",
        },
        body: JSON.stringify(apptPayload),
      },
    );

    if (!apptResponse.ok) {
      const errorText = await apptResponse.text();
      console.error("GHL Appointment API error:", apptResponse.status, errorText);

      try {
        const parsed = JSON.parse(errorText);
        const msg = parsed?.message || parsed?.error || errorText;
        return jsonResponse(
          {
            error: `GHL API error: ${apptResponse.status} - ${msg}`,
            details: parsed,
          },
          apptResponse.status,
        );
      } catch {
        return jsonResponse(
          { error: `GHL API error: ${apptResponse.status} - ${errorText}` },
          apptResponse.status,
        );
      }
    }

    const apptData = await apptResponse.json();
    const appointmentId = apptData.id || apptData.appointment?.id;
    console.log("Appointment created in GHL:", appointmentId);

    // Cache appointment in Supabase
    if (appointmentId) {
      const { error: dbError } = await supabase.from("appointments").upsert(
        {
          ghl_id: appointmentId,
          location_id: effectiveLocationId,
          contact_id: contactId,
          calendar_id: calendarId,
          title,
          start_time: startDate.toISOString(),
          end_time: endDate.toISOString(),
          appointment_status: "confirmed",
          assigned_user_id: assignedUserId || null,
          address: address || null,
          notes: notes || null,
          ghl_date_added: new Date().toISOString(),
          entered_by: enteredBy || null,
          company_id: effectiveCompanyId || null,
        },
        { onConflict: "ghl_id" },
      );

      if (dbError) {
        console.error("Error caching appointment:", dbError);
      } else {
        console.log("Appointment cached in Supabase");
      }
    }

    return jsonResponse({
      success: true,
      appointmentId,
      data: apptData,
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error creating GHL appointment:", errorMessage);
    return jsonResponse({ error: errorMessage }, 500);
  }
});
