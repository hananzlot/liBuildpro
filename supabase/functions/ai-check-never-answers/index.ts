import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Step 1: Use a raw SQL query to efficiently join and filter:
    // - Opportunities with status = 'open'
    // - That have appointments with status 'showed' in the past
    // - That have more than 4 notes OR more than 4 tasks
    const { data: candidates, error: queryError } = await supabase.rpc('get_never_answers_candidates');

    // If RPC doesn't exist, fall back to manual query approach
    if (queryError && queryError.message.includes('function')) {
      console.log('RPC not available, using manual query approach...');
      
      // Get all open opportunities with their contact info
      const { data: openOpps, error: oppError } = await supabase
        .from('opportunities')
        .select('id, ghl_id, name, contact_id, location_id, stage_name, pipeline_id, pipeline_stage_id')
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

      // Get all contact IDs
      const contactIds = openOpps.map(o => o.contact_id).filter(Boolean);

      // Get contacts that have showed appointments in the past (batch query)
      const { data: showedAppointments, error: apptError } = await supabase
        .from('appointments')
        .select('contact_id')
        .in('contact_id', contactIds)
        .eq('appointment_status', 'showed')
        .lt('start_time', new Date().toISOString());

      if (apptError) {
        console.error('Error fetching showed appointments:', apptError);
        throw apptError;
      }

      // Get unique contact IDs with showed appointments
      const contactsWithShowedAppts = new Set(showedAppointments?.map(a => a.contact_id) || []);
      console.log(`${contactsWithShowedAppts.size} contacts have showed appointments in the past`);

      // Filter opportunities to only those with showed appointments
      const oppsWithShowedAppts = openOpps.filter(o => contactsWithShowedAppts.has(o.contact_id));

      if (oppsWithShowedAppts.length === 0) {
        return new Response(
          JSON.stringify({ success: true, message: 'No open opportunities with showed appointments found', processed: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`${oppsWithShowedAppts.length} open opportunities have showed appointments`);

      // Get remaining contact IDs
      const filteredContactIds = oppsWithShowedAppts.map(o => o.contact_id);

      // Count notes per contact (batch query)
      const { data: noteCounts, error: noteCountError } = await supabase
        .from('contact_notes')
        .select('contact_id')
        .in('contact_id', filteredContactIds);

      if (noteCountError) {
        console.error('Error counting notes:', noteCountError);
        throw noteCountError;
      }

      // Count tasks per contact (batch query)
      const { data: taskCounts, error: taskCountError } = await supabase
        .from('ghl_tasks')
        .select('contact_id')
        .in('contact_id', filteredContactIds);

      if (taskCountError) {
        console.error('Error counting tasks:', taskCountError);
        throw taskCountError;
      }

      // Build count maps
      const noteCountMap: Record<string, number> = {};
      const taskCountMap: Record<string, number> = {};

      (noteCounts || []).forEach(n => {
        noteCountMap[n.contact_id] = (noteCountMap[n.contact_id] || 0) + 1;
      });

      (taskCounts || []).forEach(t => {
        taskCountMap[t.contact_id] = (taskCountMap[t.contact_id] || 0) + 1;
      });

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

      // Fetch notes and tasks for qualifying opportunities
      const qualifyingContactIds = qualifyingOpps.map(o => o.contact_id);

      const [notesResult, tasksResult] = await Promise.all([
        supabase
          .from('contact_notes')
          .select('contact_id, body, ghl_date_added')
          .in('contact_id', qualifyingContactIds)
          .order('ghl_date_added', { ascending: false }),
        supabase
          .from('ghl_tasks')
          .select('contact_id, title, body, completed')
          .in('contact_id', qualifyingContactIds)
          .order('created_at', { ascending: false })
      ]);

      if (notesResult.error) {
        console.error('Error fetching notes:', notesResult.error);
        throw notesResult.error;
      }

      if (tasksResult.error) {
        console.error('Error fetching tasks:', tasksResult.error);
        throw tasksResult.error;
      }

      // Group notes and tasks by contact_id
      const notesByContact: Record<string, any[]> = {};
      const tasksByContact: Record<string, any[]> = {};

      (notesResult.data || []).forEach(n => {
        if (!notesByContact[n.contact_id]) notesByContact[n.contact_id] = [];
        if (notesByContact[n.contact_id].length < 20) {
          notesByContact[n.contact_id].push(n);
        }
      });

      (tasksResult.data || []).forEach(t => {
        if (!tasksByContact[t.contact_id]) tasksByContact[t.contact_id] = [];
        if (tasksByContact[t.contact_id].length < 20) {
          tasksByContact[t.contact_id].push(t);
        }
      });

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

      // Step 2: Use AI to analyze each opportunity's notes and tasks
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

          // Step 3: If AI determines customer never answers with high/medium confidence, update the opportunity
          if (analysis.neverAnswers && (analysis.confidence === 'high' || analysis.confidence === 'medium')) {
            console.log(`Opportunity ${opp.name} identified as Never Answers (${analysis.confidence} confidence): ${analysis.reason}`);

            // Find the "Never Answered" stage in the pipeline
            const { data: pipeline, error: pipelineError } = await supabase
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

            // Step 4: Create a note explaining the automatic change
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
    }

    // Handle case where RPC worked
    console.log(`Found ${candidates?.length || 0} candidate opportunities from RPC`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'RPC executed',
        candidates: candidates?.length || 0
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
