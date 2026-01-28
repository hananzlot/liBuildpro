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
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { opportunityId, excludeFromSync = true } = await req.json();

    if (!opportunityId) {
      throw new Error('Missing opportunityId');
    }

    console.log(`Deleting opportunity: ${opportunityId} (local-only, excludeFromSync: ${excludeFromSync})`);

    // Fetch opportunity details before deleting
    const { data: opportunity } = await supabase
      .from('opportunities')
      .select('id, ghl_id, location_id, company_id, name')
      .eq('ghl_id', opportunityId)
      .maybeSingle();

    if (!opportunity) {
      console.log('Opportunity not found in database');
      return new Response(JSON.stringify({ 
        success: true,
        message: 'Opportunity not found or already deleted'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Add to sync exclusions if requested (prevents re-sync from GHL)
    if (excludeFromSync && opportunity.ghl_id && opportunity.location_id) {
      const { error: exclusionError } = await supabase
        .from('ghl_sync_exclusions')
        .upsert({
          ghl_id: opportunity.ghl_id,
          record_type: 'opportunity',
          location_id: opportunity.location_id,
          company_id: opportunity.company_id,
          reason: `Deleted via app: ${opportunity.name || 'Unknown'}`,
        }, { onConflict: 'ghl_id,record_type,location_id' });

      if (exclusionError) {
        console.error('Error adding sync exclusion:', exclusionError);
      } else {
        console.log('Added opportunity to sync exclusions');
      }
    }

    // Delete from Supabase
    const { error: deleteError } = await supabase
      .from('opportunities')
      .delete()
      .eq('ghl_id', opportunityId);

    if (deleteError) {
      console.error('Supabase delete error:', deleteError);
      throw new Error(`Failed to delete opportunity: ${deleteError.message}`);
    }
    
    console.log('Opportunity deleted from Supabase');

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Opportunity deleted',
      excludedFromSync: excludeFromSync
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
