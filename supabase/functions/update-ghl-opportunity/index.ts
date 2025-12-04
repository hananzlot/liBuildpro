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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!ghlApiKey) {
      throw new Error('Missing GHL_API_KEY');
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase credentials');
    }

    const { ghl_id, status, stage_name, pipeline_stage_id, monetary_value, assigned_to } = await req.json();

    if (!ghl_id) {
      throw new Error('Missing ghl_id');
    }

    console.log(`Updating opportunity ${ghl_id}: status=${status}, stage_name=${stage_name}, pipeline_stage_id=${pipeline_stage_id}, monetary_value=${monetary_value}, assigned_to=${assigned_to}`);

    // Build the update payload for GHL
    const ghlPayload: Record<string, string | number> = {};
    
    if (status) {
      ghlPayload.status = status;
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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const supabaseUpdate: Record<string, string | number> = {};
    if (status) {
      supabaseUpdate.status = status;
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
