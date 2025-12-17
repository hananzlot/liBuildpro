import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to get the correct GHL API key based on location_id
function getGHLApiKey(locationId: string): string {
  const location1Id = Deno.env.get('GHL_LOCATION_ID');
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

// Fetch with retry and exponential backoff for rate limiting
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(url, options);
    
    if (response.status === 429) {
      // Rate limited - wait with exponential backoff
      const waitTime = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
      console.log(`Rate limited (429), waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      continue;
    }
    
    return response;
  }
  
  // Return a mock 429 response if all retries failed
  return new Response(JSON.stringify({ statusCode: 429, message: "Rate limit exceeded after retries" }), {
    status: 429,
    headers: { 'Content-Type': 'application/json' }
  });
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contact_id, location_id } = await req.json();
    
    if (!contact_id) {
      return new Response(
        JSON.stringify({ error: 'contact_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // If location_id not provided, look it up from the contact
    let effectiveLocationId = location_id;
    if (!effectiveLocationId) {
      const { data: contactData } = await supabase
        .from('contacts')
        .select('location_id')
        .eq('ghl_id', contact_id)
        .single();
      
      effectiveLocationId = contactData?.location_id || Deno.env.get('GHL_LOCATION_ID');
    }

    const ghlApiKey = getGHLApiKey(effectiveLocationId);

    // Fetch tasks from GHL for this contact with retry
    console.log(`Fetching GHL tasks for contact: ${contact_id} (location: ${effectiveLocationId})`);
    
    const tasksResponse = await fetchWithRetry(
      `https://services.leadconnectorhq.com/contacts/${contact_id}/tasks`,
      {
        headers: {
          'Authorization': `Bearer ${ghlApiKey}`,
          'Version': '2021-07-28',
          'Accept': 'application/json'
        }
      }
    );

    // If rate limited, return success with 0 updates (use cached data)
    if (tasksResponse.status === 429) {
      console.log('GHL rate limited, skipping sync - using cached tasks');
      return new Response(
        JSON.stringify({ 
          success: true, 
          ghl_tasks_count: 0,
          updated_count: 0,
          cached: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!tasksResponse.ok) {
      const errorText = await tasksResponse.text();
      console.error('GHL Tasks API Error:', errorText);
      // Return success with cached flag instead of error
      return new Response(
        JSON.stringify({ 
          success: true, 
          ghl_tasks_count: 0,
          updated_count: 0,
          cached: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tasksData = await tasksResponse.json();
    const ghlTasks = tasksData.tasks || [];
    
    console.log(`Found ${ghlTasks.length} tasks in GHL for contact ${contact_id}`);

    // Get existing tasks from Supabase for this contact that have GHL IDs
    const { data: existingTasks, error: fetchError } = await supabase
      .from('tasks')
      .select('id, ghl_id, status')
      .eq('contact_id', contact_id)
      .not('ghl_id', 'is', null);

    if (fetchError) {
      console.error('Error fetching existing tasks:', fetchError);
      throw fetchError;
    }

    // Create a map of GHL task ID to GHL task data
    const ghlTaskMap = new Map();
    for (const task of ghlTasks) {
      ghlTaskMap.set(task.id, task);
    }

    // Update Supabase tasks based on GHL status
    let updatedCount = 0;
    for (const existingTask of existingTasks || []) {
      const ghlTask = ghlTaskMap.get(existingTask.ghl_id);
      if (ghlTask) {
        const newStatus = ghlTask.completed ? 'completed' : 'pending';
        if (existingTask.status !== newStatus) {
          console.log(`Updating task ${existingTask.id}: ${existingTask.status} -> ${newStatus}`);
          
          const { error: updateError } = await supabase
            .from('tasks')
            .update({ status: newStatus })
            .eq('id', existingTask.id);
          
          if (updateError) {
            console.error(`Error updating task ${existingTask.id}:`, updateError);
          } else {
            updatedCount++;
          }
        }
      }
    }

    console.log(`Synced ${updatedCount} task status changes from GHL`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        ghl_tasks_count: ghlTasks.length,
        updated_count: updatedCount 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in sync-ghl-tasks:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
