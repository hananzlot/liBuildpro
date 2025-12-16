import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
      title,
      startTime,  // ISO string in UTC
      endTime,    // ISO string in UTC (optional)
      assignedUserId,
      address,
      notes,
      location_id,
    } = await req.json();

    if (!ghl_id) {
      throw new Error('ghl_id is required');
    }

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

    const GHL_API_KEY = getGHLApiKey(effectiveLocationId);

    console.log(`Updating GHL appointment ${ghl_id} (location: ${effectiveLocationId})`);

    // Build update payload - only include provided fields
    const updatePayload: Record<string, unknown> = {};
    
    if (appointment_status !== undefined) {
      updatePayload.appointmentStatus = appointment_status;
    }
    if (title !== undefined) {
      updatePayload.title = title;
    }
    if (startTime !== undefined) {
      updatePayload.startTime = startTime;
      // If startTime is provided but not endTime, calculate 1 hour later
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

    if (Object.keys(updatePayload).length === 0) {
      throw new Error('No update fields provided');
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
      throw new Error(`GHL API error: ${ghlResponse.status} - ${errorText}`);
    }

    const ghlData = await ghlResponse.json();
    console.log('GHL appointment updated successfully');

    // Update local cache in Supabase
    const supabaseUpdate: Record<string, unknown> = {
      ghl_date_updated: new Date().toISOString(),
    };
    
    if (appointment_status !== undefined) {
      supabaseUpdate.appointment_status = appointment_status;
    }
    if (title !== undefined) {
      supabaseUpdate.title = title;
    }
    if (startTime !== undefined) {
      supabaseUpdate.start_time = startTime;
    }
    if (endTime !== undefined || (startTime !== undefined && endTime === undefined)) {
      supabaseUpdate.end_time = updatePayload.endTime;
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

    const { error: dbError } = await supabase
      .from('appointments')
      .update(supabaseUpdate)
      .eq('ghl_id', ghl_id);

    if (dbError) {
      console.error('Error updating Supabase cache:', dbError);
    } else {
      console.log('Supabase cache updated');
    }

    return new Response(
      JSON.stringify({ success: true, data: ghlData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error updating GHL appointment:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
