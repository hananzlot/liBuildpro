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
    .select("id, api_key_encrypted")
    .eq("provider", "ghl")
    .eq("location_id", locationId)
    .eq("is_active", true)
    .single();

  if (error || !integration || !integration.api_key_encrypted) {
    console.error(`GHL integration not configured for location ${locationId}`);
    return null;
  }

  const { data: apiKey, error: vaultError } = await supabase.rpc(
    "get_ghl_api_key_encrypted",
    { p_integration_id: integration.id }
  );

  if (vaultError || !apiKey) {
    console.error(`Failed to retrieve GHL API key: ${vaultError?.message}`);
    return null;
  }

  return apiKey;
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

    // If locationId or companyId not provided, look them up from the contact
    let effectiveLocationId = locationId;
    let effectiveCompanyId = companyId;
    
    if (!effectiveLocationId || !effectiveCompanyId) {
      const { data: contactData } = await supabase
        .from('contacts')
        .select('location_id, company_id')
        .eq('ghl_id', contactId)
        .single();
      
      if (!effectiveLocationId) {
        effectiveLocationId = contactData?.location_id || 'local';
      }
      if (!effectiveCompanyId) {
        effectiveCompanyId = contactData?.company_id;
      }
    }

    const ghlApiKey = await getGHLApiKey(supabase, effectiveLocationId);

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
          company_id: effectiveCompanyId || null,
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
          company_id: effectiveCompanyId || null,
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
