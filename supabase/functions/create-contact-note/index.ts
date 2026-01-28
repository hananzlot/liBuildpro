import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate a local-only ID for notes
function generateLocalNoteId(): string {
  return `local_note_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contactId, body, enteredBy, locationId, companyId } = await req.json();
    
    if (!contactId) {
      console.error('Missing contactId parameter');
      return new Response(
        JSON.stringify({ error: 'contactId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!body || body.trim() === '') {
      console.error('Missing body parameter');
      return new Response(
        JSON.stringify({ error: 'Note body is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // If locationId or companyId not provided, look them up from the contact
    let effectiveLocationId = locationId;
    let effectiveCompanyId = companyId;
    
    if (!effectiveLocationId || !effectiveCompanyId) {
      const { data: contactData } = await supabase
        .from('contacts')
        .select('location_id, company_id')
        .eq('ghl_id', contactId)
        .single();
      
      if (!effectiveLocationId) {
        effectiveLocationId = contactData?.location_id || 'local';
      }
      if (!effectiveCompanyId) {
        effectiveCompanyId = contactData?.company_id;
      }
    }

    // Always create notes locally - no GHL sync
    console.log('Creating local note for contact:', contactId);
    
    const localNoteId = generateLocalNoteId();
    
    const { data: newNote, error: insertError } = await supabase
      .from('contact_notes')
      .insert({
        ghl_id: localNoteId,
        contact_id: contactId,
        location_id: effectiveLocationId,
        body: body,
        ghl_date_added: new Date().toISOString(),
        entered_by: enteredBy || null,
        provider: 'local',
        company_id: effectiveCompanyId || null,
      })
      .select()
      .single();
    
    if (insertError) {
      console.error('Failed to create note:', insertError);
      return new Response(
        JSON.stringify({ error: `Failed to create note: ${insertError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Note created successfully:', newNote.id);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        note: newNote,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error creating note:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
