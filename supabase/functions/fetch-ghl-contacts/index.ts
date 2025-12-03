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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { limit = 100, syncToDb = true } = await req.json().catch(() => ({}));

    // Fetch all contacts with pagination and deduplication
    let allContacts: any[] = [];
    let startAfterId: string | undefined;
    let hasMore = true;
    const seenContactIds = new Set<string>();
    const seenStartAfterIds = new Set<string>();

    while (hasMore) {
      const params = new URLSearchParams({
        locationId,
        limit: '100',
      });

      if (startAfterId) params.append('startAfterId', startAfterId);

      console.log(`Fetching contacts batch, startAfterId: ${startAfterId || 'none'}`);

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
      const contacts = data.contacts || [];

      // Deduplicate contacts
      let newCount = 0;
      let duplicateCount = 0;

      for (const contact of contacts) {
        if (seenContactIds.has(contact.id)) {
          duplicateCount++;
        } else {
          seenContactIds.add(contact.id);
          allContacts.push(contact);
          newCount++;
        }
      }

      console.log(`Page results: ${newCount} new, ${duplicateCount} duplicates, total unique: ${allContacts.length}`);

      // Stop if entire page was duplicates
      if (newCount === 0 && contacts.length > 0) {
        console.log('Stopping: entire page was duplicates');
        hasMore = false;
        break;
      }

      // Check for startAfterId loop
      if (data.meta?.startAfterId) {
        if (seenStartAfterIds.has(data.meta.startAfterId)) {
          console.log('Stopping: startAfterId loop detected');
          hasMore = false;
          break;
        }
        seenStartAfterIds.add(data.meta.startAfterId);
        startAfterId = data.meta.startAfterId;
      } else {
        hasMore = false;
      }

      // Check if there are more contacts
      if (contacts.length < 100) {
        console.log('Stopping: received less than 100 contacts');
        hasMore = false;
      }

      // Safety limit to prevent infinite loops
      if (allContacts.length >= 10000) {
        console.log('Reached 10,000 contacts limit');
        hasMore = false;
      }
    }

    // Sync to database if requested
    if (syncToDb && allContacts.length > 0) {
      console.log(`Syncing ${allContacts.length} contacts to database...`);

      const contactsToUpsert = allContacts.map(c => ({
        ghl_id: c.id,
        location_id: c.locationId || locationId,
        contact_name: c.contactName || null,
        first_name: c.firstName || null,
        last_name: c.lastName || null,
        email: c.email || null,
        phone: c.phone || null,
        source: c.source || null,
        tags: c.tags || [],
        assigned_to: c.assignedTo || null,
        ghl_date_added: c.dateAdded || null,
        ghl_date_updated: c.dateUpdated || null,
        custom_fields: c.customFields || null,
        attributions: c.attributions || null,
      }));

      // Upsert in batches of 100
      for (let i = 0; i < contactsToUpsert.length; i += 100) {
        const batch = contactsToUpsert.slice(i, i + 100);
        const { error: upsertError } = await supabase
          .from('contacts')
          .upsert(batch, { onConflict: 'ghl_id' });

        if (upsertError) {
          console.error('Upsert error:', upsertError);
          throw new Error(`Failed to sync contacts: ${upsertError.message}`);
        }
        console.log(`Upserted batch ${Math.floor(i / 100) + 1}`);
      }

      console.log('Sync complete!');
    }

    return new Response(JSON.stringify({
      contacts: allContacts,
      meta: { total: allContacts.length, synced: syncToDb }
    }), {
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
