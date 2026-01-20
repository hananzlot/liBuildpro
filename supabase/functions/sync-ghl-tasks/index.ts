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

    // Skip sync for local-only contacts
    if (contact_id.startsWith('local_')) {
      console.log(`Skipping GHL sync for local-only contact: ${contact_id}`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          ghl_tasks_count: 0,
          updated_count: 0,
          localOnlyMode: true,
          reason: 'local_contact'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
      
      effectiveLocationId = contactData?.location_id || 'local';
    }

    const ghlApiKey = await getGHLApiKey(supabase, effectiveLocationId);

    // If no GHL credentials, return cached tasks from Supabase only
    if (!ghlApiKey) {
      console.log('No GHL credentials configured, returning cached tasks only (local-only mode)');
      
      const { data: cachedTasks } = await supabase
        .from('ghl_tasks')
        .select('*')
        .eq('contact_id', contact_id)
        .order('due_date', { ascending: true });
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          tasks: cachedTasks || [],
          localOnlyMode: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
