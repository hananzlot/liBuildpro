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
    const ghlApiKey = Deno.env.get('GHL_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!ghlApiKey) {
      throw new Error('Missing GHL_API_KEY');
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase credentials');
    }

    const { 
      title, 
      body, 
      dueDate, 
      assignedTo, 
      contactId, 
      supabaseTaskId 
    } = await req.json();

    if (!title) {
      throw new Error('Missing title');
    }

    if (!contactId) {
      throw new Error('Missing contactId');
    }

    console.log(`Creating GHL task: title=${title}, contactId=${contactId}, assignedTo=${assignedTo}, dueDate=${dueDate}`);

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

    // Update Supabase task with GHL ID if we have both IDs
    if (supabaseTaskId && ghlTaskId) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      const { error: supabaseError } = await supabase
        .from('tasks')
        .update({ ghl_id: ghlTaskId })
        .eq('id', supabaseTaskId);

      if (supabaseError) {
        console.error('Supabase update error:', supabaseError);
        // Don't throw - GHL task is created, just log the error
      } else {
        console.log(`Updated Supabase task ${supabaseTaskId} with GHL ID ${ghlTaskId}`);
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
