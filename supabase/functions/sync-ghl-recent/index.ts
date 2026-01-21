import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GHLIntegration {
  id: string;
  company_id: string;
  location_id: string;
  api_key_encrypted: string | null;
  name: string;
  is_primary: boolean;
  last_sync_at: string | null;
}

interface SyncResult {
  integrationId: string;
  companyId: string;
  locationId: string;
  name: string;
  opportunitiesSynced: number;
  contactsSynced: number;
  appointmentsSynced: number;
}

// Fetch opportunities from GHL API with date filter
async function fetchRecentOpportunities(
  ghlApiKey: string,
  locationId: string,
  sinceDate: Date
): Promise<any[]> {
  console.log(`Fetching opportunities since ${sinceDate.toISOString()}...`);
  const allOpportunities: any[] = [];
  const seenIds = new Set<string>();
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const params = new URLSearchParams({
      location_id: locationId,
      limit: '100',
      page: page.toString(),
    });

    const response = await fetch(`https://services.leadconnectorhq.com/opportunities/search?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ghlApiKey}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GHL Opportunities API Error:', errorText);
      break;
    }

    const data = await response.json();
    const opportunities = data.opportunities || [];

    let newInRangeCount = 0;
    for (const opp of opportunities) {
      if (seenIds.has(opp.id)) continue;
      seenIds.add(opp.id);
      
      // Filter by creation OR update date - include opportunities created or modified since sinceDate
      const oppCreatedAt = opp.createdAt ? new Date(opp.createdAt) : null;
      const oppUpdatedAt = opp.updatedAt ? new Date(opp.updatedAt) : null;
      
      // Include if created since sinceDate, updated since sinceDate, or if no dates available (new record)
      const isInRange = (oppCreatedAt && oppCreatedAt >= sinceDate) || 
                        (oppUpdatedAt && oppUpdatedAt >= sinceDate) ||
                        (!oppCreatedAt && !oppUpdatedAt);
      
      if (isInRange) {
        allOpportunities.push(opp);
        newInRangeCount++;
      }
    }

    console.log(`Page ${page}: ${opportunities.length} total, ${newInRangeCount} in date range`);

    // Stop if we've gone past our date range (opportunities are usually sorted by date desc)
    // or if we've hit the end
    if (opportunities.length < 100 || page >= 20) {
      hasMore = false;
    } else {
      page++;
    }
  }

  console.log(`Found ${allOpportunities.length} opportunities since ${sinceDate.toISOString()}`);
  return allOpportunities;
}

// Extract scope of work from Facebook campaign attribution
function extractScopeFromAttribution(attributions: any[] | null): string | null {
  if (!attributions || !Array.isArray(attributions)) return null;
  
  // Look for Facebook/Paid Social attribution with campaign info
  for (const attr of attributions) {
    // Check if this is from Facebook/Paid Social
    const isFacebookLead = attr.medium === 'facebook' || 
                           attr.adSource === 'facebook' ||
                           attr.utmSessionSource === 'Paid Social';
    
    if (isFacebookLead && attr.utmCampaign) {
      // Extract the product/service type from campaign name
      // Campaign format: "Product Name | Price | Date" or "[Lead Gen] Product Name"
      const campaign = attr.utmCampaign as string;
      
      // Remove [Lead Gen] prefix if present
      let cleanCampaign = campaign.replace(/^\[Lead Gen\]\s*/i, '');
      cleanCampaign = cleanCampaign.replace(/^\d{4}\/\d{2}\/\d{2}\s*\[Lead Gen\]\s*/i, '');
      
      // Extract the product name (before the first | or the whole thing)
      const parts = cleanCampaign.split('|');
      const productName = parts[0].trim();
      
      if (productName) {
        console.log(`Extracted scope "${productName}" from campaign: ${campaign}`);
        return productName;
      }
    }
  }
  
  return null;
}

// Fetch a single contact by ID
async function fetchContact(ghlApiKey: string, contactId: string): Promise<any | null> {
  try {
    const response = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ghlApiKey}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch contact ${contactId}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.contact || null;
  } catch (err) {
    console.error(`Error fetching contact ${contactId}:`, err);
    return null;
  }
}

// Fetch recent appointments
async function fetchRecentAppointments(
  ghlApiKey: string,
  locationId: string,
  sinceDate: Date
): Promise<any[]> {
  console.log(`Fetching appointments since ${sinceDate.toISOString()}...`);
  
  // First get all calendars
  const calendarsResponse = await fetch(`https://services.leadconnectorhq.com/calendars/?locationId=${locationId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${ghlApiKey}`,
      'Version': '2021-07-28',
      'Content-Type': 'application/json',
    },
  });

  if (!calendarsResponse.ok) {
    console.error('Failed to fetch calendars');
    return [];
  }

  const calendarsData = await calendarsResponse.json();
  const calendars = calendarsData.calendars || [];

  if (calendars.length === 0) {
    return [];
  }

  const allAppointments: any[] = [];
  const seenIds = new Set<string>();
  
  // Fetch appointments from sinceDate to 90 days in future
  const startTime = sinceDate.getTime();
  const endTime = Date.now() + (90 * 24 * 60 * 60 * 1000);

  for (const calendar of calendars) {
    const params = new URLSearchParams({
      locationId,
      calendarId: calendar.id,
      startTime: startTime.toString(),
      endTime: endTime.toString(),
    });

    const response = await fetch(`https://services.leadconnectorhq.com/calendars/events?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ghlApiKey}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch events for calendar ${calendar.id}`);
      continue;
    }

    const data = await response.json();
    const events = data.events || [];
    
    for (const event of events) {
      if (!seenIds.has(event.id)) {
        seenIds.add(event.id);
        allAppointments.push(event);
      }
    }
  }

  console.log(`Found ${allAppointments.length} appointments`);
  return allAppointments;
}

// Fetch pipelines for name resolution
async function fetchPipelines(ghlApiKey: string, locationId: string): Promise<{ pipelineNames: Map<string, string>; stageNames: Map<string, string> }> {
  const pipelineNames = new Map<string, string>();
  const stageNames = new Map<string, string>();

  try {
    const response = await fetch(`https://services.leadconnectorhq.com/opportunities/pipelines?locationId=${locationId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ghlApiKey}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      for (const pipeline of data.pipelines || []) {
        pipelineNames.set(pipeline.id, pipeline.name);
        for (const stage of pipeline.stages || []) {
          stageNames.set(stage.id, stage.name);
        }
      }
    }
  } catch (err) {
    console.error('Error fetching pipelines:', err);
  }

  return { pipelineNames, stageNames };
}

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

    console.log('Starting lightweight GHL sync (recent opportunities only)...');
    
    // Get all active GHL integrations
    const { data: integrations, error: intError } = await supabase
      .from('company_integrations')
      .select('id, company_id, location_id, api_key_encrypted, name, is_primary, last_sync_at')
      .eq('provider', 'ghl')
      .eq('is_active', true);

    if (intError) {
      throw new Error(`Error fetching integrations: ${intError.message}`);
    }

    if (!integrations || integrations.length === 0) {
      throw new Error('No active GHL integrations found');
    }

    console.log(`Found ${integrations.length} active GHL integrations`);

    const results: SyncResult[] = [];
    const syncTimestamp = new Date().toISOString();

    for (const integration of integrations as GHLIntegration[]) {
      if (!integration.api_key_encrypted) {
        console.log(`Integration ${integration.id} has no API key, skipping`);
        continue;
      }

      // Get decrypted API key
      const { data: apiKey, error: vaultError } = await supabase
        .rpc('get_ghl_api_key_encrypted', { p_integration_id: integration.id });

      if (vaultError || !apiKey) {
        console.error(`Error retrieving API key for integration ${integration.id}:`, vaultError);
        continue;
      }

      console.log(`\n=== Processing ${integration.name || integration.id} (Company: ${integration.company_id}) ===`);

      // Calculate since date: last sync - 24 hours buffer, or 48 hours if no last sync
      let sinceDate: Date;
      if (integration.last_sync_at) {
        sinceDate = new Date(new Date(integration.last_sync_at).getTime() - (24 * 60 * 60 * 1000));
      } else {
        sinceDate = new Date(Date.now() - (48 * 60 * 60 * 1000));
      }

      // Fetch pipeline names for resolution
      const { pipelineNames, stageNames } = await fetchPipelines(apiKey, integration.location_id);

      // Fetch recent opportunities
      const opportunities = await fetchRecentOpportunities(apiKey, integration.location_id, sinceDate);

      // Collect unique contact IDs that we might need to fetch
      const contactIds = new Set<string>();
      for (const opp of opportunities) {
        if (opp.contactId) {
          contactIds.add(opp.contactId);
        }
      }

      // Check which contacts already exist in DB
      const existingContactIds = new Set<string>();
      if (contactIds.size > 0) {
        const contactIdArray = Array.from(contactIds);
        for (let i = 0; i < contactIdArray.length; i += 100) {
          const batch = contactIdArray.slice(i, i + 100);
          const { data: existingContacts } = await supabase
            .from('contacts')
            .select('ghl_id')
            .in('ghl_id', batch);
          
          (existingContacts || []).forEach((c: any) => existingContactIds.add(c.ghl_id));
        }
      }

      // Fetch missing contacts from GHL
      const missingContactIds = Array.from(contactIds).filter(id => !existingContactIds.has(id));
      console.log(`Need to fetch ${missingContactIds.length} missing contacts`);

      // Map to store contact attributions for scope extraction
      const contactAttributions = new Map<string, any[]>();

      const contactsToUpsert: any[] = [];
      for (const contactId of missingContactIds) {
        const contact = await fetchContact(apiKey, contactId);
        if (contact) {
          contactsToUpsert.push({
            ghl_id: contact.id,
            company_id: integration.company_id,
            provider: 'ghl',
            external_id: contact.id,
            location_id: contact.locationId || integration.location_id,
            contact_name: contact.contactName || null,
            first_name: contact.firstName || null,
            last_name: contact.lastName || null,
            email: contact.email || null,
            phone: contact.phone || null,
            source: contact.source || null,
            tags: contact.tags || [],
            assigned_to: contact.assignedTo || null,
            ghl_date_added: contact.dateAdded || null,
            ghl_date_updated: contact.dateUpdated || null,
            custom_fields: contact.customFields || null,
            attributions: contact.attributions || null,
            last_synced_at: syncTimestamp,
          });
          // Store attributions for scope extraction
          if (contact.attributions) {
            contactAttributions.set(contact.id, contact.attributions);
          }
        }
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Upsert contacts
      if (contactsToUpsert.length > 0) {
        for (let i = 0; i < contactsToUpsert.length; i += 50) {
          const batch = contactsToUpsert.slice(i, i + 50);
          const { error } = await supabase.from('contacts').upsert(batch, { onConflict: 'ghl_id' });
          if (error) console.error('Contacts upsert error:', error);
        }
        console.log(`Upserted ${contactsToUpsert.length} contacts`);
      }

      // Fetch attributions for existing contacts that we didn't just fetch
      const existingContactsToQuery = Array.from(contactIds).filter(id => existingContactIds.has(id));
      if (existingContactsToQuery.length > 0) {
        for (let i = 0; i < existingContactsToQuery.length; i += 100) {
          const batch = existingContactsToQuery.slice(i, i + 100);
          const { data: existingContacts } = await supabase
            .from('contacts')
            .select('ghl_id, attributions')
            .in('ghl_id', batch);
          
          (existingContacts || []).forEach((c: any) => {
            if (c.attributions) {
              contactAttributions.set(c.ghl_id, c.attributions);
            }
          });
        }
      }

      // Prepare opportunities for upsert with scope_of_work from Facebook campaigns
      const oppsToUpsert = opportunities.map(o => {
        // Try to extract scope from contact's attributions
        const attributions = o.contactId ? contactAttributions.get(o.contactId) : null;
        const scopeFromCampaign = extractScopeFromAttribution(attributions || null);
        
        return {
          ghl_id: o.id,
          company_id: integration.company_id,
          provider: 'ghl',
          external_id: o.id,
          location_id: o.locationId || integration.location_id,
          contact_id: o.contactId || null,
          pipeline_id: o.pipelineId || null,
          pipeline_stage_id: o.pipelineStageId || null,
          pipeline_name: pipelineNames.get(o.pipelineId) || null,
          stage_name: stageNames.get(o.pipelineStageId) || o.status || null,
          name: o.name || null,
          monetary_value: o.monetaryValue || null,
          status: o.status || null,
          assigned_to: o.assignedTo || null,
          ghl_date_added: o.createdAt || null,
          ghl_date_updated: o.updatedAt || null,
          custom_fields: o.customFields || null,
          scope_of_work: scopeFromCampaign, // Auto-populate from Facebook campaign
          last_synced_at: syncTimestamp,
        };
      });

      // Upsert opportunities
      if (oppsToUpsert.length > 0) {
        for (let i = 0; i < oppsToUpsert.length; i += 50) {
          const batch = oppsToUpsert.slice(i, i + 50);
          const { error } = await supabase.from('opportunities').upsert(batch, { onConflict: 'ghl_id' });
          if (error) console.error('Opportunities upsert error:', error);
        }
        console.log(`Upserted ${oppsToUpsert.length} opportunities`);
      }

      // Fetch and upsert recent appointments
      const appointments = await fetchRecentAppointments(apiKey, integration.location_id, sinceDate);
      
      const apptsToUpsert = appointments.map(a => ({
        ghl_id: a.id,
        company_id: integration.company_id,
        provider: 'ghl',
        external_id: a.id,
        location_id: a.locationId || integration.location_id,
        contact_id: a.contactId || null,
        calendar_id: a.calendarId || null,
        title: a.title || null,
        appointment_status: a.appointmentStatus || a.status || null,
        assigned_user_id: a.assignedUserId || null,
        start_time: a.startTime || null,
        end_time: a.endTime || null,
        notes: a.notes || null,
        address: a.address || null,
        ghl_date_added: a.dateAdded || a.createdAt || null,
        ghl_date_updated: a.dateUpdated || a.updatedAt || null,
        last_synced_at: syncTimestamp,
      }));

      if (apptsToUpsert.length > 0) {
        for (let i = 0; i < apptsToUpsert.length; i += 50) {
          const batch = apptsToUpsert.slice(i, i + 50);
          const { error } = await supabase.from('appointments').upsert(batch, { onConflict: 'ghl_id' });
          if (error) console.error('Appointments upsert error:', error);
        }
        console.log(`Upserted ${apptsToUpsert.length} appointments`);
      }

      // Update last_sync_at for this integration
      await supabase
        .from('company_integrations')
        .update({ last_sync_at: syncTimestamp })
        .eq('id', integration.id);

      results.push({
        integrationId: integration.id,
        companyId: integration.company_id,
        locationId: integration.location_id,
        name: integration.name || `Integration ${integration.id}`,
        opportunitiesSynced: oppsToUpsert.length,
        contactsSynced: contactsToUpsert.length,
        appointmentsSynced: apptsToUpsert.length,
      });
    }

    // Calculate totals
    const totals = results.reduce((acc, r) => ({
      opportunities: acc.opportunities + r.opportunitiesSynced,
      contacts: acc.contacts + r.contactsSynced,
      appointments: acc.appointments + r.appointmentsSynced,
    }), { opportunities: 0, contacts: 0, appointments: 0 });

    console.log('\n=== Sync complete! ===');
    console.log(`Total: ${totals.opportunities} opportunities, ${totals.contacts} contacts, ${totals.appointments} appointments`);

    return new Response(JSON.stringify({
      success: true,
      integrations: results,
      totals,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in GHL sync:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
