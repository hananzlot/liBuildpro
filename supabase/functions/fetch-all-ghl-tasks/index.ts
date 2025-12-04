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
    
    if (!ghlApiKey || !supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
    const batchSize = 5; // Smaller batches to avoid rate limits

    for (let i = 0; i < (contacts?.length || 0); i += batchSize) {
      const batch = contacts!.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (contact) => {
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
            return tasks
              .filter((t: any) => !t.completed)
              .map((t: any) => ({ ...t, contactId: contact.ghl_id }));
          }
          return [];
        } catch (err) {
          console.error(`Error fetching tasks for contact ${contact.ghl_id}:`, err);
          return [];
        }
      });

      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(tasks => allTasks.push(...tasks));
      
      // Longer delay between batches to respect GHL rate limits
      if (i + batchSize < (contacts?.length || 0)) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`Found ${allTasks.length} incomplete tasks across all contacts`);

    return new Response(
      JSON.stringify({ success: true, tasks: allTasks }),
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
