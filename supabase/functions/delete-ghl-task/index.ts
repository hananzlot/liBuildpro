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

    const { contactId, taskId } = await req.json();

    if (!contactId) {
      throw new Error('Missing contactId');
    }

    if (!taskId) {
      throw new Error('Missing taskId');
    }

    // Always delete tasks locally - no GHL sync
    console.log('Deleting task locally:', { taskId, contactId });
    
    const { error: deleteError } = await supabase
      .from('ghl_tasks')
      .delete()
      .eq('ghl_id', taskId);
    
    if (deleteError) {
      console.error('Failed to delete task:', deleteError);
      return new Response(
        JSON.stringify({ error: `Failed to delete task: ${deleteError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Task deleted successfully');
    
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Task deleted successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error deleting task:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
