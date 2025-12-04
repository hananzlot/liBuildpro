import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ghlApiKey = Deno.env.get('GHL_API_KEY');
    const ghlLocationId = Deno.env.get('GHL_LOCATION_ID');
    
    if (!ghlApiKey || !ghlLocationId) {
      throw new Error('Missing GHL API credentials');
    }

    console.log('Fetching all tasks from GHL...');
    
    // Fetch tasks from GHL - get incomplete tasks
    const tasksResponse = await fetch(
      `https://services.leadconnectorhq.com/contacts/tasks?locationId=${ghlLocationId}&completed=false&limit=100`,
      {
        headers: {
          'Authorization': `Bearer ${ghlApiKey}`,
          'Version': '2021-07-28',
          'Accept': 'application/json'
        }
      }
    );

    if (!tasksResponse.ok) {
      const errorText = await tasksResponse.text();
      console.error('GHL Tasks API Error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch tasks from GHL', details: errorText }),
        { status: tasksResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tasksData = await tasksResponse.json();
    const ghlTasks = tasksData.tasks || [];
    
    console.log(`Found ${ghlTasks.length} incomplete tasks in GHL`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        tasks: ghlTasks
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in fetch-all-ghl-tasks:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
