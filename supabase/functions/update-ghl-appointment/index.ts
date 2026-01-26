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

// Helper to get GHL API key from database - returns null if not configured
async function getGHLApiKey(supabase: any, locationId: string): Promise<string | null> {
  if (!locationId || locationId === 'local') {
    return null;
  }

  const { data: integration, error } = await supabase
    .from("company_integrations")
    .select("id, api_key_encrypted")
    .eq("provider", "ghl")
    .eq("location_id", locationId)
    .eq("is_active", true)
    .single();

  if (error || !integration || !integration.api_key_encrypted) {
    console.error(`GHL integration not configured for location ${locationId}`);
    return null;
  }

  const { data: apiKey, error: vaultError } = await supabase.rpc(
    "get_ghl_api_key_encrypted",
    { p_integration_id: integration.id }
  );

  if (vaultError || !apiKey) {
    console.error(`Failed to retrieve GHL API key: ${vaultError?.message}`);
    return null;
  }

  return apiKey;
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
      appointmentUuid, // Internal UUID - primary identifier for local/Google appointments
      appointment_status,
      status, // alias for appointment_status (from frontend)
      title,
      startTime,  // ISO string in UTC (camelCase from some callers)
      start_time, // ISO string in UTC (snake_case from Calendar.tsx)
      endTime,    // ISO string in UTC (optional, camelCase)
      end_time,   // ISO string in UTC (optional, snake_case)
      assignedUserId,
      address,
      notes,
      calendarId,
      location_id,
      skipGHLSync = false, // If true, only update local DB (no GHL API call)
    } = await req.json();
    
    // Support both naming conventions
    const effectiveStatus = appointment_status || status;
    const effectiveStartTime = startTime || start_time;
    const effectiveEndTime = endTime || end_time;

    // Require at least one identifier
    if (!ghl_id && !appointmentUuid) {
      return jsonResponse({ error: 'Either ghl_id or appointmentUuid is required' }, 400);
    }

    // Check if this is a local-only appointment (no ghl_id OR ghl_id starts with "local_")
    const isLocalAppointment = !ghl_id || ghl_id.startsWith('local_');

    // If location_id not provided, look it up from the database
    let effectiveLocationId = location_id;
    let resolvedGhlId = ghl_id;
    
    if (!effectiveLocationId || !resolvedGhlId) {
      // Look up by either ghl_id or appointmentUuid
      let query = supabase
        .from('appointments')
        .select('location_id, ghl_id');
      
      if (appointmentUuid) {
        query = query.eq('id', appointmentUuid);
      } else if (ghl_id) {
        query = query.eq('ghl_id', ghl_id);
      }
      
      const { data: apptData } = await query.single();
      
      if (apptData) {
        effectiveLocationId = effectiveLocationId || apptData.location_id;
        resolvedGhlId = resolvedGhlId || apptData.ghl_id;
      }
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
    if (effectiveStartTime !== undefined) {
      supabaseUpdate.start_time = effectiveStartTime;
      if (effectiveEndTime === undefined) {
        const startDate = new Date(effectiveStartTime);
        supabaseUpdate.end_time = new Date(startDate.getTime() + 60 * 60 * 1000).toISOString();
      }
    }
    if (effectiveEndTime !== undefined) {
      supabaseUpdate.end_time = effectiveEndTime;
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

    // Supabase-first: If skipGHLSync is true OR this is a local appointment, only update the local DB
    if (skipGHLSync || isLocalAppointment) {
      const appointmentIdentifier = appointmentUuid || resolvedGhlId;
      console.log(`Updating local/Google appointment in Supabase: ${appointmentIdentifier}`);
      
      // Build query based on available identifier
      let updateQuery = supabase.from('appointments').update(supabaseUpdate);
      
      if (appointmentUuid) {
        updateQuery = updateQuery.eq('id', appointmentUuid);
      } else if (resolvedGhlId) {
        updateQuery = updateQuery.eq('ghl_id', resolvedGhlId);
      } else {
        return jsonResponse({ error: 'No valid identifier found for appointment' }, 400);
      }
      
      const { error: dbError } = await updateQuery;

      if (dbError) {
        console.error('Error updating local appointment:', dbError);
        return jsonResponse({ error: `Failed to update local appointment: ${dbError.message}` }, 500);
      }

      console.log('Appointment updated in Supabase');
      return jsonResponse({ success: true, local: true });
    }

    const GHL_API_KEY = await getGHLApiKey(supabase, effectiveLocationId);
    console.log(`Updating appointment ${ghl_id} with GHL sync (location: ${effectiveLocationId})`);

    // Build GHL update payload - but skip startTime/endTime to avoid slot validation issues
    // GHL validates slot availability which fails for already-booked times
    // We'll update time locally only, and send other fields to GHL
    const updatePayload: Record<string, unknown> = {};
    
    if (effectiveStatus !== undefined) {
      updatePayload.appointmentStatus = mapStatusToGHL(effectiveStatus);
    }
    if (title !== undefined) {
      updatePayload.title = title;
    }
    // NOTE: Skipping startTime/endTime in GHL payload to avoid "slot not available" errors
    // Time changes are stored locally in Supabase only
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

    // If only time fields were provided, skip GHL API call entirely
    const hasNonTimeFields = Object.keys(updatePayload).length > 0;
    
    if (!hasNonTimeFields) {
      console.log('Only time fields provided, updating Supabase only (skipping GHL to avoid slot validation)');
      
      const { error: dbError } = await supabase
        .from('appointments')
        .update(supabaseUpdate)
        .eq('ghl_id', ghl_id);

      if (dbError) {
        console.error('Error updating appointment:', dbError);
        return jsonResponse({ error: `Failed to update appointment: ${dbError.message}` }, 500);
      }

      console.log('Appointment time updated locally (GHL skipped)');
      return jsonResponse({ success: true, localOnly: true, reason: 'time_change_only' });
    }

    console.log('Updating GHL with payload:', JSON.stringify(updatePayload));

    // Update appointment in GHL (without time fields)
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
    console.log('GHL sync successful');

    // Update Supabase (primary storage)
    supabaseUpdate.ghl_date_updated = new Date().toISOString();

    const { error: dbError } = await supabase
      .from('appointments')
      .update(supabaseUpdate)
      .eq('ghl_id', ghl_id);

    if (dbError) {
      console.error('Error updating appointment in Supabase:', dbError);
    } else {
      console.log('Appointment updated in Supabase');
    }

    return jsonResponse({ success: true, data: ghlData });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error updating appointment:', errorMessage);
    return jsonResponse({ error: errorMessage }, 500);
  }
});
