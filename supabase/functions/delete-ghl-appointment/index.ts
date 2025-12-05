import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ghlApiKey = Deno.env.get('GHL_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!ghlApiKey) {
      throw new Error('Missing GHL_API_KEY');
    }
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { appointmentId } = await req.json();

    if (!appointmentId) {
      throw new Error('Missing appointmentId (GHL appointment ID)');
    }

    console.log(`Cancelling GHL appointment: ${appointmentId}`);

    // GHL doesn't support DELETE for appointments, so we cancel it instead
    // by updating the appointment status to "cancelled"
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

    let ghlSuccess = true;
    if (!ghlResponse.ok) {
      const errorText = await ghlResponse.text();
      console.error('GHL API Error:', ghlResponse.status, errorText);
      
      // If 404, the appointment doesn't exist in GHL (maybe test data or already deleted)
      // We should still clean up Supabase
      if (ghlResponse.status === 404) {
        console.log('Appointment not found in GHL - will remove from Supabase only');
        ghlSuccess = false;
      } else {
        throw new Error(`GHL API Error: ${ghlResponse.status} - ${errorText}`);
      }
    } else {
      console.log('GHL appointment cancelled successfully');
    }

    // Update/delete in Supabase
    if (ghlSuccess) {
      // If GHL cancellation worked, update status
      const { error: updateError } = await supabase
        .from('appointments')
        .update({ 
          appointment_status: 'cancelled',
          ghl_date_updated: new Date().toISOString(),
        })
        .eq('ghl_id', appointmentId);

      if (updateError) {
        console.error('Supabase update error:', updateError);
      } else {
        console.log('Appointment marked as cancelled in Supabase');
      }
    } else {
      // If appointment doesn't exist in GHL, delete from Supabase entirely
      const { error: deleteError } = await supabase
        .from('appointments')
        .delete()
        .eq('ghl_id', appointmentId);

      if (deleteError) {
        console.error('Supabase delete error:', deleteError);
      } else {
        console.log('Appointment deleted from Supabase (was not in GHL)');
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: ghlSuccess ? 'Appointment cancelled' : 'Appointment removed (was not in GHL)'
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
