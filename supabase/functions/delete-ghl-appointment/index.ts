import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to get the correct GHL API key based on location_id
// Returns null if GHL credentials are not configured (local-only mode)
function getGHLApiKey(locationId: string): string | null {
  const location1Id = Deno.env.get('GHL_LOCATION_ID');
  const location2Id = Deno.env.get('GHL_LOCATION_ID_2');
  
  if (locationId === location2Id) {
    const apiKey2 = Deno.env.get('GHL_API_KEY_2');
    if (apiKey2) return apiKey2;
  }
  
  // Default to primary API key
  const apiKey1 = Deno.env.get('GHL_API_KEY');
  if (!apiKey1) return null; // Return null for local-only mode
  return apiKey1;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { appointmentId, locationId } = await req.json();

    if (!appointmentId) {
      throw new Error('Missing appointmentId (GHL appointment ID)');
    }

    // If locationId not provided, look it up from the database
    let effectiveLocationId = locationId;
    if (!effectiveLocationId) {
      const { data: apptData } = await supabase
        .from('appointments')
        .select('location_id')
        .eq('ghl_id', appointmentId)
        .single();
      
      effectiveLocationId = apptData?.location_id || Deno.env.get('GHL_LOCATION_ID') || 'local';
    }

    const ghlApiKey = getGHLApiKey(effectiveLocationId);

    console.log(`Deleting appointment (location: ${effectiveLocationId}): ${appointmentId}`);

    // Check if this is a local-only appointment (ghl_id starts with "local_") or no GHL credentials
    const isLocalAppointment = appointmentId.startsWith('local_');

    if (!isLocalAppointment && ghlApiKey) {
      // GHL doesn't support DELETE for appointments, so we cancel it first via PUT
      const ghlResponse = await fetch(`https://services.leadconnectorhq.com/calendars/events/appointments/${appointmentId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${ghlApiKey}`,
          'Version': '2021-04-15',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          appointmentStatus: 'cancelled',
        }),
      });

      if (!ghlResponse.ok) {
        const errorText = await ghlResponse.text();
        console.error('GHL API Error:', ghlResponse.status, errorText);
        
        // If 404, the appointment doesn't exist in GHL - still proceed to delete from Supabase
        if (ghlResponse.status !== 404) {
          // Log but don't throw - we still want to delete from Supabase
          console.warn('GHL cancellation failed, will still delete from Supabase');
        } else {
          console.log('Appointment not found in GHL - will remove from Supabase only');
        }
      } else {
        console.log('GHL appointment cancelled successfully');
      }
    } else {
      console.log('Local appointment - skipping GHL');
    }

    // Delete from Supabase
    const { error: deleteError } = await supabase
      .from('appointments')
      .delete()
      .eq('ghl_id', appointmentId);

    if (deleteError) {
      console.error('Supabase delete error:', deleteError);
      throw new Error(`Failed to delete from Supabase: ${deleteError.message}`);
    }
    
    console.log('Appointment fully deleted from Supabase');

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Appointment deleted'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error cancelling appointment:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
