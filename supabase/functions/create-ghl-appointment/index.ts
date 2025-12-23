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

// Helper to get the correct GHL API key based on location_id
function getGHLApiKey(locationId: string): string {
  const location1Id = Deno.env.get('GHL_LOCATION_ID');
  const location2Id = Deno.env.get('GHL_LOCATION_ID_2');
  
  if (locationId === location2Id) {
    const apiKey2 = Deno.env.get('GHL_API_KEY_2');
    if (apiKey2) return apiKey2;
  }
  
  // Default to primary API key
  const apiKey1 = Deno.env.get('GHL_API_KEY');
  if (!apiKey1) throw new Error('Missing GHL_API_KEY');
  return apiKey1;
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
    } = await req.json();

    if (!contactId || !title || !startTime || !calendarId) {
      return jsonResponse(
        { error: "contactId, title, startTime, and calendarId are required" },
        400,
      );
    }

    // If locationId not provided, look it up from the contact
    let effectiveLocationId = locationId;
    if (!effectiveLocationId) {
      const { data: contactData } = await supabase
        .from('contacts')
        .select('location_id')
        .eq('ghl_id', contactId)
        .single();
      
      effectiveLocationId = contactData?.location_id || Deno.env.get('GHL_LOCATION_ID');
    }

    const GHL_API_KEY = getGHLApiKey(effectiveLocationId);

    console.log(`Creating appointment for contact ${contactId} (location: ${effectiveLocationId}): ${title}`);

    // Calculate end time if not provided (default 1 hour)
    const startDate = new Date(startTime);
    const endDate = endTime ? new Date(endTime) : new Date(startDate.getTime() + 60 * 60 * 1000);

    const apptPayload: Record<string, unknown> = {
      contactId,
      locationId: effectiveLocationId,
      title,
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
      appointmentStatus: 'confirmed',
      calendarId,
    };

    if (assignedUserId) apptPayload.assignedUserId = assignedUserId;
    if (address) apptPayload.address = address;
    if (notes) apptPayload.notes = notes;

    console.log('Sending to GHL:', JSON.stringify(apptPayload));

    const apptResponse = await fetch(
      'https://services.leadconnectorhq.com/calendars/events/appointments',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Content-Type': 'application/json',
          'Version': '2021-04-15',
        },
        body: JSON.stringify(apptPayload),
      }
    );

    if (!apptResponse.ok) {
      const errorText = await apptResponse.text();
      console.error("GHL Appointment API error:", apptResponse.status, errorText);

      // Return the upstream status (e.g. 400 / 422) so the frontend can handle it
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
    console.log('Appointment created in GHL:', appointmentId);

    // Cache appointment in Supabase
    if (appointmentId) {
      const { error: dbError } = await supabase.from('appointments').upsert({
        ghl_id: appointmentId,
        location_id: effectiveLocationId,
        contact_id: contactId,
        title,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        appointment_status: 'confirmed',
        assigned_user_id: assignedUserId || null,
        address: address || null,
        notes: notes || null,
        ghl_date_added: new Date().toISOString(),
        entered_by: enteredBy || null,
      }, { onConflict: 'ghl_id' });

      if (dbError) {
        console.error('Error caching appointment:', dbError);
      } else {
        console.log('Appointment cached in Supabase');
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        appointmentId,
        data: apptData,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error creating GHL appointment:", errorMessage);
    return jsonResponse({ error: errorMessage }, 500);
  }
});
