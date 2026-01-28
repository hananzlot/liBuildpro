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
    } = await req.json();
    
    // Support both naming conventions
    const effectiveStatus = appointment_status || status;
    const effectiveStartTime = startTime || start_time;
    const effectiveEndTime = endTime || end_time;

    // Require at least one identifier
    if (!ghl_id && !appointmentUuid) {
      return jsonResponse({ error: 'Either ghl_id or appointmentUuid is required' }, 400);
    }

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

    const appointmentIdentifier = appointmentUuid || resolvedGhlId;
    console.log(`Updating appointment in Supabase (local-only): ${appointmentIdentifier}`);
    
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
      console.error('Error updating appointment:', dbError);
      return jsonResponse({ error: `Failed to update appointment: ${dbError.message}` }, 500);
    }

    console.log('Appointment updated in Supabase');
    return jsonResponse({ success: true, local: true });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error updating appointment:', errorMessage);
    return jsonResponse({ error: errorMessage }, 500);
  }
});
