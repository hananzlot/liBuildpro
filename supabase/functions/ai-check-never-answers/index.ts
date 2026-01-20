import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to batch array into chunks
function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting AI check for Never Answers opportunities...');

    // Step 1: Get all open opportunities with their contact info
    const { data: openOpps, error: oppError } = await supabase
      .from('opportunities')
      .select('id, ghl_id, name, contact_id, location_id, stage_name, pipeline_id, pipeline_stage_id, company_id')
      .eq('status', 'open')
      .not('contact_id', 'is', null);

    if (oppError) {
      console.error('Error fetching open opportunities:', oppError);
      throw oppError;
    }

    if (!openOpps || openOpps.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No open opportunities found', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${openOpps.length} open opportunities with contacts`);

    // Get all unique contact IDs
    const contactIds = [...new Set(openOpps.map(o => o.contact_id).filter(Boolean))] as string[];
    console.log(`Unique contacts: ${contactIds.length}`);

    // Step 2: Batch query for contacts that have showed appointments in the past
    const BATCH_SIZE = 50; // Smaller batch to avoid URL length issues
    const contactBatches = chunk(contactIds, BATCH_SIZE);
    
    const contactsWithShowedAppts = new Set<string>();
    
    for (const batch of contactBatches) {
      const { data: showedAppointments, error: apptError } = await supabase
        .from('appointments')
        .select('contact_id')
        .in('contact_id', batch)
        .eq('appointment_status', 'showed')
        .lt('start_time', new Date().toISOString());

      if (apptError) {
        console.error('Error fetching showed appointments batch:', apptError);
        continue;
      }

      (showedAppointments || []).forEach(a => contactsWithShowedAppts.add(a.contact_id));
    }

    console.log(`${contactsWithShowedAppts.size} contacts have showed appointments in the past`);

    // Filter opportunities to only those with showed appointments
    const oppsWithShowedAppts = openOpps.filter(o => contactsWithShowedAppts.has(o.contact_id!));

    if (oppsWithShowedAppts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No open opportunities with showed appointments found', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`${oppsWithShowedAppts.length} open opportunities have showed appointments`);

    // Get remaining contact IDs
    const filteredContactIds = [...new Set(oppsWithShowedAppts.map(o => o.contact_id))] as string[];
    const filteredBatches = chunk(filteredContactIds, BATCH_SIZE);

    // Step 3: Count notes and tasks per contact (batch queries)
    const noteCountMap: Record<string, number> = {};
    const taskCountMap: Record<string, number> = {};

    for (const batch of filteredBatches) {
      // Count notes
      const { data: notes, error: noteError } = await supabase
        .from('contact_notes')
        .select('contact_id')
        .in('contact_id', batch);

      if (!noteError && notes) {
        notes.forEach(n => {
          noteCountMap[n.contact_id] = (noteCountMap[n.contact_id] || 0) + 1;
        });
      }

      // Count tasks
      const { data: tasks, error: taskError } = await supabase
        .from('ghl_tasks')
        .select('contact_id')
        .in('contact_id', batch);

      if (!taskError && tasks) {
        tasks.forEach(t => {
          taskCountMap[t.contact_id] = (taskCountMap[t.contact_id] || 0) + 1;
        });
      }
    }

    // Filter to only opportunities with >4 notes OR >4 tasks
    const qualifyingOpps = oppsWithShowedAppts.filter(o => {
      const notes = noteCountMap[o.contact_id!] || 0;
      const tasks = taskCountMap[o.contact_id!] || 0;
      return notes > 4 || tasks > 4;
    });

    console.log(`${qualifyingOpps.length} opportunities have >4 notes or >4 tasks`);

    if (qualifyingOpps.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No opportunities meet all criteria (open, showed appointment, >4 notes/tasks)', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 4: Fetch notes and tasks for qualifying opportunities
    const qualifyingContactIds = [...new Set(qualifyingOpps.map(o => o.contact_id))] as string[];
    const qualifyingBatches = chunk(qualifyingContactIds, BATCH_SIZE);

    const notesByContact: Record<string, any[]> = {};
    const tasksByContact: Record<string, any[]> = {};

    for (const batch of qualifyingBatches) {
      const { data: notes } = await supabase
        .from('contact_notes')
        .select('contact_id, body, ghl_date_added')
        .in('contact_id', batch)
        .order('ghl_date_added', { ascending: false });

      (notes || []).forEach(n => {
        if (!notesByContact[n.contact_id]) notesByContact[n.contact_id] = [];
        if (notesByContact[n.contact_id].length < 20) {
          notesByContact[n.contact_id].push(n);
        }
      });

      const { data: tasks } = await supabase
        .from('ghl_tasks')
        .select('contact_id, title, body, completed')
        .in('contact_id', batch)
        .order('created_at', { ascending: false });

      (tasks || []).forEach(t => {
        if (!tasksByContact[t.contact_id]) tasksByContact[t.contact_id] = [];
        if (tasksByContact[t.contact_id].length < 20) {
          tasksByContact[t.contact_id].push(t);
        }
      });
    }

    // Build final list for AI analysis
    const opportunitiesToProcess = qualifyingOpps.map(opp => ({
      ...opp,
      notes: notesByContact[opp.contact_id!] || [],
      tasks: tasksByContact[opp.contact_id!] || [],
      taskCount: taskCountMap[opp.contact_id!] || 0,
      noteCount: noteCountMap[opp.contact_id!] || 0
    }));

    console.log(`${opportunitiesToProcess.length} opportunities ready for AI analysis`);

    const processedOpportunities: any[] = [];

    // Step 5: Use AI to analyze each opportunity's notes and tasks
    for (const opp of opportunitiesToProcess) {
      const notesText = opp.notes.map((n: any) => n.body || '').filter((b: string) => b.trim()).join('\n---\n');
      const tasksText = opp.tasks.map((t: any) => `${t.title}: ${t.body || ''} (${t.completed ? 'completed' : 'pending'})`).join('\n');

      const prompt = `Analyze the following notes and tasks for a sales opportunity. Determine if the customer appears to be unreachable or never answers calls/messages.

Look for patterns such as:
- Multiple failed contact attempts
- "No answer", "voicemail", "didn't pick up", "couldn't reach"
- "Left message", "no response", "no callback"
- Multiple follow-up tasks that remain incomplete
- Repeated attempts to schedule without success

NOTES:
${notesText || 'No notes available'}

TASKS:
${tasksText || 'No tasks available'}

Based on this information, does the customer appear to be someone who never answers or is unreachable?
Respond with ONLY a JSON object in this exact format:
{"neverAnswers": true/false, "confidence": "high/medium/low", "reason": "brief explanation"}`;

      try {
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${lovableApiKey}`
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: 'You are an assistant that analyzes sales notes and tasks to determine if a customer is unreachable. Respond ONLY with valid JSON.' },
              { role: 'user', content: prompt }
            ]
          })
        });

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          console.error(`AI API error for opportunity ${opp.name}:`, errorText);
          if (aiResponse.status === 429) {
            console.log('Rate limited, stopping processing');
            break;
          }
          continue;
        }

        const aiResult = await aiResponse.json();
        const content = aiResult.choices?.[0]?.message?.content || '';
        
        console.log(`AI response for ${opp.name}:`, content);

        // Parse the AI response
        let analysis;
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            analysis = JSON.parse(jsonMatch[0]);
          } else {
            console.error(`Could not parse AI response for ${opp.name}:`, content);
            continue;
          }
        } catch (parseError) {
          console.error(`JSON parse error for ${opp.name}:`, parseError);
          continue;
        }

        // Step 6: If AI determines customer never answers with high/medium confidence, update the opportunity
        if (analysis.neverAnswers && (analysis.confidence === 'high' || analysis.confidence === 'medium')) {
          console.log(`Opportunity ${opp.name} identified as Never Answers (${analysis.confidence} confidence): ${analysis.reason}`);

          // Check if we already created an AI note for this contact in the last 24 hours
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          const { data: existingNote } = await supabase
            .from('contact_notes')
            .select('id')
            .eq('contact_id', opp.contact_id)
            .ilike('body', '%[SYSTEM - AI Analysis]%')
            .gte('created_at', oneDayAgo)
            .limit(1);

          if (existingNote && existingNote.length > 0) {
            console.log(`Skipping ${opp.name} - AI note already created in last 24 hours`);
            continue;
          }

          // Find the "Never Answered" stage in the pipeline
          const { data: pipeline } = await supabase
            .from('ghl_pipelines')
            .select('stages')
            .eq('ghl_id', opp.pipeline_id)
            .maybeSingle();

          let neverAnsweredStageId = null;
          let neverAnsweredStageName = 'Never Answered';
          if (pipeline && pipeline.stages) {
            const stages = pipeline.stages as any[];
            const neverAnsweredStage = stages.find((s: any) => 
              s.name?.toLowerCase().includes('never answer') || 
              s.name?.toLowerCase().includes('never answered')
            );
            if (neverAnsweredStage) {
              neverAnsweredStageId = neverAnsweredStage.id;
              neverAnsweredStageName = neverAnsweredStage.name;
            }
          }

          // Update the opportunity status to abandoned and stage to Never Answered
          const updateData: any = {
            status: 'abandoned'
          };

          if (neverAnsweredStageId) {
            updateData.pipeline_stage_id = neverAnsweredStageId;
            updateData.stage_name = neverAnsweredStageName;
          }

          const { error: updateError } = await supabase
            .from('opportunities')
            .update(updateData)
            .eq('ghl_id', opp.ghl_id);

          if (updateError) {
            console.error(`Error updating opportunity ${opp.name}:`, updateError);
            continue;
          }

          // Step 7: Create a note explaining the automatic change
          const noteBody = `[SYSTEM - AI Analysis] This opportunity was automatically moved to ${neverAnsweredStageId ? `"${neverAnsweredStageName}" stage and ` : ''}"Abandoned" status based on AI analysis of contact history.

Criteria met:
- Opportunity was in Open status
- Customer had a past appointment with "Showed" status
- Contact has ${opp.noteCount} notes and ${opp.taskCount} tasks (threshold: >4)

AI Analysis Result:
- Never Answers: Yes
- Confidence: ${analysis.confidence}
- Reason: ${analysis.reason}`;

          const { error: noteError } = await supabase
            .from('contact_notes')
            .insert({
              ghl_id: `ai-never-answers-${opp.ghl_id}-${Date.now()}`,
              contact_id: opp.contact_id,
              location_id: opp.location_id,
              body: noteBody,
              ghl_date_added: new Date().toISOString(),
              company_id: opp.company_id || null,
            });

          if (noteError) {
            console.error(`Error creating note for opportunity ${opp.name}:`, noteError);
          }

          processedOpportunities.push({
            id: opp.ghl_id,
            name: opp.name,
            reason: analysis.reason,
            confidence: analysis.confidence,
            stageUpdated: !!neverAnsweredStageId,
            noteCount: opp.noteCount,
            taskCount: opp.taskCount
          });
        }
      } catch (aiError) {
        console.error(`Error processing opportunity ${opp.name} with AI:`, aiError);
        continue;
      }
    }

    console.log(`Successfully processed ${processedOpportunities.length} opportunities`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `AI analyzed ${opportunitiesToProcess.length} opportunities, updated ${processedOpportunities.length} to Never Answered/Abandoned`,
        analyzed: opportunitiesToProcess.length,
        updated: processedOpportunities.length,
        opportunities: processedOpportunities
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in AI check for Never Answers:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
