import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    if (!ghlApiKey) {
      throw new Error('Missing GHL_API_KEY');
    }

    const { contactId, taskId, title, body, dueDate, assignedTo, completed } = await req.json();

    if (!contactId) {
      throw new Error('Missing contactId');
    }

    if (!taskId) {
      throw new Error('Missing taskId (GHL task ID)');
    }

    console.log(`Updating GHL task: taskId=${taskId}, contactId=${contactId}, title=${title}, dueDate=${dueDate}`);

    // Build the update payload - only include fields that are provided
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
