import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate a local-only ID for records
function generateLocalId(): string {
  return `local_task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
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

    // Always create tasks locally - no GHL sync
    console.log('Creating local task:', { title, contactId, assignedTo, dueDate });
    
    const localTaskId = generateLocalId();
    
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
      console.error('Failed to create task:', insertError);
      return new Response(
        JSON.stringify({ error: `Failed to create task: ${insertError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Task created successfully:', newTask.id);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        task: newTask,
        ghl_task_id: localTaskId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error creating task:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
