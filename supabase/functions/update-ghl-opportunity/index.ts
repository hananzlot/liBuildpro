import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to get the correct GHL API key based on location_id
function getGHLApiKey(locationId: string): string {
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

// Helper function to delay execution
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function to make GHL API request with retry logic
async function fetchWithRetry(
  url: string, 
  options: RequestInit, 
  maxRetries = 3
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(url, options);
    
    if (response.ok) {
      return response;
    }
    
    // Handle rate limiting (429)
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt + 1) * 1000;
      console.log(`Rate limited (429). Waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`);
      await delay(waitTime);
      continue;
    }
    
    // For other errors, don't retry
    const errorText = await response.text();
    lastError = new Error(`GHL API Error: ${response.status} - ${errorText}`);
    console.error('GHL API Error:', errorText);
    throw lastError;
  }
  
  throw lastError || new Error('Max retries exceeded');
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

    const { ghl_id, status, stage_name, pipeline_id, pipeline_name, pipeline_stage_id, monetary_value, assigned_to, location_id, edited_by } = await req.json();

    if (!ghl_id) {
      throw new Error('Missing ghl_id');
    }

    // Fetch current opportunity values BEFORE update
    const { data: currentOpp } = await supabase
      .from('opportunities')
      .select('status, stage_name, pipeline_name, monetary_value, assigned_to, location_id')
      .eq('ghl_id', ghl_id)
      .single();

    // If location_id not provided, use from database
    let effectiveLocationId = location_id;
    if (!effectiveLocationId && currentOpp) {
      effectiveLocationId = currentOpp.location_id || Deno.env.get('GHL_LOCATION_ID');
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

    // Update GHL first with retry logic for rate limiting
    const ghlResponse = await fetchWithRetry(
      `https://services.leadconnectorhq.com/opportunities/${ghl_id}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${ghlApiKey}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(ghlPayload),
      },
      3 // max retries
    );

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
      }> = [];

      // Check status
      if (status && currentOpp.status !== status) {
        editsToInsert.push({
          opportunity_ghl_id: ghl_id,
          field_name: 'status',
          old_value: currentOpp.status || null,
          new_value: status,
          edited_by: edited_by || null,
          location_id: effectiveLocationId,
        });
      }

      // Check stage_name
      if (stage_name && currentOpp.stage_name !== stage_name) {
        editsToInsert.push({
          opportunity_ghl_id: ghl_id,
          field_name: 'stage_name',
          old_value: currentOpp.stage_name || null,
          new_value: stage_name,
          edited_by: edited_by || null,
          location_id: effectiveLocationId,
        });
      }

      // Check pipeline_name
      if (pipeline_name && currentOpp.pipeline_name !== pipeline_name) {
        editsToInsert.push({
          opportunity_ghl_id: ghl_id,
          field_name: 'pipeline_name',
          old_value: currentOpp.pipeline_name || null,
          new_value: pipeline_name,
          edited_by: edited_by || null,
          location_id: effectiveLocationId,
        });
      }

      // Check monetary_value
      if (monetary_value !== undefined && monetary_value !== null) {
        const oldValue = currentOpp.monetary_value;
        const newValue = Number(monetary_value);
        if (oldValue !== newValue) {
          editsToInsert.push({
            opportunity_ghl_id: ghl_id,
            field_name: 'monetary_value',
            old_value: oldValue?.toString() || null,
            new_value: newValue.toString(),
            edited_by: edited_by || null,
            location_id: effectiveLocationId,
          });
        }
      }

      // Check assigned_to
      if (assigned_to && currentOpp.assigned_to !== assigned_to) {
        editsToInsert.push({
          opportunity_ghl_id: ghl_id,
          field_name: 'assigned_to',
          old_value: currentOpp.assigned_to || null,
          new_value: assigned_to,
          edited_by: edited_by || null,
          location_id: effectiveLocationId,
        });
      }

      // Insert all edits
      if (editsToInsert.length > 0) {
        console.log(`Tracking ${editsToInsert.length} field edits for opportunity ${ghl_id}`);
        const { error: editError } = await supabase
          .from('opportunity_edits')
          .insert(editsToInsert);
        
        if (editError) {
          console.error('Error inserting edits:', editError);
        }
      }
    }

    // AUTO-CREATE PROJECT WHEN OPPORTUNITY IS MARKED AS WON
    if (status === 'won' && currentOpp?.status !== 'won') {
      console.log(`Opportunity ${ghl_id} marked as won - creating project...`);
      
      // Check if project already exists for this opportunity
      const { data: existingProject } = await supabase
        .from('projects')
        .select('id')
        .eq('opportunity_id', ghl_id)
        .single();
      
      if (!existingProject) {
        // Fetch opportunity details
        const { data: opportunity } = await supabase
          .from('opportunities')
          .select('*, contacts:contact_id(*)')
          .eq('ghl_id', ghl_id)
          .single();
        
        if (opportunity) {
          // Fetch contact details if available
          let contact = null;
          if (opportunity.contact_id) {
            const { data: contactData } = await supabase
              .from('contacts')
              .select('*')
              .eq('ghl_id', opportunity.contact_id)
              .single();
            contact = contactData;
          }
          
          // Create the project
          const projectData = {
            opportunity_id: ghl_id,
            contact_id: opportunity.contact_id,
            location_id: effectiveLocationId,
            project_name: opportunity.name || `Project from ${contact?.contact_name || 'Unknown'}`,
            project_status: 'New Job',
            customer_first_name: contact?.first_name || null,
            customer_last_name: contact?.last_name || null,
            customer_email: contact?.email || null,
            cell_phone: contact?.phone || null,
            lead_source: contact?.source || null,
            primary_salesperson: opportunity.assigned_to || null,
            estimated_cost: opportunity.monetary_value || 0,
          };
          
          const { data: newProject, error: projectError } = await supabase
            .from('projects')
            .insert(projectData)
            .select()
            .single();
          
          if (projectError) {
            console.error('Error creating project:', projectError);
          } else {
            console.log(`Project created successfully: ${newProject.id} (Project #${newProject.project_number})`);
          }
        }
      } else {
        console.log(`Project already exists for opportunity ${ghl_id}`);
      }
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
