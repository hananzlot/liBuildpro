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

    const { contactId, taskId, locationId } = await req.json();

    if (!contactId) {
      throw new Error('Missing contactId');
    }

    if (!taskId) {
      throw new Error('Missing taskId (GHL task ID)');
    }

    // If locationId not provided, look it up from the task
    let effectiveLocationId = locationId;
    if (!effectiveLocationId) {
      const { data: taskData } = await supabase
        .from('ghl_tasks')
        .select('location_id')
        .eq('ghl_id', taskId)
        .single();
      
      effectiveLocationId = taskData?.location_id || Deno.env.get('GHL_LOCATION_ID');
    }

    const ghlApiKey = getGHLApiKey(effectiveLocationId);

    console.log(`Deleting GHL task (location: ${effectiveLocationId}): taskId=${taskId}, contactId=${contactId}`);

    // Delete task in GHL
    const ghlResponse = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}/tasks/${taskId}`, {
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

    console.log('GHL task deleted successfully');

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Task deleted from GHL'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error deleting GHL task:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
