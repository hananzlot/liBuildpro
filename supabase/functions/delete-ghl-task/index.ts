import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to get GHL API key from database - returns null if not configured
async function getGHLApiKey(supabase: any, locationId: string): Promise<string | null> {
  if (!locationId || locationId === 'local') {
    return null;
  }

  const { data: integration, error } = await supabase
    .from("company_integrations")
    .select("id, api_key_vault_id")
    .eq("provider", "ghl")
    .eq("location_id", locationId)
    .eq("is_active", true)
    .single();

  if (error || !integration || !integration.api_key_vault_id) {
    console.error(`GHL integration not configured for location ${locationId}`);
    return null;
  }

  const { data: apiKey, error: vaultError } = await supabase.rpc(
    "get_ghl_api_key",
    { secret_id: integration.api_key_vault_id }
  );

  if (vaultError || !apiKey) {
    console.error(`Failed to retrieve GHL API key: ${vaultError?.message}`);
    return null;
  }

  return apiKey;
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
      
      effectiveLocationId = taskData?.location_id || 'local';
    }

    const ghlApiKey = await getGHLApiKey(supabase, effectiveLocationId);

    // Check if this is a local-only task or no GHL credentials
    const isLocalTask = taskId.startsWith('local_');
    if (!ghlApiKey || isLocalTask) {
      console.log(`Deleting task locally only (local-only mode or local task): taskId=${taskId}`);
      
      const { error: deleteError } = await supabase
        .from('ghl_tasks')
        .delete()
        .eq('ghl_id', taskId);
      
      if (deleteError) {
        return new Response(
          JSON.stringify({ error: `Failed to delete local task: ${deleteError.message}` }),
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
