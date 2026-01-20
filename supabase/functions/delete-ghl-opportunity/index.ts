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

    const { opportunityId, locationId } = await req.json();

    if (!opportunityId) {
      throw new Error('Missing opportunityId (GHL opportunity ID)');
    }

    // If locationId not provided, look it up from the database
    let effectiveLocationId = locationId;
    if (!effectiveLocationId) {
      const { data: oppData } = await supabase
        .from('opportunities')
        .select('location_id')
        .eq('ghl_id', opportunityId)
        .single();
      
      effectiveLocationId = oppData?.location_id || Deno.env.get('GHL_LOCATION_ID') || 'local';
    }

    const ghlApiKey = getGHLApiKey(effectiveLocationId);

    // Check if this is a local-only opportunity or no GHL credentials
    const isLocalOpportunity = opportunityId.startsWith('local_');
    if (!ghlApiKey || isLocalOpportunity) {
      console.log(`Deleting opportunity locally only (local-only mode or local opportunity): ${opportunityId}`);
      
      const { error: deleteError } = await supabase
        .from('opportunities')
        .delete()
        .eq('ghl_id', opportunityId);
      
      if (deleteError) {
        return new Response(
          JSON.stringify({ error: `Failed to delete local opportunity: ${deleteError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          localOnlyMode: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Deleting GHL opportunity (location: ${effectiveLocationId}): ${opportunityId}`);

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
