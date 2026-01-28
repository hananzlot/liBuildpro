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

// Generate a local-only ID for appointments
function generateLocalId(): string {
  return `local_appt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
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
      companyId,   // Company ID for multi-tenancy
    } = await req.json();

    if (!contactId || !title || !startTime) {
      return jsonResponse(
        { error: "contactId, title, and startTime are required" },
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
        effectiveLocationId = contactData?.location_id || 'local';
      }
      if (!effectiveCompanyId) {
        effectiveCompanyId = contactData?.company_id;
      }
    }

    // Calculate end time if not provided (default 1 hour)
    const startDate = new Date(startTime);
    const endDate = endTime ? new Date(endTime) : new Date(startDate.getTime() + 60 * 60 * 1000);

    console.log(`Creating local appointment for contact ${contactId} (location: ${effectiveLocationId}): ${title}`);
    
    // Generate a local-only ID
    const localId = generateLocalId();
    
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
      notes: notes || null,
      ghl_date_added: new Date().toISOString(),
      entered_by: enteredBy || null,
      provider: 'local',
      company_id: effectiveCompanyId || null,
    });

    if (dbError) {
      console.error("Error saving appointment:", dbError);
      return jsonResponse({ error: "Failed to save appointment" }, 500);
    }

    console.log("Appointment created:", localId);
    return jsonResponse({
      success: true,
      appointmentId: localId,
      message: "Appointment created",
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error creating appointment:", errorMessage);
    return jsonResponse({ error: errorMessage }, 500);
  }
});
