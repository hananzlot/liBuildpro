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

    const { opportunityId } = await req.json();

    if (!opportunityId) {
      throw new Error('Missing opportunityId (GHL opportunity ID)');
    }

    console.log(`Deleting GHL opportunity: ${opportunityId}`);

    // Delete opportunity in GHL
    const ghlResponse = await fetch(`https://services.leadconnectorhq.com/opportunities/${opportunityId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${ghlApiKey}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json',
      },
    });

    if (!ghlResponse.ok) {
      const errorText = await ghlResponse.text();
      console.error('GHL API Error:', errorText);
      throw new Error(`GHL API Error: ${ghlResponse.status} - ${errorText}`);
    }

    console.log('GHL opportunity deleted successfully');

    // Delete from Supabase
    const { error: deleteError } = await supabase
      .from('opportunities')
      .delete()
      .eq('ghl_id', opportunityId);

    if (deleteError) {
      console.error('Supabase delete error:', deleteError);
      // Don't throw - GHL deletion was successful
    } else {
      console.log('Opportunity deleted from Supabase');
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Opportunity deleted'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error deleting opportunity:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
