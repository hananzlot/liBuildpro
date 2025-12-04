import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { contactId, body } = await req.json();
    
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

    const GHL_API_KEY = Deno.env.get('GHL_API_KEY');
    
    if (!GHL_API_KEY) {
      console.error('GHL_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'GHL API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Creating note for contact: ${contactId}`);

    // Create note in GHL
    const response = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}/notes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
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

    // Also save to Supabase for caching
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const locationId = Deno.env.get('GHL_LOCATION_ID')!;
    
    if (result.note) {
      const note = result.note;
      await supabase.from('contact_notes').upsert({
        ghl_id: note.id,
        contact_id: contactId,
        body: note.body,
        user_id: note.userId || null,
        location_id: locationId,
        ghl_date_added: note.dateAdded ? new Date(note.dateAdded).toISOString() : new Date().toISOString(),
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