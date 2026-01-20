import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAllGHLCredentials } from "../_shared/ghl-credentials.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Get all GHL credentials from vault
    let allCredentials: { apiKey: string; locationId: string }[] = [];
    try {
      allCredentials = await getAllGHLCredentials(supabase);
    } catch (error) {
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

    const allTasks: any[] = [];
    const batchSize = 5;

    // Process each location
    for (const credentials of allCredentials) {
      console.log(`Fetching tasks for location: ${credentials.locationId}`);
      
      // Fetch contacts for this location (excluding local-only contacts) - include company_id
      const { data: contacts, error: contactsError } = await supabase
        .from('contacts')
        .select('ghl_id, company_id')
        .eq('location_id', credentials.locationId)
        .not('ghl_id', 'like', 'local_%');

      if (contactsError) {
        console.error(`Failed to fetch contacts for location ${credentials.locationId}: ${contactsError.message}`);
        continue;
      }
      
      // Build a contact -> company_id map for later use
      const contactCompanyMap = new Map<string, string>();
      (contacts || []).forEach(c => {
        if (c.company_id) {
          contactCompanyMap.set(c.ghl_id, c.company_id);
        }
      });

      console.log(`Found ${contacts?.length || 0} contacts for location ${credentials.locationId}`);

      for (let i = 0; i < (contacts?.length || 0); i += batchSize) {
        const batch = contacts!.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (contact) => {
          try {
            const tasksResponse = await fetch(
              `https://services.leadconnectorhq.com/contacts/${contact.ghl_id}/tasks`,
              {
                headers: {
                  'Authorization': `Bearer ${credentials.apiKey}`,
                  'Version': '2021-07-28',
                  'Accept': 'application/json'
                }
              }
            );

            if (tasksResponse.ok) {
              const tasksData = await tasksResponse.json();
              const tasks = tasksData.tasks || [];
              return tasks.map((t: any) => ({ 
                ...t, 
                contactId: contact.ghl_id,
                locationId: credentials.locationId,
                companyId: contactCompanyMap.get(contact.ghl_id) || null
              }));
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
    }

    console.log(`Found ${allTasks.length} tasks from GHL, applying LOCAL WINS sync strategy...`);

    // LOCAL WINS STRATEGY: Fetch existing tasks and only fill null fields
    if (allTasks.length > 0) {
      // Fetch existing tasks to preserve local data
      const taskGhlIds = allTasks.map(t => t.id);
      const existingTasksMap = new Map<string, any>();
      
      for (let i = 0; i < taskGhlIds.length; i += 100) {
        const batchIds = taskGhlIds.slice(i, i + 100);
        const { data: existingTasks, error: fetchError } = await supabase
          .from('ghl_tasks')
          .select('*')
          .in('ghl_id', batchIds);
        
        if (fetchError) {
          console.error('Error fetching existing tasks for preservation:', fetchError);
        }
        
        (existingTasks || []).forEach((t: any) => {
          existingTasksMap.set(t.ghl_id, t);
        });
      }
      
      console.log(`Found ${existingTasksMap.size} existing tasks to preserve`);
      
      const tasksToUpsert = allTasks.map(t => {
        const existing = existingTasksMap.get(t.id);
        
        // If record exists locally, only fill null fields (LOCAL WINS)
        if (existing) {
          return {
            ghl_id: t.id,
            provider: existing.provider ?? 'ghl',
            external_id: existing.external_id ?? t.id,
            location_id: existing.location_id ?? t.locationId,
            contact_id: existing.contact_id ?? t.contactId,
            title: existing.title ?? t.title ?? 'Untitled Task',
            body: existing.body ?? t.body ?? null,
            assigned_to: existing.assigned_to ?? t.assignedTo ?? null,
            due_date: existing.due_date ?? t.dueDate ?? null,
            completed: existing.completed ?? t.completed ?? false,
            entered_by: existing.entered_by, // Always preserve
            edited_by: existing.edited_by, // Always preserve
            edited_at: existing.edited_at, // Always preserve
            company_id: existing.company_id ?? t.companyId, // Preserve or set from contact
            last_synced_at: new Date().toISOString(), // Always update sync timestamp
          };
        }
        
        // New record - use GHL data
        return {
          ghl_id: t.id,
          provider: 'ghl',
          external_id: t.id,
          location_id: t.locationId,
          contact_id: t.contactId,
          title: t.title || 'Untitled Task',
          body: t.body || null,
          assigned_to: t.assignedTo || null,
          due_date: t.dueDate || null,
          completed: t.completed || false,
          company_id: t.companyId || null, // Always set company_id from contact
          last_synced_at: new Date().toISOString(),
        };
      });

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
