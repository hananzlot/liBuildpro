import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getGHLCredentials } from "../_shared/ghl-credentials.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fetch with retry and exponential backoff for rate limiting
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
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

    // Skip GHL fetch for local-only contacts
    if (contact_id.startsWith('local_')) {
      console.log(`Returning cached notes for local-only contact: ${contact_id}`);
      
      const { data: cachedNotes } = await supabase
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
      
      const notesWithCreator = (cachedNotes || []).map((note: any) => ({
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
          localOnlyMode: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If location_id not provided, look it up from the contact (also get company_id for syncing)
    let effectiveLocationId = location_id;
    let contactCompanyId: string | null = null;
    
    if (!effectiveLocationId) {
      // Try looking up by ghl_id first
      const { data: contactData } = await supabase
        .from('contacts')
        .select('location_id, company_id')
        .eq('ghl_id', contact_id)
        .maybeSingle();
      
      effectiveLocationId = contactData?.location_id;
      contactCompanyId = contactData?.company_id;
      
      // If not found by ghl_id, try by UUID (internal id)
      if (!contactData) {
        const { data: contactByUuid } = await supabase
          .from('contacts')
          .select('location_id, company_id, ghl_id')
          .eq('id', contact_id)
          .maybeSingle();
        
        effectiveLocationId = contactByUuid?.location_id;
        contactCompanyId = contactByUuid?.company_id;
      }
    } else {
      // Still fetch company_id for syncing
      const { data: contactData } = await supabase
        .from('contacts')
        .select('company_id')
        .eq('ghl_id', contact_id)
        .maybeSingle();
      contactCompanyId = contactData?.company_id;
    }

    // If no location_id, return cached notes only (local-only mode)
    if (!effectiveLocationId) {
      console.log(`No location_id for contact ${contact_id}, returning cached notes only (local-only mode)`);
      
      const { data: cachedNotes } = await supabase
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
        .or(`contact_id.eq.${contact_id},contact_uuid.eq.${contact_id}`)
        .order('ghl_date_added', { ascending: false });
      
      const notesWithCreator = (cachedNotes || []).map((note: any) => ({
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
          localOnlyMode: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get GHL credentials from vault
    const credentials = await getGHLCredentials(supabase, effectiveLocationId);

    console.log(`Fetching notes for contact: ${contact_id} (location: ${effectiveLocationId})`);

    // Fetch notes from GHL with retry
    const response = await fetchWithRetry(
      `https://services.leadconnectorhq.com/contacts/${contact_id}/notes`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${credentials.apiKey}`,
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
      console.log(`Found ${notes.length} notes for contact ${contact_id}, applying LOCAL WINS sync strategy`);

      // LOCAL WINS STRATEGY: Only fill null fields, preserve all existing local data
      if (notes.length > 0) {
        // Fetch ALL existing note fields to preserve local data
        const { data: existingNotes } = await supabase
          .from('contact_notes')
          .select('*')
          .in('ghl_id', notes.map((n: any) => n.id));

        const existingNotesMap = new Map(
          (existingNotes || []).map((n: any) => [n.ghl_id, n])
        );
        
        console.log(`Found ${existingNotesMap.size} existing notes to preserve`);

        const notesToUpsert = notes.map((note: any) => {
          const existing = existingNotesMap.get(note.id);
          
          // If record exists locally, only fill null fields (LOCAL WINS)
          if (existing) {
            return {
              ghl_id: note.id,
              contact_id: existing.contact_id ?? contact_id,
              body: existing.body ?? note.body ?? null,
              user_id: existing.user_id ?? note.userId ?? null,
              ghl_date_added: existing.ghl_date_added ?? note.dateAdded ?? note.createdAt ?? null,
              location_id: existing.location_id ?? effectiveLocationId,
              entered_by: existing.entered_by, // Always preserve
              edited_by: existing.edited_by, // Always preserve
              edited_at: existing.edited_at, // Always preserve
              provider: existing.provider ?? 'ghl',
              external_id: existing.external_id ?? note.id,
              company_id: existing.company_id ?? contactCompanyId, // Preserve or set from contact
            };
          }
          
          // New record - use GHL data
          return {
            ghl_id: note.id,
            contact_id: contact_id,
            body: note.body || null,
            user_id: note.userId || null,
            ghl_date_added: note.dateAdded || note.createdAt || null,
            location_id: effectiveLocationId,
            provider: 'ghl',
            external_id: note.id,
            company_id: contactCompanyId, // Always set company_id from contact
          };
        });

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
