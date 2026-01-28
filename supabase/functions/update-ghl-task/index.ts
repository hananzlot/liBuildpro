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
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { contactId, taskId, title, body, dueDate, assignedTo, completed, editedBy } = await req.json();

    if (!contactId) {
      throw new Error('Missing contactId');
    }

    if (!taskId) {
      throw new Error('Missing taskId');
    }

    // Build the update payload - only include fields that are provided
    const updatePayload: Record<string, unknown> = {};
    if (title !== undefined) updatePayload.title = title;
    if (body !== undefined) updatePayload.body = body;
    if (dueDate !== undefined) updatePayload.due_date = dueDate;
    if (assignedTo !== undefined) updatePayload.assigned_to = assignedTo;
    if (completed !== undefined) updatePayload.completed = completed;
    if (editedBy !== undefined) {
      updatePayload.edited_by = editedBy;
      updatePayload.edited_at = new Date().toISOString();
    }

    // Always update tasks locally - no GHL sync
    console.log('Updating task locally:', { taskId, ...updatePayload });
    
    const { data: updatedTask, error: updateError } = await supabase
      .from('ghl_tasks')
      .update(updatePayload)
      .eq('ghl_id', taskId)
      .select()
      .single();
    
    if (updateError) {
      console.error('Failed to update task:', updateError);
      return new Response(
        JSON.stringify({ error: `Failed to update task: ${updateError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Task updated successfully:', updatedTask?.id);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        task: updatedTask,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error updating task:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
