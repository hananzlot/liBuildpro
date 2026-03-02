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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { ghl_id, opportunity_uuid, name, status, stage_name, pipeline_id, pipeline_name, pipeline_stage_id, monetary_value, assigned_to, location_id, edited_by, won_at, ghl_date_added, company_id } = await req.json();

    // Support both ghl_id and opportunity_uuid (internal UUID) for identification
    // This allows updating local-only opportunities that don't have a GHL ID
    if (!ghl_id && !opportunity_uuid) {
      throw new Error('Missing identifier: provide either ghl_id or opportunity_uuid');
    }

    // Determine which column to use for lookup
    const lookupColumn = opportunity_uuid ? 'id' : 'ghl_id';
    const lookupValue = opportunity_uuid || ghl_id;

    console.log(`Looking up opportunity by ${lookupColumn}: ${lookupValue}`);

    // Fetch current opportunity values BEFORE update
    const { data: currentOpp, error: fetchError } = await supabase
      .from('opportunities')
      .select('id, ghl_id, name, status, stage_name, pipeline_name, monetary_value, assigned_to, location_id, won_at, ghl_date_added, company_id, contact_id, contact_uuid, scope_of_work')
      .eq(lookupColumn, lookupValue)
      .single();

    if (fetchError || !currentOpp) {
      console.error('Error fetching opportunity:', fetchError);
      throw new Error(`Opportunity not found: ${lookupValue}`);
    }

    // Use the actual ghl_id from the record for edit tracking (may be local_opp_... or a real GHL ID)
    const effectiveGhlId = currentOpp.ghl_id || `local_opp_${currentOpp.id}`;
    const effectiveUuid = currentOpp.id;

    // If location_id not provided, use from database
    let effectiveLocationId = location_id;
    if (!effectiveLocationId && currentOpp) {
      effectiveLocationId = currentOpp.location_id || 'local';
    }
    
    // If company_id not provided, use from opportunity or derive from contact
    let effectiveCompanyId = company_id;
    if (!effectiveCompanyId && currentOpp) {
      effectiveCompanyId = currentOpp.company_id;
      
      // If still no company_id, try to get from contact
      if (!effectiveCompanyId && currentOpp.contact_id) {
        const { data: contactData } = await supabase
          .from('contacts')
          .select('company_id')
          .eq('ghl_id', currentOpp.contact_id)
          .maybeSingle();
        
        // Also try by UUID if ghl_id lookup failed
        if (!contactData && currentOpp.contact_uuid) {
          const { data: contactByUuid } = await supabase
            .from('contacts')
            .select('company_id')
            .eq('id', currentOpp.contact_uuid)
            .maybeSingle();
          effectiveCompanyId = contactByUuid?.company_id;
        } else {
          effectiveCompanyId = contactData?.company_id;
        }
      }
    }

    console.log(`Updating opportunity ${effectiveGhlId} (UUID: ${effectiveUuid}): name=${name}, status=${status}, pipeline_id=${pipeline_id}, stage_name=${stage_name}, pipeline_stage_id=${pipeline_stage_id}, monetary_value=${monetary_value}, assigned_to=${assigned_to}`);

    // Build the update payload for Supabase
    const supabaseUpdate: Record<string, string | number | null> = {};
    if (name) {
      supabaseUpdate.name = name;
    }
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
      
      // Also resolve and set salesperson_id (internal UUID) for consistent attribution
      const { data: spData } = await supabase
        .from('salespeople')
        .select('id')
        .or(`id.eq.${assigned_to},ghl_user_id.eq.${assigned_to}`)
        .eq('company_id', effectiveCompanyId || currentOpp.company_id)
        .maybeSingle();
      
      if (spData) {
        supabaseUpdate.salesperson_id = spData.id;
      }
    }
    
    // Handle won_at timestamp
    if (won_at !== undefined) {
      supabaseUpdate.won_at = won_at;
      console.log(`Setting won_at to explicitly provided value: ${won_at}`);
    }
    else if (status === 'won' && currentOpp?.status !== 'won' && !currentOpp?.won_at) {
      supabaseUpdate.won_at = new Date().toISOString();
      console.log(`Auto-setting won_at to current time for status change to won`);
    }

    // Handle ghl_date_added (super admin only - created date edit)
    if (ghl_date_added !== undefined) {
      supabaseUpdate.ghl_date_added = ghl_date_added;
      console.log(`Setting ghl_date_added to explicitly provided value: ${ghl_date_added}`);
    }

    console.log(`Supabase update payload for ${effectiveUuid}:`, JSON.stringify(supabaseUpdate));

    // Only update if there are fields to update - use UUID for reliable matching
    if (Object.keys(supabaseUpdate).length > 0) {
      const { data: updateResult, error: supabaseError } = await supabase
        .from('opportunities')
        .update(supabaseUpdate)
        .eq('id', effectiveUuid)
        .select('won_at')
        .single();

      if (supabaseError) {
        console.error('Supabase update error:', supabaseError);
        throw new Error(`Supabase update failed: ${supabaseError.message}`);
      }
      console.log(`Supabase update successful, won_at now: ${updateResult?.won_at}`);
    } else {
      console.log('No fields to update in Supabase');
    }

    // Track edits - compare old vs new values
    if (currentOpp) {
      const editsToInsert: Array<{
        opportunity_ghl_id: string;
        field_name: string;
        old_value: string | null;
        new_value: string | null;
        edited_by: string | null;
        location_id: string;
        company_id: string | null;
      }> = [];

      // Check name
      if (name && currentOpp.name !== name) {
        editsToInsert.push({
          opportunity_ghl_id: effectiveGhlId,
          field_name: 'name',
          old_value: currentOpp.name || null,
          new_value: name,
          edited_by: edited_by || null,
          location_id: effectiveLocationId,
          company_id: effectiveCompanyId || null,
        });
      }

      // Check status
      if (status && currentOpp.status !== status) {
        editsToInsert.push({
          opportunity_ghl_id: effectiveGhlId,
          field_name: 'status',
          old_value: currentOpp.status || null,
          new_value: status,
          edited_by: edited_by || null,
          location_id: effectiveLocationId,
          company_id: effectiveCompanyId || null,
        });
      }

      // Check stage_name
      if (stage_name && currentOpp.stage_name !== stage_name) {
        editsToInsert.push({
          opportunity_ghl_id: effectiveGhlId,
          field_name: 'stage_name',
          old_value: currentOpp.stage_name || null,
          new_value: stage_name,
          edited_by: edited_by || null,
          location_id: effectiveLocationId,
          company_id: effectiveCompanyId || null,
        });
      }

      // Check pipeline_name
      if (pipeline_name && currentOpp.pipeline_name !== pipeline_name) {
        editsToInsert.push({
          opportunity_ghl_id: effectiveGhlId,
          field_name: 'pipeline_name',
          old_value: currentOpp.pipeline_name || null,
          new_value: pipeline_name,
          edited_by: edited_by || null,
          location_id: effectiveLocationId,
          company_id: effectiveCompanyId || null,
        });
      }

      // Check monetary_value
      if (monetary_value !== undefined && monetary_value !== null) {
        const oldValue = currentOpp.monetary_value;
        const newValue = Number(monetary_value);
        if (oldValue !== newValue) {
          editsToInsert.push({
            opportunity_ghl_id: effectiveGhlId,
            field_name: 'monetary_value',
            old_value: oldValue?.toString() || null,
            new_value: newValue.toString(),
            edited_by: edited_by || null,
            location_id: effectiveLocationId,
            company_id: effectiveCompanyId || null,
          });
        }
      }

      // Check assigned_to
      if (assigned_to && currentOpp.assigned_to !== assigned_to) {
        editsToInsert.push({
          opportunity_ghl_id: effectiveGhlId,
          field_name: 'assigned_to',
          old_value: currentOpp.assigned_to || null,
          new_value: assigned_to,
          edited_by: edited_by || null,
          location_id: effectiveLocationId,
          company_id: effectiveCompanyId || null,
        });
      }

      // Check won_at (only if explicitly provided - admin edits)
      if (won_at !== undefined && currentOpp.won_at !== won_at) {
        editsToInsert.push({
          opportunity_ghl_id: effectiveGhlId,
          field_name: 'won_at',
          old_value: currentOpp.won_at || null,
          new_value: won_at,
          edited_by: edited_by || null,
          location_id: effectiveLocationId,
          company_id: effectiveCompanyId || null,
        });
      }

      // Check ghl_date_added (only if explicitly provided - super admin edits)
      if (ghl_date_added !== undefined && currentOpp.ghl_date_added !== ghl_date_added) {
        editsToInsert.push({
          opportunity_ghl_id: effectiveGhlId,
          field_name: 'ghl_date_added',
          old_value: currentOpp.ghl_date_added || null,
          new_value: ghl_date_added,
          edited_by: edited_by || null,
          location_id: effectiveLocationId,
          company_id: effectiveCompanyId || null,
        });
      }

      // Insert all edits
      if (editsToInsert.length > 0) {
        console.log(`Tracking ${editsToInsert.length} field edits for opportunity ${effectiveGhlId}`);
        const { error: editError } = await supabase
          .from('opportunity_edits')
          .insert(editsToInsert);
        
        if (editError) {
          console.error('Error inserting edits:', editError);
        }
      }
    }

    // NOTE: Project creation for "Won" opportunities is handled by the frontend
    // (OpportunityDetailSheet) which prompts the user before creating a project.
    // Do NOT auto-create projects here to avoid duplicates.

    console.log('Opportunity updated successfully (local only)');

    return new Response(JSON.stringify({ 
      success: true, 
      localOnly: true,
      opportunityId: effectiveUuid,
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
