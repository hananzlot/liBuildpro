import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ghlApiKey = Deno.env.get('GHL_API_KEY');
    const locationId = Deno.env.get('GHL_LOCATION_ID');

    if (!ghlApiKey || !locationId) {
      throw new Error('Missing GHL_API_KEY or GHL_LOCATION_ID');
    }

    const { limit = 100, startAfter, startAfterId } = await req.json().catch(() => ({}));

    const params = new URLSearchParams({
      locationId,
      limit: String(limit),
    });

    if (startAfter) params.append('startAfter', startAfter);
    if (startAfterId) params.append('startAfterId', startAfterId);

    console.log(`Fetching contacts from GHL with limit: ${limit}`);

    const response = await fetch(
      `https://services.leadconnectorhq.com/contacts/?${params.toString()}`,
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
      console.error('GHL API Error:', errorText);
      throw new Error(`GHL API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`Fetched ${data.contacts?.length || 0} contacts`);

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching GHL contacts:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
