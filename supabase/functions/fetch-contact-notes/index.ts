import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to get the correct GHL API key based on location_id
// Returns null if GHL credentials are not configured (local-only mode)
function getGHLApiKey(locationId: string): string | null {
  const location1Id = Deno.env.get('GHL_LOCATION_ID');
  const location2Id = Deno.env.get('GHL_LOCATION_ID_2');
  
  if (locationId === location2Id) {
    const apiKey2 = Deno.env.get('GHL_API_KEY_2');
    if (apiKey2) return apiKey2;
  }
  
  // Default to primary API key
  const apiKey1 = Deno.env.get('GHL_API_KEY');
  if (!apiKey1) return null; // Return null for local-only mode
  return apiKey1;
}

// Fetch with retry and exponential backoff for rate limiting
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(url, options);
    
    if (response.status === 429) {
      // Rate limited - wait with exponential backoff
      const waitTime = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
      console.log(`Rate limited (429), waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      continue;
    }
    
    return response;
  }
  
  // Return a mock 429 response if all retries failed
  return new Response(JSON.stringify({ statusCode: 429, message: "Rate limit exceeded after retries" }), {
    status: 429,
    headers: { 'Content-Type': 'application/json' }
  });
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
      
      effectiveLocationId = contactData?.location_id || Deno.env.get('GHL_LOCATION_ID') || 'local';
    }

    const ghlApiKey = getGHLApiKey(effectiveLocationId);

    // If no GHL credentials, return cached notes from Supabase only
    if (!ghlApiKey) {
      console.log('No GHL credentials configured, returning cached notes only (local-only mode)');
      
      const { data: cachedNotes } = await supabase
        .from('contact_notes')
        .select('*')
        .eq('contact_id', contact_id)
        .order('ghl_date_added', { ascending: false });
      
      return new Response(
        JSON.stringify({ 
          notes: cachedNotes || [],
          localOnlyMode: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching notes for contact: ${contact_id} (location: ${effectiveLocationId})`);

    // Fetch notes from GHL with retry
    const response = await fetchWithRetry(
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

    let notes: any[] = [];
    let ghlFetchSuccessful = false;

    if (response.ok) {
      const data = await response.json();
      notes = data.notes || [];
      ghlFetchSuccessful = true;
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
    } else if (response.status === 429) {
      console.log('GHL rate limited, returning cached notes from Supabase');
    } else {
      const errorText = await response.text();
      console.error('GHL Notes API Error:', errorText);
    }

    // Fetch notes from Supabase with entered_by and profile info (always do this)
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
        count: notesWithCreator.length,
        cached: !ghlFetchSuccessful
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
