import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonResponse = (body: unknown, status = 200) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
};

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

// Map internal status values to valid GHL API enum values
// Valid GHL values: confirmed, cancelled, showed, noshow, invalid
function mapStatusToGHL(status: string): string {
  const mapping: Record<string, string> = {
    'no_show': 'noshow',
    'no show': 'noshow',
    'noshow': 'noshow',
    'confirmed': 'confirmed',
    'cancelled': 'cancelled',
    'canceled': 'cancelled',
    'showed': 'showed',
    'invalid': 'invalid',
  };
  
  const lowercaseStatus = status.toLowerCase().trim();
  return mapping[lowercaseStatus] || lowercaseStatus;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const { 
      ghl_id, 
      appointment_status,
      status, // alias for appointment_status (from frontend)
      title,
      startTime,  // ISO string in UTC
      endTime,    // ISO string in UTC (optional)
      assignedUserId,
      address,
      notes,
      calendarId,
      location_id,
      skipGHLSync = false, // If true, only update local DB (no GHL API call)
    } = await req.json();
    
    // Support both 'status' and 'appointment_status' field names
    const effectiveStatus = appointment_status || status;

    if (!ghl_id) {
      return jsonResponse({ error: 'ghl_id is required' }, 400);
    }

    // Check if this is a local-only appointment (ghl_id starts with "local_")
    const isLocalAppointment = ghl_id.startsWith('local_');

    // If location_id not provided, look it up from the database
    let effectiveLocationId = location_id;
    if (!effectiveLocationId) {
      const { data: apptData } = await supabase
        .from('appointments')
        .select('location_id')
        .eq('ghl_id', ghl_id)
        .single();
      
      effectiveLocationId = apptData?.location_id || Deno.env.get('GHL_LOCATION_ID');
    }

    // Build Supabase update payload
    const supabaseUpdate: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    
    if (effectiveStatus !== undefined) {
      supabaseUpdate.appointment_status = effectiveStatus;
    }
    if (title !== undefined) {
      supabaseUpdate.title = title;
    }
    if (startTime !== undefined) {
      supabaseUpdate.start_time = startTime;
      if (endTime === undefined) {
        const startDate = new Date(startTime);
        supabaseUpdate.end_time = new Date(startDate.getTime() + 60 * 60 * 1000).toISOString();
      }
    }
    if (endTime !== undefined) {
      supabaseUpdate.end_time = endTime;
    }
    if (assignedUserId !== undefined) {
      supabaseUpdate.assigned_user_id = assignedUserId;
    }
    if (address !== undefined) {
      supabaseUpdate.address = address;
    }
    if (notes !== undefined) {
      supabaseUpdate.notes = notes;
    }
    if (calendarId !== undefined && calendarId !== null) {
      supabaseUpdate.calendar_id = calendarId;
    }

    // If skipGHLSync is true OR this is a local appointment, only update the local DB
    if (skipGHLSync || isLocalAppointment) {
      console.log(`Updating local-only appointment ${ghl_id}`);
      
      const { error: dbError } = await supabase
        .from('appointments')
        .update(supabaseUpdate)
        .eq('ghl_id', ghl_id);

      if (dbError) {
        console.error('Error updating local appointment:', dbError);
        return jsonResponse({ error: `Failed to update local appointment: ${dbError.message}` }, 500);
      }

      console.log('Local appointment updated successfully');
      return jsonResponse({ success: true, local: true });
    }

    const GHL_API_KEY = getGHLApiKey(effectiveLocationId);
    console.log(`Updating GHL appointment ${ghl_id} (location: ${effectiveLocationId})`);

    // Build GHL update payload
    const updatePayload: Record<string, unknown> = {};
    
    if (effectiveStatus !== undefined) {
      updatePayload.appointmentStatus = mapStatusToGHL(effectiveStatus);
    }
    if (title !== undefined) {
      updatePayload.title = title;
    }
    if (startTime !== undefined) {
      updatePayload.startTime = startTime;
      if (endTime === undefined) {
        const startDate = new Date(startTime);
        updatePayload.endTime = new Date(startDate.getTime() + 60 * 60 * 1000).toISOString();
      }
    }
    if (endTime !== undefined) {
      updatePayload.endTime = endTime;
    }
    if (assignedUserId !== undefined) {
      updatePayload.assignedUserId = assignedUserId;
    }
    if (address !== undefined) {
      updatePayload.address = address;
    }
    if (notes !== undefined) {
      updatePayload.notes = notes;
    }
    if (calendarId !== undefined && calendarId !== null) {
      updatePayload.calendarId = calendarId;
    }

    if (Object.keys(updatePayload).length === 0) {
      return jsonResponse({ error: 'No update fields provided' }, 400);
    }

    console.log('Updating with payload:', JSON.stringify(updatePayload));

    // Update appointment in GHL
    const ghlResponse = await fetch(
      `https://services.leadconnectorhq.com/calendars/events/appointments/${ghl_id}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Content-Type': 'application/json',
          'Version': '2021-04-15',
        },
        body: JSON.stringify(updatePayload),
      }
    );

    if (!ghlResponse.ok) {
      const errorText = await ghlResponse.text();
      console.error('GHL API error:', ghlResponse.status, errorText);
      return jsonResponse(
        { error: `GHL API error: ${ghlResponse.status} - ${errorText}` },
        ghlResponse.status
      );
    }

    const ghlData = await ghlResponse.json();
    console.log('GHL appointment updated successfully');

    // Update local cache in Supabase (reuse supabaseUpdate built earlier)
    supabaseUpdate.ghl_date_updated = new Date().toISOString();

    const { error: dbError } = await supabase
      .from('appointments')
      .update(supabaseUpdate)
      .eq('ghl_id', ghl_id);

    if (dbError) {
      console.error('Error updating Supabase cache:', dbError);
    } else {
      console.log('Supabase cache updated');
    }

    return jsonResponse({ success: true, data: ghlData });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error updating GHL appointment:', errorMessage);
    return jsonResponse({ error: errorMessage }, 500);
  }
});
