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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { contactId, taskId, title, body, dueDate, assignedTo, completed, locationId } = await req.json();

    if (!contactId) {
      throw new Error('Missing contactId');
    }

    if (!taskId) {
      throw new Error('Missing taskId (GHL task ID)');
    }

    // If locationId not provided, look it up from the task or contact
    let effectiveLocationId = locationId;
    if (!effectiveLocationId) {
      const { data: taskData } = await supabase
        .from('ghl_tasks')
        .select('location_id')
        .eq('ghl_id', taskId)
        .single();
      
      effectiveLocationId = taskData?.location_id || Deno.env.get('GHL_LOCATION_ID') || 'local';
    }

    const ghlApiKey = getGHLApiKey(effectiveLocationId);

    // Build the update payload - only include fields that are provided
    const updatePayload: Record<string, any> = {};
    if (title !== undefined) updatePayload.title = title;
    if (body !== undefined) updatePayload.body = body;
    if (dueDate !== undefined) updatePayload.due_date = dueDate;
    if (assignedTo !== undefined) updatePayload.assigned_to = assignedTo;
    if (completed !== undefined) updatePayload.completed = completed;

    // If no GHL credentials or local task, update locally only
    const isLocalTask = taskId.startsWith('local_');
    if (!ghlApiKey || isLocalTask) {
      console.log(`Updating task locally only (local-only mode or local task): taskId=${taskId}`);
      
      const { data: updatedTask, error: updateError } = await supabase
        .from('ghl_tasks')
        .update(updatePayload)
        .eq('ghl_id', taskId)
        .select()
        .single();
      
      if (updateError) {
        return new Response(
          JSON.stringify({ error: `Failed to update local task: ${updateError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          task: updatedTask,
          localOnlyMode: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Updating GHL task (location: ${effectiveLocationId}): taskId=${taskId}, contactId=${contactId}, title=${title}, dueDate=${dueDate}`);

    // Build the GHL update payload
    const ghlPayload: Record<string, string | boolean> = {};
    if (title !== undefined) ghlPayload.title = title;
    if (body !== undefined) ghlPayload.body = body;
    if (dueDate !== undefined) ghlPayload.dueDate = dueDate;
    if (assignedTo !== undefined) ghlPayload.assignedTo = assignedTo;
    if (completed !== undefined) ghlPayload.completed = completed;

    // Update task in GHL
    const ghlResponse = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}/tasks/${taskId}`, {
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
    console.log('GHL task updated successfully:', ghlData);

    return new Response(JSON.stringify({ 
      success: true,
      ghl_data: ghlData 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error updating GHL task:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
