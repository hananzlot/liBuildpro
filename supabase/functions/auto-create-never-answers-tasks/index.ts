import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PRIMARY_LOCATION_ID = "pVeFrqvtYWNIPRIi0Fmr";
const NEVER_ANSWERS_STAGE_ID = "45fa6ec0-80bf-4d42-a986-030c26511d42";
const VANESSA_PIPELINE_ID = "6bUqC98F6LCM9zuUitXw";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const ghlApiKey = Deno.env.get('GHL_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey || !ghlApiKey) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const now = new Date();
    
    console.log('Starting auto-create-never-answers-tasks job...');

    // 1. Get all opportunities in "Never Answers" stage
    const { data: opportunities, error: oppError } = await supabase
      .from('opportunities')
      .select('ghl_id, name, contact_id, pipeline_stage_id, stage_name')
      .eq('location_id', PRIMARY_LOCATION_ID)
      .eq('pipeline_stage_id', NEVER_ANSWERS_STAGE_ID)
      .eq('status', 'open');

    if (oppError) {
      console.error('Error fetching opportunities:', oppError);
      throw oppError;
    }

    console.log(`Found ${opportunities?.length || 0} opportunities in Never Answers stage`);

    if (!opportunities || opportunities.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No opportunities in Never Answers stage',
        tasksCreated: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Get all future tasks to check which contacts already have them
    const { data: futureTasks, error: tasksError } = await supabase
      .from('ghl_tasks')
      .select('contact_id, due_date, completed')
      .eq('location_id', PRIMARY_LOCATION_ID)
      .eq('completed', false)
      .gte('due_date', now.toISOString());

    if (tasksError) {
      console.error('Error fetching tasks:', tasksError);
    }

    const contactsWithFutureTasks = new Set(
      (futureTasks || []).map(t => t.contact_id)
    );

    console.log(`${contactsWithFutureTasks.size} contacts already have future tasks`);

    // 3. Get contact notes for all relevant contacts
    const contactIds = opportunities.map(o => o.contact_id).filter(Boolean);
    
    const { data: allNotes, error: notesError } = await supabase
      .from('contact_notes')
      .select('contact_id, ghl_date_added')
      .in('contact_id', contactIds)
      .order('ghl_date_added', { ascending: false });

    if (notesError) {
      console.error('Error fetching notes:', notesError);
    }

    // Build map of contact_id -> latest note date
    const latestNoteByContact = new Map<string, Date>();
    (allNotes || []).forEach(note => {
      if (note.contact_id && note.ghl_date_added) {
        if (!latestNoteByContact.has(note.contact_id)) {
          latestNoteByContact.set(note.contact_id, new Date(note.ghl_date_added));
        }
      }
    });

    console.log(`Found notes for ${latestNoteByContact.size} contacts`);

    // 4. Filter opportunities that need tasks created
    const oppsNeedingTasks = opportunities.filter(opp => {
      if (!opp.contact_id) return false;
      if (contactsWithFutureTasks.has(opp.contact_id)) return false;
      if (!latestNoteByContact.has(opp.contact_id)) return false; // Must have at least one note
      return true;
    });

    console.log(`${oppsNeedingTasks.length} opportunities need tasks created`);

    let tasksCreated = 0;
    const errors: string[] = [];

    // 5. Create tasks for each opportunity
    for (const opp of oppsNeedingTasks) {
      try {
        const lastNoteDate = latestNoteByContact.get(opp.contact_id!);
        if (!lastNoteDate) continue;

        // Calculate due date: 8 weeks from last note date
        const dueDate = new Date(lastNoteDate);
        dueDate.setDate(dueDate.getDate() + 56); // 8 weeks = 56 days

        // If due date is in the past, set it to 1 week from now
        if (dueDate < now) {
          dueDate.setTime(now.getTime());
          dueDate.setDate(dueDate.getDate() + 7);
        }

        // Set time to 9 AM PST (17:00 UTC)
        dueDate.setUTCHours(17, 0, 0, 0);

        const taskTitle = `Follow up - Never Answers (Auto)`;
        const taskBody = `Auto-generated follow-up task. Last note was on ${lastNoteDate.toLocaleDateString()}.`;

        console.log(`Creating task for ${opp.name} (${opp.contact_id}), due: ${dueDate.toISOString()}`);

        // Create task in GHL
        const ghlResponse = await fetch(
          `https://services.leadconnectorhq.com/contacts/${opp.contact_id}/tasks`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${ghlApiKey}`,
              'Content-Type': 'application/json',
              'Version': '2021-07-28',
            },
            body: JSON.stringify({
              title: taskTitle,
              body: taskBody,
              dueDate: dueDate.toISOString(),
              completed: false,
            }),
          }
        );

        if (!ghlResponse.ok) {
          const errorText = await ghlResponse.text();
          console.error(`GHL error for ${opp.name}:`, errorText);
          errors.push(`${opp.name}: ${errorText}`);
          continue;
        }

        const ghlData = await ghlResponse.json();
        const createdTask = ghlData.task;

        console.log(`GHL task created: ${createdTask.id}`);

        // Save to Supabase
        const { error: insertError } = await supabase
          .from('ghl_tasks')
          .upsert({
            ghl_id: createdTask.id,
            contact_id: opp.contact_id,
            location_id: PRIMARY_LOCATION_ID,
            title: taskTitle,
            body: taskBody,
            due_date: dueDate.toISOString(),
            completed: false,
            assigned_to: createdTask.assignedTo || null,
            last_synced_at: new Date().toISOString(),
          }, { onConflict: 'ghl_id' });

        if (insertError) {
          console.error(`Supabase insert error for ${opp.name}:`, insertError);
          errors.push(`${opp.name}: Supabase insert failed`);
        } else {
          tasksCreated++;
          console.log(`Task saved to Supabase for ${opp.name}`);
        }

        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`Error creating task for ${opp.name}:`, err);
        errors.push(`${opp.name}: ${errorMsg}`);
      }
    }

    console.log(`Job complete. Created ${tasksCreated} tasks. ${errors.length} errors.`);

    return new Response(JSON.stringify({ 
      success: true, 
      tasksCreated,
      totalOpportunities: opportunities.length,
      oppsNeedingTasks: oppsNeedingTasks.length,
      errors: errors.length > 0 ? errors : undefined
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Error in auto-create-never-answers-tasks:', error);
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
