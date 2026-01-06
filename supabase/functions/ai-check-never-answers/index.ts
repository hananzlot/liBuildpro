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

    // Step 1: Find all opportunities with status "open"
    const { data: openOpportunities, error: oppError } = await supabase
      .from('opportunities')
      .select('id, ghl_id, name, contact_id, location_id, stage_name, pipeline_id, pipeline_stage_id')
      .eq('status', 'open');

    if (oppError) {
      console.error('Error fetching open opportunities:', oppError);
      throw oppError;
    }

    console.log(`Found ${openOpportunities?.length || 0} open opportunities`);

    if (!openOpportunities || openOpportunities.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No open opportunities found', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const opportunitiesToProcess: any[] = [];

    // Step 2: For each opportunity, check if it has a showed appointment in the past
    for (const opp of openOpportunities) {
      if (!opp.contact_id) continue;

      // Check for showed appointments
      const { data: showedAppointments, error: apptError } = await supabase
        .from('appointments')
        .select('id, start_time, appointment_status')
        .eq('contact_id', opp.contact_id)
        .eq('appointment_status', 'showed')
        .lt('start_time', new Date().toISOString());

      if (apptError) {
        console.error(`Error fetching appointments for contact ${opp.contact_id}:`, apptError);
        continue;
      }

      if (!showedAppointments || showedAppointments.length === 0) {
        continue;
      }

      // Step 3: Check if opportunity has more than 4 tasks OR 4 notes
      const { count: taskCount, error: taskError } = await supabase
        .from('ghl_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('contact_id', opp.contact_id);

      const { count: noteCount, error: noteError } = await supabase
        .from('contact_notes')
        .select('id', { count: 'exact', head: true })
        .eq('contact_id', opp.contact_id);

      if (taskError || noteError) {
        console.error(`Error fetching tasks/notes for contact ${opp.contact_id}:`, taskError || noteError);
        continue;
      }

      const totalTasks = taskCount || 0;
      const totalNotes = noteCount || 0;

      console.log(`Opportunity ${opp.name}: ${totalTasks} tasks, ${totalNotes} notes`);

      // Must have more than 4 tasks OR more than 4 notes
      if (totalTasks <= 4 && totalNotes <= 4) {
        continue;
      }

      // Fetch the actual notes for AI analysis
      const { data: notes, error: notesDetailError } = await supabase
        .from('contact_notes')
        .select('body, ghl_date_added')
        .eq('contact_id', opp.contact_id)
        .order('ghl_date_added', { ascending: false })
        .limit(20);

      if (notesDetailError) {
        console.error(`Error fetching note details for contact ${opp.contact_id}:`, notesDetailError);
        continue;
      }

      // Fetch tasks for additional context
      const { data: tasks, error: tasksDetailError } = await supabase
        .from('ghl_tasks')
        .select('title, body, completed')
        .eq('contact_id', opp.contact_id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (tasksDetailError) {
        console.error(`Error fetching task details for contact ${opp.contact_id}:`, tasksDetailError);
        continue;
      }

      opportunitiesToProcess.push({
        ...opp,
        notes: notes || [],
        tasks: tasks || [],
        taskCount: totalTasks,
        noteCount: totalNotes,
        showedAppointments: showedAppointments.length
      });
    }

    console.log(`${opportunitiesToProcess.length} opportunities meet criteria for AI analysis`);

    if (opportunitiesToProcess.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No opportunities meet criteria for AI analysis', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const processedOpportunities: any[] = [];

    // Step 4: Use AI to analyze each opportunity's notes
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
            ],
            temperature: 0.1
          })
        });

        if (!aiResponse.ok) {
          console.error(`AI API error for opportunity ${opp.name}:`, await aiResponse.text());
          continue;
        }

        const aiResult = await aiResponse.json();
        const content = aiResult.choices?.[0]?.message?.content || '';
        
        console.log(`AI response for ${opp.name}:`, content);

        // Parse the AI response
        let analysis;
        try {
          // Extract JSON from the response (in case there's extra text)
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

        // Step 5: If AI determines customer never answers with high/medium confidence, update the opportunity
        if (analysis.neverAnswers && (analysis.confidence === 'high' || analysis.confidence === 'medium')) {
          console.log(`Opportunity ${opp.name} identified as Never Answers (${analysis.confidence} confidence): ${analysis.reason}`);

          // Find the "Never Answered" stage in the pipeline
          const { data: pipeline, error: pipelineError } = await supabase
            .from('ghl_pipelines')
            .select('stages')
            .eq('ghl_id', opp.pipeline_id)
            .single();

          let neverAnsweredStageId = null;
          if (pipeline && pipeline.stages) {
            const stages = pipeline.stages as any[];
            const neverAnsweredStage = stages.find((s: any) => 
              s.name?.toLowerCase().includes('never answer') || 
              s.name?.toLowerCase().includes('never answered')
            );
            if (neverAnsweredStage) {
              neverAnsweredStageId = neverAnsweredStage.id;
            }
          }

          // Update the opportunity status to abandoned and stage to Never Answered
          const updateData: any = {
            status: 'abandoned'
          };

          if (neverAnsweredStageId) {
            updateData.pipeline_stage_id = neverAnsweredStageId;
            updateData.stage_name = 'Never Answered';
          }

          const { error: updateError } = await supabase
            .from('opportunities')
            .update(updateData)
            .eq('ghl_id', opp.ghl_id);

          if (updateError) {
            console.error(`Error updating opportunity ${opp.name}:`, updateError);
            continue;
          }

          // Step 6: Create a note explaining the automatic change
          const noteBody = `[SYSTEM - AI Analysis] This opportunity was automatically moved to ${neverAnsweredStageId ? 'Never Answered stage and ' : ''}Abandoned status based on AI analysis of contact history.

Reason: ${analysis.reason}
Confidence: ${analysis.confidence}
Analysis details: Customer had ${opp.showedAppointments} showed appointment(s), ${opp.taskCount} tasks, and ${opp.noteCount} notes. AI determined the customer pattern indicates they never answer or are unreachable.`;

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
            stageUpdated: !!neverAnsweredStageId
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
