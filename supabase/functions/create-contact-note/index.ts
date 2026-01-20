import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getGHLCredentials } from "../_shared/ghl-credentials.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // If locationId not provided, look it up from the contact
    let effectiveLocationId = locationId;
    if (!effectiveLocationId) {
      const { data: contactData } = await supabase
        .from('contacts')
        .select('location_id')
        .eq('ghl_id', contactId)
        .single();
      
      effectiveLocationId = contactData?.location_id;
    }

    if (!effectiveLocationId) {
      throw new Error('Could not determine location_id for contact');
    }

    // Check if this is a local contact (no GHL sync needed)
    if (contactId.startsWith('local_')) {
      console.log('Creating local note for local contact:', contactId);
      
      const localNoteId = `local_note_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
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
          company_id: companyId || null,
        })
        .select()
        .single();
      
      if (insertError) {
        return new Response(
          JSON.stringify({ error: `Failed to create local note: ${insertError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          note: newNote,
          localOnlyMode: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get GHL credentials from vault
    const credentials = await getGHLCredentials(supabase, effectiveLocationId);

    console.log(`Creating note for contact: ${contactId} (location: ${effectiveLocationId})`);

    // Create note in GHL
    const response = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}/notes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${credentials.apiKey}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`GHL API error: ${response.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ error: `GHL API error: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await response.json();
    console.log(`Note created successfully:`, result);

    // Save to Supabase for caching
    if (result.note) {
      const note = result.note;
      await supabase.from('contact_notes').upsert({
        ghl_id: note.id,
        contact_id: contactId,
        body: note.body,
        user_id: note.userId || null,
        location_id: effectiveLocationId,
        ghl_date_added: note.dateAdded ? new Date(note.dateAdded).toISOString() : new Date().toISOString(),
        entered_by: enteredBy || null,
        company_id: companyId || null,
      }, { onConflict: 'ghl_id' });
      
      console.log('Note saved to Supabase');
    }

    return new Response(
      JSON.stringify({ success: true, note: result.note }),
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
