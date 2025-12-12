import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to get the correct GHL API key based on location_id
function getGHLApiKey(locationId: string): string {
  const location1Id = Deno.env.get('GHL_LOCATION_ID');
  const location2Id = Deno.env.get('GHL_LOCATION_ID_2');
  
  if (locationId === location2Id) {
    const apiKey2 = Deno.env.get('GHL_API_KEY_2');
    if (apiKey2) return apiKey2;
  }
  
  // Default to primary API key
  const apiKey1 = Deno.env.get('GHL_API_KEY');
  if (!apiKey1) throw new Error('Missing GHL_API_KEY');
  return apiKey1;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contact_id, location_id } = await req.json();

    if (!contact_id) {
      return new Response(
        JSON.stringify({ error: 'contact_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // If location_id not provided, look it up from the contact
    let effectiveLocationId = location_id;
    if (!effectiveLocationId) {
      const { data: contactData } = await supabase
        .from('contacts')
        .select('location_id')
        .eq('ghl_id', contact_id)
        .single();
      
      effectiveLocationId = contactData?.location_id || Deno.env.get('GHL_LOCATION_ID');
    }

    const ghlApiKey = getGHLApiKey(effectiveLocationId);

    console.log(`Fetching notes for contact: ${contact_id} (location: ${effectiveLocationId})`);

    // Fetch notes from GHL
    const response = await fetch(
      `https://services.leadconnectorhq.com/contacts/${contact_id}/notes`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${ghlApiKey}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GHL Notes API Error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch notes from GHL', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const notes = data.notes || [];

    console.log(`Found ${notes.length} notes for contact ${contact_id}`);

    // Upsert notes to Supabase (preserving entered_by if already set)
    if (notes.length > 0) {
      // Get existing notes to preserve entered_by
      const { data: existingNotes } = await supabase
        .from('contact_notes')
        .select('ghl_id, entered_by')
        .in('ghl_id', notes.map((n: any) => n.id));

      const existingEnteredByMap = new Map(
        (existingNotes || []).map((n: any) => [n.ghl_id, n.entered_by])
      );

      const notesToUpsert = notes.map((note: any) => ({
        ghl_id: note.id,
        contact_id: contact_id,
        body: note.body || null,
        user_id: note.userId || null,
        ghl_date_added: note.dateAdded || note.createdAt || null,
        location_id: effectiveLocationId,
        // Preserve existing entered_by if set
        entered_by: existingEnteredByMap.get(note.id) || null,
      }));

      const { error: upsertError } = await supabase
        .from('contact_notes')
        .upsert(notesToUpsert, { onConflict: 'ghl_id' });

      if (upsertError) {
        console.error('Notes upsert error:', upsertError);
      }
    }

    // Fetch notes from Supabase with entered_by and profile info
    const { data: supabaseNotes } = await supabase
      .from('contact_notes')
      .select(`
        ghl_id,
        body,
        user_id,
        ghl_date_added,
        entered_by,
        profiles:entered_by (
          id,
          full_name,
          email
        )
      `)
      .eq('contact_id', contact_id)
      .order('ghl_date_added', { ascending: false });

    // Return notes with both GHL userId and app entered_by info
    const notesWithCreator = (supabaseNotes || []).map((note: any) => ({
      id: note.ghl_id,
      body: note.body,
      userId: note.user_id,
      dateAdded: note.ghl_date_added,
      enteredBy: note.entered_by,
      enteredByName: note.profiles?.full_name || null,
    }));

    return new Response(
      JSON.stringify({ 
        notes: notesWithCreator,
        count: notesWithCreator.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in fetch-contact-notes:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
