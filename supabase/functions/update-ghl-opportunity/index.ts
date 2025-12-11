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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { ghl_id, status, stage_name, pipeline_id, pipeline_name, pipeline_stage_id, monetary_value, assigned_to, location_id } = await req.json();

    if (!ghl_id) {
      throw new Error('Missing ghl_id');
    }

    // If location_id not provided, look it up from the database
    let effectiveLocationId = location_id;
    if (!effectiveLocationId) {
      const { data: oppData } = await supabase
        .from('opportunities')
        .select('location_id')
        .eq('ghl_id', ghl_id)
        .single();
      
      effectiveLocationId = oppData?.location_id || Deno.env.get('GHL_LOCATION_ID');
    }

    const ghlApiKey = getGHLApiKey(effectiveLocationId);

    console.log(`Updating opportunity ${ghl_id} (location: ${effectiveLocationId}): status=${status}, pipeline_id=${pipeline_id}, stage_name=${stage_name}, pipeline_stage_id=${pipeline_stage_id}, monetary_value=${monetary_value}, assigned_to=${assigned_to}`);

    // Build the update payload for GHL
    const ghlPayload: Record<string, string | number> = {};
    
    if (status) {
      ghlPayload.status = status;
    }
    
    if (pipeline_id) {
      ghlPayload.pipelineId = pipeline_id;
    }
    
    if (pipeline_stage_id) {
      ghlPayload.pipelineStageId = pipeline_stage_id;
    }

    if (monetary_value !== undefined && monetary_value !== null) {
      ghlPayload.monetaryValue = Number(monetary_value);
    }

    if (assigned_to) {
      ghlPayload.assignedTo = assigned_to;
    }

    // Update GHL first
    const ghlResponse = await fetch(`https://services.leadconnectorhq.com/opportunities/${ghl_id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${ghlApiKey}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ghlPayload),
    });

    if (!ghlResponse.ok) {
      const errorText = await ghlResponse.text();
      console.error('GHL API Error:', errorText);
      throw new Error(`GHL API Error: ${ghlResponse.status} - ${errorText}`);
    }

    const ghlData = await ghlResponse.json();
    console.log('GHL update successful:', ghlData);

    // Now update Supabase
    const supabaseUpdate: Record<string, string | number> = {};
    if (status) {
      supabaseUpdate.status = status;
    }
    if (pipeline_id) {
      supabaseUpdate.pipeline_id = pipeline_id;
    }
    if (pipeline_name) {
      supabaseUpdate.pipeline_name = pipeline_name;
    }
    if (stage_name) {
      supabaseUpdate.stage_name = stage_name;
    }
    if (pipeline_stage_id) {
      supabaseUpdate.pipeline_stage_id = pipeline_stage_id;
    }
    if (monetary_value !== undefined && monetary_value !== null) {
      supabaseUpdate.monetary_value = Number(monetary_value);
    }
    if (assigned_to) {
      supabaseUpdate.assigned_to = assigned_to;
    }

    const { error: supabaseError } = await supabase
      .from('opportunities')
      .update(supabaseUpdate)
      .eq('ghl_id', ghl_id);

    if (supabaseError) {
      console.error('Supabase update error:', supabaseError);
      // Don't throw here - GHL is updated, just log the error
    }

    console.log('Opportunity updated successfully in both GHL and Supabase');

    return new Response(JSON.stringify({ 
      success: true, 
      ghl_data: ghlData 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error updating opportunity:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
