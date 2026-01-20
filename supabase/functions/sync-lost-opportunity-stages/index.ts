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
    const GHL_API_KEY = Deno.env.get('GHL_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find opportunities with status "lost" but not stage "Lost/DNC"
    const { data: opportunities, error: fetchError } = await supabase
      .from('opportunities')
      .select('ghl_id, name, status, stage_name, pipeline_id, pipeline_stage_id')
      .eq('status', 'lost')
      .neq('stage_name', 'Lost/DNC');

    if (fetchError) {
      throw new Error(`Failed to fetch opportunities: ${fetchError.message}`);
    }

    console.log(`Found ${opportunities?.length || 0} lost opportunities not in Lost/DNC stage`);

    if (!opportunities || opportunities.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No opportunities to update',
        updated: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build a map of pipeline_id -> Lost/DNC stage_id by finding existing Lost/DNC opportunities per pipeline
    const { data: lostDncOpps, error: stageError } = await supabase
      .from('opportunities')
      .select('pipeline_id, pipeline_stage_id')
      .eq('stage_name', 'Lost/DNC')
      .not('pipeline_id', 'is', null);

    if (stageError) {
      console.error('Error finding Lost/DNC stages:', stageError);
    }

    // Create map of pipeline_id -> Lost/DNC stage_id
    const pipelineLostDncMap: Record<string, string> = {};
    if (lostDncOpps) {
      for (const opp of lostDncOpps) {
        if (opp.pipeline_id && opp.pipeline_stage_id) {
          pipelineLostDncMap[opp.pipeline_id] = opp.pipeline_stage_id;
        }
      }
    }

    console.log(`Found Lost/DNC stage IDs for ${Object.keys(pipelineLostDncMap).length} pipelines:`, pipelineLostDncMap);

    // Check if GHL API is available
    const ghlEnabled = !!GHL_API_KEY;
    if (!ghlEnabled) {
      console.log('GHL API key not configured - performing local-only stage updates');
    }

    let updatedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const opp of opportunities) {
      try {
        // Get the Lost/DNC stage ID for this opportunity's pipeline
        const lostDncStageId = opp.pipeline_id ? pipelineLostDncMap[opp.pipeline_id] : null;

        if (!lostDncStageId) {
          console.log(`Skipping ${opp.name} - no Lost/DNC stage found for pipeline ${opp.pipeline_id}`);
          skippedCount++;
          continue;
        }

        console.log(`Updating opportunity ${opp.ghl_id} (${opp.name}) from stage "${opp.stage_name}" to "Lost/DNC" (stage ID: ${lostDncStageId})`);

        // Update in GHL only if API key is configured and not a local-only opportunity
        if (ghlEnabled && opp.ghl_id && !opp.ghl_id.startsWith('local_')) {
          const ghlResponse = await fetch(`https://services.leadconnectorhq.com/opportunities/${opp.ghl_id}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${GHL_API_KEY}`,
              'Content-Type': 'application/json',
              'Version': '2021-07-28',
            },
            body: JSON.stringify({
              pipelineStageId: lostDncStageId,
            }),
          });

          if (!ghlResponse.ok) {
            const errorText = await ghlResponse.text();
            console.error(`GHL update failed for ${opp.ghl_id}: ${errorText}`);
            // Continue with local update even if GHL fails
          }
        }

        // Update in Supabase
        const { error: updateError } = await supabase
          .from('opportunities')
          .update({
            stage_name: 'Lost/DNC',
            pipeline_stage_id: lostDncStageId,
            updated_at: new Date().toISOString(),
          })
          .eq('ghl_id', opp.ghl_id);

        if (updateError) {
          console.error(`Supabase update failed for ${opp.ghl_id}: ${updateError.message}`);
          errors.push(`${opp.name}: Supabase error - ${updateError.message}`);
          continue;
        }

        updatedCount++;
        console.log(`Successfully updated ${opp.name}`);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`Error updating ${opp.ghl_id}:`, err);
        errors.push(`${opp.name}: ${errMsg}`);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Updated ${updatedCount} of ${opportunities.length} opportunities (${skippedCount} skipped - no Lost/DNC stage in pipeline)`,
      updated: updatedCount,
      skipped: skippedCount,
      total: opportunities.length,
      ghlSyncEnabled: ghlEnabled,
      errors: errors.length > 0 ? errors : undefined
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Error in sync-lost-opportunity-stages:', error);
    return new Response(JSON.stringify({ error: errMsg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
