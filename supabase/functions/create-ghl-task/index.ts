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

// Generate a local-only ID for records not synced to GHL
function generateLocalId(prefix: string): string {
  return `local_${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
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

    const { 
      title, 
      body, 
      dueDate, 
      assignedTo, 
      contactId,
      locationId,
      enteredBy,
      companyId,
    } = await req.json();

    if (!title) {
      throw new Error('Missing title');
    }

    if (!contactId) {
      throw new Error('Missing contactId');
    }

    // If locationId not provided, look it up from the contact
    let effectiveLocationId = locationId;
    if (!effectiveLocationId) {
      const { data: contactData } = await supabase
        .from('contacts')
        .select('location_id')
        .eq('ghl_id', contactId)
        .single();
      
      effectiveLocationId = contactData?.location_id || Deno.env.get('GHL_LOCATION_ID') || 'local';
    }

    const ghlApiKey = getGHLApiKey(effectiveLocationId);

    // If no GHL credentials, create task locally only
    if (!ghlApiKey) {
      console.log('No GHL credentials configured, creating local task only (local-only mode)');
      
      const localTaskId = generateLocalId('task');
      
      const { data: newTask, error: insertError } = await supabase
        .from('ghl_tasks')
        .insert({
          ghl_id: localTaskId,
          contact_id: contactId,
          location_id: effectiveLocationId,
          title,
          body: body || null,
          due_date: dueDate || null,
          assigned_to: assignedTo || null,
          completed: false,
          entered_by: enteredBy || null,
          provider: 'local',
          company_id: companyId || null,
        })
        .select()
        .single();
      
      if (insertError) {
        return new Response(
          JSON.stringify({ error: `Failed to create local task: ${insertError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          task: newTask,
          localOnlyMode: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Creating GHL task (location: ${effectiveLocationId}): title=${title}, contactId=${contactId}, assignedTo=${assignedTo}, dueDate=${dueDate}`);

    // Build the GHL task payload - contactId goes in URL, not body
    const ghlPayload: Record<string, string | boolean> = {
      title,
      completed: false,
    };

    if (body) {
      ghlPayload.body = body;
    }

    if (dueDate) {
      ghlPayload.dueDate = dueDate;
    }

    if (assignedTo) {
      ghlPayload.assignedTo = assignedTo;
    }

    // Create task in GHL
    const ghlResponse = await fetch('https://services.leadconnectorhq.com/contacts/' + contactId + '/tasks', {
      method: 'POST',
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
    console.log('GHL task created successfully:', ghlData);

    // Extract the GHL task ID from response
    const ghlTaskId = ghlData.task?.id || ghlData.id;

    // Insert into ghl_tasks table
    if (ghlTaskId) {
      const { error: supabaseError } = await supabase
        .from('ghl_tasks')
        .insert({
          ghl_id: ghlTaskId,
          title: title,
          body: body || null,
          due_date: dueDate || null,
          assigned_to: assignedTo || null,
          contact_id: contactId,
          location_id: effectiveLocationId,
          completed: false,
          entered_by: enteredBy || null,
          company_id: companyId || null,
        });

      if (supabaseError) {
        console.error('Supabase insert error:', supabaseError);
        // Don't throw - GHL task is created, just log the error
      } else {
        console.log(`Inserted task into ghl_tasks with GHL ID ${ghlTaskId}`);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      ghl_task_id: ghlTaskId,
      ghl_data: ghlData 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error creating GHL task:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
