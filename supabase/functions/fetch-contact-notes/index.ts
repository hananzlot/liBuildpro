import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(url, options);
    if (response.status === 429) {
      const waitTime = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
      console.log(`Rate limited (429), waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      continue;
    }
    return response;
  }
  throw lastError || new Error('Max retries exceeded');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contact_id } = await req.json();

    if (!contact_id) {
      return new Response(
        JSON.stringify({ error: 'contact_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const ghlApiKey = Deno.env.get('GHL_API_KEY');
    const locationId = Deno.env.get('GHL_LOCATION_ID');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!ghlApiKey || !locationId) {
      throw new Error('Missing GHL_API_KEY or GHL_LOCATION_ID');
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase credentials');
    }

    console.log(`Fetching notes for contact: ${contact_id}`);

    // Fetch notes from GHL with retry logic
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

    // Upsert notes to Supabase
    if (notes.length > 0) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const notesToUpsert = notes.map((note: any) => ({
        ghl_id: note.id,
        contact_id: contact_id,
        body: note.body || null,
        user_id: note.userId || null,
        ghl_date_added: note.dateAdded || note.createdAt || null,
        location_id: locationId,
      }));

      const { error: upsertError } = await supabase
        .from('contact_notes')
        .upsert(notesToUpsert, { onConflict: 'ghl_id' });

      if (upsertError) {
        console.error('Notes upsert error:', upsertError);
      }
    }

    // Return notes with user info
    return new Response(
      JSON.stringify({ 
        notes: notes.map((note: any) => ({
          id: note.id,
          body: note.body,
          userId: note.userId,
          dateAdded: note.dateAdded || note.createdAt,
        })),
        count: notes.length
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
