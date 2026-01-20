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
    const ghlLocationId = Deno.env.get('GHL_LOCATION_ID');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // If GHL credentials are missing, return cached tasks from Supabase only
    if (!ghlApiKey || !ghlLocationId) {
      console.log('GHL credentials not configured - returning cached tasks only');
      
      const { data: cachedTasks, error: cacheError } = await supabase
        .from('ghl_tasks')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (cacheError) {
        console.error('Error fetching cached tasks:', cacheError);
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          count: cachedTasks?.length || 0,
          source: 'cache',
          message: 'GHL credentials not configured - returning cached tasks'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all contact GHL IDs from Supabase
    console.log('Fetching contacts from Supabase...');
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('ghl_id');

    if (contactsError) {
      throw new Error(`Failed to fetch contacts: ${contactsError.message}`);
    }

    console.log(`Found ${contacts?.length || 0} contacts, fetching tasks...`);

    const allTasks: any[] = [];
    const batchSize = 5;

    for (let i = 0; i < (contacts?.length || 0); i += batchSize) {
      const batch = contacts!.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (contact) => {
        // Skip local-only contacts
        if (contact.ghl_id?.startsWith('local_')) {
          return [];
        }
        
        try {
          const tasksResponse = await fetch(
            `https://services.leadconnectorhq.com/contacts/${contact.ghl_id}/tasks`,
            {
              headers: {
                'Authorization': `Bearer ${ghlApiKey}`,
                'Version': '2021-07-28',
                'Accept': 'application/json'
              }
            }
          );

          if (tasksResponse.ok) {
            const tasksData = await tasksResponse.json();
            const tasks = tasksData.tasks || [];
            return tasks.map((t: any) => ({ ...t, contactId: contact.ghl_id }));
          }
          return [];
        } catch (err) {
          console.error(`Error fetching tasks for contact ${contact.ghl_id}:`, err);
          return [];
        }
      });

      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(tasks => allTasks.push(...tasks));
      
      if (i + batchSize < (contacts?.length || 0)) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    console.log(`Found ${allTasks.length} tasks, saving to Supabase...`);

    // Upsert all tasks to Supabase
    if (allTasks.length > 0) {
      const tasksToUpsert = allTasks.map(t => ({
        ghl_id: t.id,
        provider: 'ghl',
        external_id: t.id,
        location_id: ghlLocationId,
        contact_id: t.contactId,
        title: t.title || 'Untitled Task',
        body: t.body || null,
        assigned_to: t.assignedTo || null,
        due_date: t.dueDate || null,
        completed: t.completed || false,
      }));

      for (let i = 0; i < tasksToUpsert.length; i += 100) {
        const batch = tasksToUpsert.slice(i, i + 100);
        const { error } = await supabase.from('ghl_tasks').upsert(batch, { onConflict: 'ghl_id' });
        if (error) console.error('Tasks upsert error:', error);
      }
    }

    return new Response(
      JSON.stringify({ success: true, count: allTasks.length, source: 'ghl' }),
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
