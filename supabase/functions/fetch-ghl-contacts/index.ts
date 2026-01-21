import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getGHLFieldMappings } from "../_shared/ghl-field-mappings.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Interface for company integration
interface GHLIntegration {
  id: string;
  company_id: string;
  location_id: string;
  api_key_vault_id: string | null;
  api_key_encrypted: string | null;
  name: string;
  is_primary: boolean;
}

async function fetchAllFromGHL(
  endpoint: string,
  ghlApiKey: string,
  locationId: string,
  dataKey: string,
  extraParams?: Record<string, string>
): Promise<any[]> {
  const allItems: any[] = [];
  let startAfterId: string | undefined;
  let startAfter: number | undefined;
  let hasMore = true;
  const seenIds = new Set<string>();

  while (hasMore) {
    const params = new URLSearchParams({ locationId, limit: '100', ...extraParams });
    if (startAfterId) params.append('startAfterId', startAfterId);
    if (startAfter !== undefined) params.append('startAfter', startAfter.toString());

    console.log(`Fetching ${dataKey}, startAfterId: ${startAfterId || 'none'}`);

    const response = await fetch(`https://services.leadconnectorhq.com/${endpoint}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ghlApiKey}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`GHL API Error (${endpoint}):`, errorText);
      // Don't throw for non-critical endpoints, just return empty
      return allItems;
    }

    const data = await response.json();
    const items = data[dataKey] || [];

    let newCount = 0;
    for (const item of items) {
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        allItems.push(item);
        newCount++;
      }
    }

    console.log(`${dataKey}: ${newCount} new items, total: ${allItems.length}`);

    if (newCount === 0 && items.length > 0) {
      hasMore = false;
      break;
    }

    if (data.meta?.startAfterId && data.meta?.startAfter !== undefined) {
      startAfterId = data.meta.startAfterId;
      startAfter = data.meta.startAfter;
    } else {
      hasMore = false;
    }

    if (items.length < 100 || allItems.length >= 10000) {
      hasMore = false;
    }
  }

  return allItems;
}

async function fetchOpportunities(ghlApiKey: string, locationId: string): Promise<any[]> {
  console.log('Fetching GHL opportunities...');
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
      return allOpportunities;
    }

    const data = await response.json();
    const opportunities = data.opportunities || [];

    let newCount = 0;
    for (const opp of opportunities) {
      if (!seenIds.has(opp.id)) {
        seenIds.add(opp.id);
        allOpportunities.push(opp);
        newCount++;
      }
    }

    console.log(`Opportunities page ${page}: ${newCount} new, total: ${allOpportunities.length}`);

    if (opportunities.length < 100 || allOpportunities.length >= 10000) {
      hasMore = false;
    } else {
      page++;
    }
  }

  return allOpportunities;
}

async function fetchUsers(ghlApiKey: string, locationId: string): Promise<any[]> {
  console.log('Fetching GHL users...');
  const response = await fetch(`https://services.leadconnectorhq.com/users/?locationId=${locationId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${ghlApiKey}`,
      'Version': '2021-07-28',
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('GHL Users API Error:', errorText);
    return [];
  }

  const data = await response.json();
  console.log(`Fetched ${data.users?.length || 0} users`);
  return data.users || [];
}

async function fetchPipelines(ghlApiKey: string, locationId: string): Promise<any[]> {
  console.log('Fetching GHL pipelines...');
  const response = await fetch(`https://services.leadconnectorhq.com/opportunities/pipelines?locationId=${locationId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${ghlApiKey}`,
      'Version': '2021-07-28',
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('GHL Pipelines API Error:', errorText);
    return [];
  }

  const data = await response.json();
  const pipelines = data.pipelines || [];
  console.log(`Fetched ${pipelines.length} pipelines`);
  return pipelines;
}

function buildPipelineLookups(pipelines: any[]): {
  pipelineNames: Map<string, string>;
  stageNames: Map<string, string>;
} {
  const pipelineNames = new Map<string, string>();
  const stageNames = new Map<string, string>();

  for (const pipeline of pipelines) {
    pipelineNames.set(pipeline.id, pipeline.name);
    
    // Stages are nested in the pipeline
    for (const stage of pipeline.stages || []) {
      stageNames.set(stage.id, stage.name);
    }
  }

  console.log(`Built lookup maps: ${pipelineNames.size} pipelines, ${stageNames.size} stages`);
  return { pipelineNames, stageNames };
}

async function fetchAppointments(ghlApiKey: string, locationId: string): Promise<{ appointments: any[]; calendars: any[] }> {
  console.log('Fetching GHL calendars first...');
  
  // First fetch all calendars for the location
  const calendarsResponse = await fetch(`https://services.leadconnectorhq.com/calendars/?locationId=${locationId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${ghlApiKey}`,
      'Version': '2021-07-28',
      'Content-Type': 'application/json',
    },
  });

  if (!calendarsResponse.ok) {
    const errorText = await calendarsResponse.text();
    console.error('GHL Calendars API Error:', errorText);
    return { appointments: [], calendars: [] };
  }

  const calendarsData = await calendarsResponse.json();
  const calendars = calendarsData.calendars || [];
  console.log(`Found ${calendars.length} calendars (${calendars.filter((c: any) => c.isActive).length} active)`);

  if (calendars.length === 0) {
    return { appointments: [], calendars: [] };
  }

  // Fetch appointments for each calendar
  const allAppointments: any[] = [];
  const seenIds = new Set<string>();
  
  // Fetch appointments for the last 365 days and next 90 days
  const startTime = Date.now() - (365 * 24 * 60 * 60 * 1000);
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
      const errorText = await response.text();
      console.error(`GHL Events API Error for calendar ${calendar.id}:`, errorText);
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

  console.log(`Fetched ${allAppointments.length} total appointments from ${calendars.length} calendars`);
  return { appointments: allAppointments, calendars };
}

async function fetchConversations(ghlApiKey: string, locationId: string): Promise<any[]> {
  console.log('Fetching GHL conversations...');
  const allConversations: any[] = [];
  const seenIds = new Set<string>();
  let lastMessageId: string | undefined;
  let hasMore = true;
  let emptyBatchCount = 0;

  while (hasMore) {
    const params = new URLSearchParams({
      locationId,
      limit: '100',
    });
    if (lastMessageId) {
      params.append('lastMessageId', lastMessageId);
    }

    const response = await fetch(`https://services.leadconnectorhq.com/conversations/search?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ghlApiKey}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GHL Conversations API Error:', errorText);
      return allConversations;
    }

    const data = await response.json();
    const conversations = data.conversations || [];

    let newCount = 0;
    let batchLastMessageId: string | undefined;
    
    for (const conv of conversations) {
      if (!seenIds.has(conv.id)) {
        seenIds.add(conv.id);
        allConversations.push(conv);
        newCount++;
      }
      // Track the last message ID from the last conversation in this batch
      if (conv.lastMessageId) {
        batchLastMessageId = conv.lastMessageId;
      }
    }

    console.log(`Conversations batch: ${newCount} new, total: ${allConversations.length}`);

    // Stop if no new conversations found (we've seen all of them)
    if (newCount === 0) {
      emptyBatchCount++;
      if (emptyBatchCount >= 2) {
        console.log('No new conversations in multiple batches, stopping');
        hasMore = false;
        break;
      }
    } else {
      emptyBatchCount = 0;
    }

    // Update pagination cursor
    if (batchLastMessageId) {
      lastMessageId = batchLastMessageId;
    } else {
      hasMore = false;
    }

    // Safety limits
    if (conversations.length < 100 || allConversations.length >= 10000) {
      hasMore = false;
    }
  }

  console.log(`Fetched ${allConversations.length} total conversations`);
  return allConversations;
}

async function fetchAllTasks(ghlApiKey: string, contacts: any[]): Promise<any[]> {
  console.log('Fetching GHL tasks for all contacts...');
  const allTasks: any[] = [];
  const batchSize = 5;

  for (let i = 0; i < contacts.length; i += batchSize) {
    const batch = contacts.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (contact) => {
      try {
        const response = await fetch(
          `https://services.leadconnectorhq.com/contacts/${contact.id}/tasks`,
          {
            headers: {
              'Authorization': `Bearer ${ghlApiKey}`,
              'Version': '2021-07-28',
              'Accept': 'application/json'
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          const tasks = data.tasks || [];
          return tasks.map((t: any) => ({ ...t, contactId: contact.id }));
        }
        return [];
      } catch (err) {
        console.error(`Error fetching tasks for contact ${contact.id}:`, err);
        return [];
      }
    });

    const batchResults = await Promise.all(batchPromises);
    batchResults.forEach(tasks => allTasks.push(...tasks));
    
    if (i + batchSize < contacts.length) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  console.log(`Fetched ${allTasks.length} total tasks`);
  return allTasks;
}

// Fetch all call logs from conversations
async function fetchCallLogs(ghlApiKey: string, conversations: any[], locationId: string): Promise<any[]> {
  console.log('Fetching call logs from conversations...');
  const allCalls: any[] = [];
  const batchSize = 5;

  // Only process conversations that have had call activity
  const conversationsWithCalls = conversations.filter(c => 
    c.lastMessageType === 'TYPE_CALL' || c.type === 'TYPE_CALL'
  );
  
  console.log(`Processing ${conversationsWithCalls.length} conversations that may have calls...`);

  for (let i = 0; i < conversationsWithCalls.length; i += batchSize) {
    const batch = conversationsWithCalls.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (conversation) => {
      try {
        // Remove type filter - fetch all messages and filter client-side
        const params = new URLSearchParams({
          conversationId: conversation.id,
          limit: '100'
        });

        const response = await fetch(
          `https://services.leadconnectorhq.com/conversations/${conversation.id}/messages?${params.toString()}`,
          {
            headers: {
              'Authorization': `Bearer ${ghlApiKey}`,
              'Version': '2021-07-28',
              'Accept': 'application/json'
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          
          // GHL API returns nested structure: data.messages.messages contains the array
          // Message types are numeric, not strings
          let messages: any[] = [];
          if (data.messages && Array.isArray(data.messages.messages)) {
            messages = data.messages.messages;
          } else if (Array.isArray(data.messages)) {
            messages = data.messages;
          } else if (Array.isArray(data)) {
            messages = data;
          }
          
          // Enhanced debugging: Log unique message types and a sample of each type
          if (i === 0 && conversation === batch[0] && messages.length > 0) {
            const uniqueTypes = [...new Set(messages.map((m: any) => m.type))];
            console.log(`Message types found in conversation: ${JSON.stringify(uniqueTypes)}`);
            
            // Log a sample message of each type to identify call messages
            uniqueTypes.forEach((type: any) => {
              const sampleMsg = messages.find((m: any) => m.type === type);
              if (sampleMsg) {
                console.log(`Type ${type} sample: ${JSON.stringify({ type: sampleMsg.type, direction: sampleMsg.direction, body: (sampleMsg.body || '').substring(0, 100), messageType: sampleMsg.messageType })}`);
              }
            });
          }
          
          // Filter for call messages - include type 37 (calls/voicemail based on TYPE_CALL conversations)
          // Also include type 6, 31, and string variants for comprehensive capture
            return messages
            .filter((m: any) => {
              const msgType = m.type;
              // Numeric types: 37 (likely calls), 6 (calls), 31 (possibly related)
              // String types: 'call', 'type_call', etc.
              return msgType === 37 || msgType === 6 || msgType === 31 ||
                     msgType === '37' || msgType === '6' || msgType === '31' ||
                     String(msgType).toLowerCase().includes('call') || 
                     m.messageType === 'CALL' || m.messageType === 'Call';
            })
            .map((m: any) => ({
              messageId: m.id,
              conversationId: conversation.id,
              contactId: conversation.contactId,
              direction: m.direction,
              callDate: m.dateAdded,
              userId: m.userId,
              locationId: locationId,
              duration: m.callDuration || 0,
            }));
        }
        return [];
      } catch (err) {
        console.error(`Error fetching messages for conversation ${conversation.id}:`, err);
        return [];
      }
    });

    const batchResults = await Promise.all(batchPromises);
    batchResults.forEach(calls => allCalls.push(...calls));
    
    if (i + batchSize < conversationsWithCalls.length) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  console.log(`Fetched ${allCalls.length} total call records`);
  return allCalls;
}

// Sync data for a single GHL location with company_id support
async function syncLocationData(
  supabase: any,
  ghlApiKey: string,
  locationId: string,
  locationLabel: string,
  companyId: string | null,
  integrationId: string | null = null
): Promise<{
  contacts: number;
  opportunities: number;
  appointments: number;
  users: number;
  pipelines: number;
  conversations: number;
  tasks: number;
  callLogs: number;
}> {
  console.log(`\n========== Starting sync for ${locationLabel} (${locationId}) | Company: ${companyId || 'none'} ==========`);

  // Fetch field mappings for this integration to map GHL standard fields correctly
  const fieldMappings = await getGHLFieldMappings(supabase, { integrationId, locationId });
  console.log(`Using field mappings:`, fieldMappings);

  // Fetch all data in parallel (including pipelines for name resolution)
  const [contacts, opportunities, appointmentsData, users, pipelines, conversations] = await Promise.all([
    fetchAllFromGHL('contacts/', ghlApiKey, locationId, 'contacts'),
    fetchOpportunities(ghlApiKey, locationId),
    fetchAppointments(ghlApiKey, locationId),
    fetchUsers(ghlApiKey, locationId),
    fetchPipelines(ghlApiKey, locationId),
    fetchConversations(ghlApiKey, locationId),
  ]);

  const { appointments, calendars } = appointmentsData;

  // Fetch tasks after contacts (needs contact IDs)
  const tasks = await fetchAllTasks(ghlApiKey, contacts);

  // Build pipeline/stage lookup maps
  const { pipelineNames, stageNames } = buildPipelineLookups(pipelines);

  // Current sync timestamp for tracking
  const syncTimestamp = new Date().toISOString();

  // Sync users first (needed for name resolution)
  if (users.length > 0) {
    console.log(`Syncing ${users.length} users...`);
    const usersToUpsert = users.map(u => ({
      ghl_id: u.id,
      company_id: companyId,
      provider: 'ghl',
      external_id: u.id,
      location_id: locationId,
      name: u.name || null,
      first_name: u.firstName || null,
      last_name: u.lastName || null,
      email: u.email || null,
      phone: u.phone || null,
      role: u.role || null,
    }));

    const { error: usersError } = await supabase
      .from('ghl_users')
      .upsert(usersToUpsert, { onConflict: 'ghl_id' });

    if (usersError) {
      console.error('Users upsert error:', usersError);
    }
  }

  // Sync pipelines with their stages
  if (pipelines.length > 0) {
    console.log(`Syncing ${pipelines.length} pipelines...`);
    const pipelinesToUpsert = pipelines.map((p: any) => ({
      ghl_id: p.id,
      company_id: companyId,
      location_id: locationId,
      name: p.name || 'Unknown Pipeline',
      stages: (p.stages || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        position: s.position || 0,
      })),
    }));

    const { error: pipelinesError } = await supabase
      .from('ghl_pipelines')
      .upsert(pipelinesToUpsert, { onConflict: 'ghl_id,location_id' });

    if (pipelinesError) {
      console.error('Pipelines upsert error:', pipelinesError);
    }
  }

  // Sync calendars with active status
  if (calendars.length > 0) {
    console.log(`Syncing ${calendars.length} calendars...`);
    const calendarsToUpsert = calendars.map((c: any) => ({
      ghl_id: c.id,
      company_id: companyId,
      location_id: locationId,
      name: c.name || null,
      description: c.description || null,
      is_active: c.isActive ?? true,
      team_members: c.teamMembers || [],
    }));

    const { error: calendarsError } = await supabase
      .from('ghl_calendars')
      .upsert(calendarsToUpsert, { onConflict: 'ghl_id' });

    if (calendarsError) {
      console.error('Calendars upsert error:', calendarsError);
    }
  }

  // Helper function to build enhanced custom_fields with GHL standard address fields
  function buildEnhancedCustomFields(
    ghlContact: any,
    existingCustomFields: any[] | null,
    mappings: typeof fieldMappings
  ): any[] | null {
    // Start with GHL's custom fields or empty array
    let customFields: any[] = [];
    
    if (ghlContact.customFields && Array.isArray(ghlContact.customFields)) {
      customFields = [...ghlContact.customFields];
    }
    
    // Build full address from GHL standard fields (address1, city, state, postalCode, country)
    const addressParts: string[] = [];
    if (ghlContact.address1) addressParts.push(ghlContact.address1);
    if (ghlContact.city) addressParts.push(ghlContact.city);
    if (ghlContact.state) addressParts.push(ghlContact.state);
    if (ghlContact.postalCode) addressParts.push(ghlContact.postalCode);
    if (ghlContact.country && ghlContact.country !== 'US' && ghlContact.country !== 'USA') {
      addressParts.push(ghlContact.country);
    }
    
    const fullAddress = addressParts.join(', ');
    
    // If we have an address and a mapping for it, add/update it in custom_fields
    if (fullAddress && mappings.address) {
      // Check if address field already exists in custom_fields
      const existingAddressIdx = customFields.findIndex((f: any) => f.id === mappings.address);
      
      if (existingAddressIdx >= 0) {
        // Update existing if empty
        if (!customFields[existingAddressIdx].value) {
          customFields[existingAddressIdx].value = fullAddress;
        }
      } else {
        // Add new address field
        customFields.push({
          id: mappings.address,
          value: fullAddress,
        });
      }
    }
    
    // Also preserve any existing local custom_fields that aren't in GHL data
    if (existingCustomFields && Array.isArray(existingCustomFields)) {
      const existingIds = new Set(customFields.map((f: any) => f.id));
      for (const existingField of existingCustomFields) {
        if (!existingIds.has(existingField.id)) {
          customFields.push(existingField);
        }
      }
    }
    
    return customFields.length > 0 ? customFields : null;
  }

  // Sync contacts with last_synced_at tracking
  // LOCAL WINS STRATEGY: Only fill in null fields, never overwrite existing local data
  if (contacts.length > 0) {
    console.log(`Syncing ${contacts.length} contacts with LOCAL WINS strategy...`);
    console.log(`Address field mapping ID: ${fieldMappings.address || 'not configured'}`);
    
    // Fetch all existing contacts to preserve local data
    const contactGhlIds = contacts.map(c => c.id);
    const existingContactsMap = new Map<string, any>();
    
    for (let i = 0; i < contactGhlIds.length; i += 100) {
      const batchIds = contactGhlIds.slice(i, i + 100);
      const { data: existingContacts, error: fetchError } = await supabase
        .from('contacts')
        .select('*')
        .in('ghl_id', batchIds);
      
      if (fetchError) {
        console.error('Error fetching existing contacts for preservation:', fetchError);
      }
      
      (existingContacts || []).forEach((c: any) => {
        existingContactsMap.set(c.ghl_id, c);
      });
    }
    
    console.log(`Found ${existingContactsMap.size} existing contacts to preserve`);
    
    const contactsToUpsert = contacts.map(c => {
      const existing = existingContactsMap.get(c.id);
      
      // Build enhanced custom_fields with address from standard GHL fields
      const enhancedCustomFields = buildEnhancedCustomFields(c, existing?.custom_fields, fieldMappings);
      
      // If record exists locally, only fill null fields (LOCAL WINS)
      if (existing) {
        return {
          ghl_id: c.id,
          company_id: existing.company_id ?? companyId, // Preserve existing or set new
          provider: existing.provider ?? 'ghl',
          external_id: existing.external_id ?? c.id,
          location_id: existing.location_id ?? c.locationId ?? locationId,
          contact_name: existing.contact_name ?? c.contactName ?? null,
          first_name: existing.first_name ?? c.firstName ?? null,
          last_name: existing.last_name ?? c.lastName ?? null,
          email: existing.email ?? c.email ?? null,
          phone: existing.phone ?? c.phone ?? null,
          source: existing.source ?? c.source ?? null,
          tags: existing.tags ?? c.tags ?? [],
          assigned_to: existing.assigned_to ?? c.assignedTo ?? null,
          ghl_date_added: existing.ghl_date_added ?? c.dateAdded ?? null,
          ghl_date_updated: existing.ghl_date_updated ?? c.dateUpdated ?? null,
          custom_fields: existing.custom_fields ?? enhancedCustomFields,
          attributions: existing.attributions ?? c.attributions ?? null,
          entered_by: existing.entered_by, // Always preserve
          last_synced_at: syncTimestamp, // Always update sync timestamp
        };
      }
      
      // New record - use GHL data with enhanced custom_fields
      return {
        ghl_id: c.id,
        company_id: companyId,
        provider: 'ghl',
        external_id: c.id,
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
        custom_fields: enhancedCustomFields,
        attributions: c.attributions || null,
        last_synced_at: syncTimestamp,
      };
    });

    for (let i = 0; i < contactsToUpsert.length; i += 100) {
      const batch = contactsToUpsert.slice(i, i + 100);
      const { error } = await supabase.from('contacts').upsert(batch, { onConflict: 'ghl_id' });
      if (error) console.error('Contacts upsert error:', error);
    }
  }

  // Sync opportunities with last_synced_at tracking
  // LOCAL WINS STRATEGY: Preserve ALL existing local fields, only fill nulls from GHL
  if (opportunities.length > 0) {
    console.log(`Syncing ${opportunities.length} opportunities with LOCAL WINS strategy...`);
    
    // Fetch ALL existing opportunity data to preserve local values
    const oppGhlIds = opportunities.map(o => o.id);
    const existingOppsMap = new Map<string, any>();
    
    // Fetch in batches of 100 to avoid query limits
    for (let i = 0; i < oppGhlIds.length; i += 100) {
      const batchIds = oppGhlIds.slice(i, i + 100);
      const { data: existingOpps, error: fetchError } = await supabase
        .from('opportunities')
        .select('*')
        .in('ghl_id', batchIds);
      
      if (fetchError) {
        console.error('Error fetching existing opportunities for preservation:', fetchError);
      }
      
      (existingOpps || []).forEach((opp: any) => {
        existingOppsMap.set(opp.ghl_id, opp);
      });
    }
    
    console.log(`Found ${existingOppsMap.size} existing opportunities to preserve`);
    
      // Build maps of contact IDs to their custom_fields and attributions for scope extraction
      const contactCustomFieldsMap = new Map<string, any[]>();
      const contactAttributionsMap = new Map<string, any[]>();
      contacts.forEach(c => {
        if (c.id && c.customFields && Array.isArray(c.customFields)) {
          contactCustomFieldsMap.set(c.id, c.customFields);
        }
        if (c.id && c.attributions && Array.isArray(c.attributions)) {
          contactAttributionsMap.set(c.id, c.attributions);
        }
      });
      console.log(`Built contact custom fields map for ${contactCustomFieldsMap.size} contacts`);
      console.log(`Built contact attributions map for ${contactAttributionsMap.size} contacts`);
      console.log(`Using scope_of_work field mapping: ${fieldMappings.scope_of_work || 'not configured'}`);
      console.log(`Using address field mapping: ${fieldMappings.address || 'not configured'}`);
    
    const oppsToUpsert = opportunities.map(o => {
      const existing = existingOppsMap.get(o.id);
      
      // If record exists locally, use LOCAL WINS strategy
      if (existing) {
        // Special handling for won_at: if already set, ALWAYS preserve
        let wonAt: string | null = existing.won_at || null;
        if (!existing.won_at && o.status === 'won') {
          // Only set won_at if this is a newly won opportunity
          wonAt = new Date().toISOString();
          console.log(`Setting new won_at for ${o.id}: ${wonAt}`);
        }
        
        // Special handling for status: won opportunities stay won
        let finalStatus = existing.status ?? o.status ?? null;
        if (wonAt) {
          finalStatus = 'won';
        }
        
        // Extract scope_of_work and address from contact's custom_fields using field mappings - only if local is null
        let scopeOfWork: string | null = existing.scope_of_work || null;
        let opportunityAddress: string | null = existing.address || null;
        
        const contactCustomFields = contactCustomFieldsMap.get(o.contactId);
        const contactAttributions = contactAttributionsMap.get(o.contactId);
        
        if (!scopeOfWork) {
          // Try custom field first using field mappings (not hardcoded ID)
          if (contactCustomFields && fieldMappings.scope_of_work) {
            const scopeField = contactCustomFields.find(
              (field: { id: string; value?: string }) => field.id === fieldMappings.scope_of_work
            );
            if (scopeField && scopeField.value) {
              scopeOfWork = scopeField.value;
            }
          }
          // Fallback: extract from utmContent in attributions (Facebook leads)
          if (!scopeOfWork && contactAttributions) {
            const attrWithUtm = contactAttributions.find((a: any) => a.utmContent);
            if (attrWithUtm?.utmContent) {
              scopeOfWork = attrWithUtm.utmContent;
              console.log(`Extracted scope from UTM content for opp ${o.id}: ${scopeOfWork}`);
            }
          }
        }
        
        if (!opportunityAddress && contactCustomFields && fieldMappings.address) {
          const addressField = contactCustomFields.find(
            (field: { id: string; value?: string }) => field.id === fieldMappings.address
          );
          if (addressField && addressField.value) {
            opportunityAddress = addressField.value;
          }
        }
        
        return {
          ghl_id: o.id,
          company_id: existing.company_id ?? companyId, // Preserve existing or set new
          provider: existing.provider ?? 'ghl',
          external_id: existing.external_id ?? o.id,
          location_id: existing.location_id ?? o.locationId ?? locationId,
          contact_id: existing.contact_id ?? o.contactId ?? null,
          pipeline_id: existing.pipeline_id ?? o.pipelineId ?? null,
          pipeline_stage_id: existing.pipeline_stage_id ?? o.pipelineStageId ?? null,
          pipeline_name: existing.pipeline_name ?? pipelineNames.get(o.pipelineId) ?? null,
          stage_name: existing.stage_name ?? stageNames.get(o.pipelineStageId) ?? o.status ?? null,
          name: existing.name ?? o.name ?? null,
          monetary_value: existing.monetary_value ?? o.monetaryValue ?? null,
          status: finalStatus,
          assigned_to: existing.assigned_to ?? o.assignedTo ?? null,
          ghl_date_added: existing.ghl_date_added ?? o.createdAt ?? null,
          ghl_date_updated: existing.ghl_date_updated ?? o.updatedAt ?? null,
          custom_fields: existing.custom_fields ?? o.customFields ?? null,
          entered_by: existing.entered_by, // Always preserve
          won_at: wonAt,
          scope_of_work: scopeOfWork,
          address: opportunityAddress,
          last_synced_at: syncTimestamp, // Always update sync timestamp
        };
      }
      
      // New record - extract scope_of_work and address from contact custom fields using field mappings
      let scopeOfWork: string | null = null;
      let opportunityAddress: string | null = null;
      
      const contactCustomFields = contactCustomFieldsMap.get(o.contactId);
      const contactAttributions = contactAttributionsMap.get(o.contactId);
      
      // Try custom field first using field mappings (not hardcoded ID)
      if (contactCustomFields && fieldMappings.scope_of_work) {
        const scopeField = contactCustomFields.find(
          (field: { id: string; value?: string }) => field.id === fieldMappings.scope_of_work
        );
        if (scopeField && scopeField.value) {
          scopeOfWork = scopeField.value;
        }
      }
      // Fallback: extract from utmContent in attributions (Facebook leads)
      if (!scopeOfWork && contactAttributions) {
        const attrWithUtm = contactAttributions.find((a: any) => a.utmContent);
        if (attrWithUtm?.utmContent) {
          scopeOfWork = attrWithUtm.utmContent;
          console.log(`Extracted scope from UTM content for new opp ${o.id}: ${scopeOfWork}`);
        }
      }
      
      // Extract address using field mappings
      if (contactCustomFields && fieldMappings.address) {
        const addressField = contactCustomFields.find(
          (field: { id: string; value?: string }) => field.id === fieldMappings.address
        );
        if (addressField && addressField.value) {
          opportunityAddress = addressField.value;
        }
      }
      
      // Determine won_at for new records
      let wonAt: string | null = null;
      if (o.status === 'won') {
        wonAt = new Date().toISOString();
      }
      
      return {
        ghl_id: o.id,
        company_id: companyId,
        provider: 'ghl',
        external_id: o.id,
        location_id: o.locationId || locationId,
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
        last_synced_at: syncTimestamp,
        won_at: wonAt,
        scope_of_work: scopeOfWork,
        address: opportunityAddress,
      };
    });

    for (let i = 0; i < oppsToUpsert.length; i += 100) {
      const batch = oppsToUpsert.slice(i, i + 100);
      const { error } = await supabase.from('opportunities').upsert(batch, { onConflict: 'ghl_id' });
      if (error) console.error('Opportunities upsert error:', error);
    }
  }

  // Sync appointments with last_synced_at tracking
  // LOCAL WINS STRATEGY: Only fill in null fields, never overwrite existing local data
  if (appointments.length > 0) {
    console.log(`Syncing ${appointments.length} appointments with LOCAL WINS strategy...`);
    
    // Fetch existing appointments to preserve local data
    const apptGhlIds = appointments.map(a => a.id);
    const existingApptsMap = new Map<string, any>();
    
    for (let i = 0; i < apptGhlIds.length; i += 100) {
      const batchIds = apptGhlIds.slice(i, i + 100);
      const { data: existingAppts, error: fetchError } = await supabase
        .from('appointments')
        .select('*')
        .in('ghl_id', batchIds);
      
      if (fetchError) {
        console.error('Error fetching existing appointments for preservation:', fetchError);
      }
      
      (existingAppts || []).forEach((a: any) => {
        existingApptsMap.set(a.ghl_id, a);
      });
    }
    
    console.log(`Found ${existingApptsMap.size} existing appointments to preserve`);
    
    const apptsToUpsert = appointments.map(a => {
      const existing = existingApptsMap.get(a.id);
      
      // If record exists locally, only fill null fields (LOCAL WINS)
      if (existing) {
        return {
          ghl_id: a.id,
          company_id: existing.company_id ?? companyId, // Preserve existing or set new
          provider: existing.provider ?? 'ghl',
          external_id: existing.external_id ?? a.id,
          location_id: existing.location_id ?? a.locationId ?? locationId,
          contact_id: existing.contact_id ?? a.contactId ?? null,
          calendar_id: existing.calendar_id ?? a.calendarId ?? null,
          title: existing.title ?? a.title ?? null,
          appointment_status: existing.appointment_status ?? a.appointmentStatus ?? a.status ?? null,
          assigned_user_id: existing.assigned_user_id ?? a.assignedUserId ?? null,
          start_time: existing.start_time ?? a.startTime ?? null,
          end_time: existing.end_time ?? a.endTime ?? null,
          notes: existing.notes ?? a.notes ?? null,
          address: existing.address ?? a.address ?? null,
          ghl_date_added: existing.ghl_date_added ?? a.dateAdded ?? a.createdAt ?? null,
          ghl_date_updated: existing.ghl_date_updated ?? a.dateUpdated ?? a.updatedAt ?? null,
          entered_by: existing.entered_by, // Always preserve
          edited_by: existing.edited_by, // Always preserve
          edited_at: existing.edited_at, // Always preserve
          salesperson_confirmed: existing.salesperson_confirmed, // Always preserve
          salesperson_confirmed_at: existing.salesperson_confirmed_at, // Always preserve
          last_synced_at: syncTimestamp, // Always update sync timestamp
        };
      }
      
      // New record - use GHL data
      return {
        ghl_id: a.id,
        company_id: companyId,
        provider: 'ghl',
        external_id: a.id,
        location_id: a.locationId || locationId,
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
      };
    });

    for (let i = 0; i < apptsToUpsert.length; i += 100) {
      const batch = apptsToUpsert.slice(i, i + 100);
      const { error } = await supabase.from('appointments').upsert(batch, { onConflict: 'ghl_id' });
      if (error) console.error('Appointments upsert error:', error);
    }
  }

  // Sync conversations with last_synced_at tracking
  // LOCAL WINS STRATEGY: Only fill in null fields, never overwrite existing local data
  if (conversations.length > 0) {
    console.log(`Syncing ${conversations.length} conversations with LOCAL WINS strategy...`);
    
    // Helper to convert Unix timestamp (ms) to ISO string
    const toISODate = (val: any): string | null => {
      if (!val) return null;
      if (typeof val === 'number') {
        return new Date(val).toISOString();
      }
      if (typeof val === 'string') {
        return val;
      }
      return null;
    };

    // Fetch existing conversations to preserve local data
    const convGhlIds = conversations.map(c => c.id);
    const existingConvsMap = new Map<string, any>();
    
    for (let i = 0; i < convGhlIds.length; i += 100) {
      const batchIds = convGhlIds.slice(i, i + 100);
      const { data: existingConvs, error: fetchError } = await supabase
        .from('conversations')
        .select('*')
        .in('ghl_id', batchIds);
      
      if (fetchError) {
        console.error('Error fetching existing conversations for preservation:', fetchError);
      }
      
      (existingConvs || []).forEach((c: any) => {
        existingConvsMap.set(c.ghl_id, c);
      });
    }
    
    console.log(`Found ${existingConvsMap.size} existing conversations to preserve`);

    const convsToUpsert = conversations.map(c => {
      const existing = existingConvsMap.get(c.id);
      
      // If record exists locally, only fill null fields (LOCAL WINS)
      if (existing) {
        return {
          ghl_id: c.id,
          company_id: existing.company_id ?? companyId, // Preserve existing or set new
          provider: existing.provider ?? 'ghl',
          external_id: existing.external_id ?? c.id,
          location_id: existing.location_id ?? c.locationId ?? locationId,
          contact_id: existing.contact_id ?? c.contactId ?? null,
          type: existing.type ?? c.type ?? null,
          unread_count: existing.unread_count ?? c.unreadCount ?? 0,
          inbox_status: existing.inbox_status ?? c.inboxStatus ?? null,
          last_message_body: existing.last_message_body ?? c.lastMessageBody ?? null,
          last_message_date: existing.last_message_date ?? toISODate(c.lastMessageDate),
          last_message_type: existing.last_message_type ?? c.lastMessageType ?? null,
          last_message_direction: existing.last_message_direction ?? c.lastMessageDirection ?? null,
          ghl_date_added: existing.ghl_date_added ?? toISODate(c.dateAdded) ?? toISODate(c.createdAt),
          ghl_date_updated: existing.ghl_date_updated ?? toISODate(c.dateUpdated) ?? toISODate(c.updatedAt),
          last_synced_at: syncTimestamp, // Always update sync timestamp
        };
      }
      
      // New record - use GHL data
      return {
        ghl_id: c.id,
        company_id: companyId,
        provider: 'ghl',
        external_id: c.id,
        location_id: c.locationId || locationId,
        contact_id: c.contactId || null,
        type: c.type || null,
        unread_count: c.unreadCount || 0,
        inbox_status: c.inboxStatus || null,
        last_message_body: c.lastMessageBody || null,
        last_message_date: toISODate(c.lastMessageDate),
        last_message_type: c.lastMessageType || null,
        last_message_direction: c.lastMessageDirection || null,
        ghl_date_added: toISODate(c.dateAdded) || toISODate(c.createdAt),
        ghl_date_updated: toISODate(c.dateUpdated) || toISODate(c.updatedAt),
        last_synced_at: syncTimestamp,
      };
    });

    for (let i = 0; i < convsToUpsert.length; i += 100) {
      const batch = convsToUpsert.slice(i, i + 100);
      const { error } = await supabase.from('conversations').upsert(batch, { onConflict: 'ghl_id' });
      if (error) console.error('Conversations upsert error:', error);
    }
  }

  // Sync tasks with last_synced_at tracking
  // LOCAL WINS STRATEGY: Only fill in null fields, never overwrite existing local data
  if (tasks.length > 0) {
    console.log(`Syncing ${tasks.length} tasks with LOCAL WINS strategy...`);
    
    // Fetch existing tasks to preserve local data
    const taskGhlIds = tasks.map(t => t.id);
    const existingTasksMap = new Map<string, any>();
    
    for (let i = 0; i < taskGhlIds.length; i += 100) {
      const batchIds = taskGhlIds.slice(i, i + 100);
      const { data: existingTasks, error: fetchError } = await supabase
        .from('ghl_tasks')
        .select('*')
        .in('ghl_id', batchIds);
      
      if (fetchError) {
        console.error('Error fetching existing tasks for preservation:', fetchError);
      }
      
      (existingTasks || []).forEach((t: any) => {
        existingTasksMap.set(t.ghl_id, t);
      });
    }
    
    console.log(`Found ${existingTasksMap.size} existing tasks to preserve`);
    
    const tasksToUpsert = tasks.map(t => {
      const existing = existingTasksMap.get(t.id);
      
      // If record exists locally, only fill null fields (LOCAL WINS)
      if (existing) {
        return {
          ghl_id: t.id,
          company_id: existing.company_id ?? companyId, // Preserve existing or set new
          provider: existing.provider ?? 'ghl',
          external_id: existing.external_id ?? t.id,
          location_id: existing.location_id ?? locationId,
          contact_id: existing.contact_id ?? t.contactId,
          title: existing.title ?? t.title ?? 'Untitled Task',
          body: existing.body ?? t.body ?? null,
          assigned_to: existing.assigned_to ?? t.assignedTo ?? null,
          due_date: existing.due_date ?? t.dueDate ?? null,
          completed: existing.completed ?? t.completed ?? false,
          entered_by: existing.entered_by, // Always preserve
          edited_by: existing.edited_by, // Always preserve
          edited_at: existing.edited_at, // Always preserve
          last_synced_at: syncTimestamp, // Always update sync timestamp
        };
      }
      
      // New record - use GHL data
      return {
        ghl_id: t.id,
        company_id: companyId,
        provider: 'ghl',
        external_id: t.id,
        location_id: locationId,
        contact_id: t.contactId,
        title: t.title || 'Untitled Task',
        body: t.body || null,
        assigned_to: t.assignedTo || null,
        due_date: t.dueDate || null,
        completed: t.completed || false,
        last_synced_at: syncTimestamp,
      };
    });

    for (let i = 0; i < tasksToUpsert.length; i += 100) {
      const batch = tasksToUpsert.slice(i, i + 100);
      const { error } = await supabase.from('ghl_tasks').upsert(batch, { onConflict: 'ghl_id' });
      if (error) console.error('Tasks upsert error:', error);
    }
  }

  // Fetch and sync call logs (after conversations are fetched)
  const callLogs = await fetchCallLogs(ghlApiKey, conversations, locationId);
  
  if (callLogs.length > 0) {
    console.log(`Syncing ${callLogs.length} call logs...`);
    const callsToUpsert = callLogs.map(c => ({
      ghl_message_id: c.messageId,
      company_id: companyId,
      conversation_id: c.conversationId,
      contact_id: c.contactId,
      direction: c.direction,
      call_date: c.callDate,
      user_id: c.userId,
      location_id: c.locationId,
      duration: c.duration || 0,
    }));

    for (let i = 0; i < callsToUpsert.length; i += 100) {
      const batch = callsToUpsert.slice(i, i + 100);
      const { error } = await supabase.from('call_logs').upsert(batch, { onConflict: 'ghl_message_id' });
      if (error) console.error('Call logs upsert error:', error);
    }
  }

  console.log(`========== Sync complete for ${locationLabel} ==========\n`);

  return {
    contacts: contacts.length,
    opportunities: opportunities.length,
    appointments: appointments.length,
    users: users.length,
    pipelines: pipelines.length,
    conversations: conversations.length,
    tasks: tasks.length,
    callLogs: callLogs.length,
  };
}

// Run stale record cleanup for a specific location with company_id filtering
async function cleanupStaleRecords(
  supabase: any,
  locationId: string,
  companyId: string | null,
  counts: { contacts: number; opportunities: number; appointments: number; tasks: number; conversations: number }
): Promise<number> {
  // SAFE STALE RECORD CLEANUP
  // Only delete records that haven't been seen in 1+ hour
  const staleThreshold = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
  
  // Only run cleanup if we fetched a reasonable number of records
  const minRecordsForCleanup = {
    contacts: 100,
    opportunities: 50,
    appointments: 10,
    tasks: 5,
    conversations: 10,
  };

  console.log(`Starting safe stale record cleanup for location ${locationId} (1hr threshold)...`);
  let totalDeleted = 0;

  // Build base query with optional company_id filter
  const buildQuery = (table: string) => {
    let query = supabase.from(table).select('ghl_id').eq('location_id', locationId);
    if (companyId) {
      query = query.eq('company_id', companyId);
    }
    return query.lt('last_synced_at', staleThreshold).not('ghl_id', 'like', 'local_%');
  };

  const buildDeleteQuery = (table: string) => {
    let query = supabase.from(table).delete().eq('location_id', locationId);
    if (companyId) {
      query = query.eq('company_id', companyId);
    }
    return query.lt('last_synced_at', staleThreshold).not('ghl_id', 'like', 'local_%');
  };

  // Cleanup contacts (only if we fetched enough)
  // IMPORTANT: Exclude local-only records (ghl_id starts with 'local_') - these should only be deleted from the app
  if (counts.contacts >= minRecordsForCleanup.contacts) {
    const { data: staleContacts, error: staleContactsErr } = await buildQuery('contacts');
    
    if (!staleContactsErr && staleContacts && staleContacts.length > 0) {
      console.log(`Found ${staleContacts.length} stale contacts (excluding local-only)`);
      const { error: delErr } = await buildDeleteQuery('contacts');
      if (!delErr) totalDeleted += staleContacts.length;
      else console.error('Error deleting stale contacts:', delErr);
    }
  }

  // Cleanup opportunities (only if we fetched enough)
  // IMPORTANT: Exclude local-only records (ghl_id starts with 'local_') - these should only be deleted from the app
  if (counts.opportunities >= minRecordsForCleanup.opportunities) {
    const { data: staleOpps, error: staleOppsErr } = await buildQuery('opportunities');
    
    if (!staleOppsErr && staleOpps && staleOpps.length > 0) {
      console.log(`Found ${staleOpps.length} stale opportunities (excluding local-only)`);
      const { error: delErr } = await buildDeleteQuery('opportunities');
      if (!delErr) totalDeleted += staleOpps.length;
      else console.error('Error deleting stale opportunities:', delErr);
    }
  }

  // Cleanup appointments (only if we fetched enough)
  // IMPORTANT: Exclude local-only appointments (ghl_id starts with 'local_') from cleanup
  if (counts.appointments >= minRecordsForCleanup.appointments) {
    const { data: staleAppts, error: staleApptsErr } = await buildQuery('appointments');
    
    if (!staleApptsErr && staleAppts && staleAppts.length > 0) {
      console.log(`Found ${staleAppts.length} stale appointments (excluding local-only)`);
      const { error: delErr } = await buildDeleteQuery('appointments');
      if (!delErr) totalDeleted += staleAppts.length;
      else console.error('Error deleting stale appointments:', delErr);
    }
  }

  // Cleanup tasks (only if we fetched enough)
  // IMPORTANT: Exclude local-only records (ghl_id starts with 'local_') - these should only be deleted from the app
  if (counts.tasks >= minRecordsForCleanup.tasks) {
    const { data: staleTasks, error: staleTasksErr } = await buildQuery('ghl_tasks');
    
    if (!staleTasksErr && staleTasks && staleTasks.length > 0) {
      console.log(`Found ${staleTasks.length} stale tasks (excluding local-only)`);
      const { error: delErr } = await buildDeleteQuery('ghl_tasks');
      if (!delErr) totalDeleted += staleTasks.length;
      else console.error('Error deleting stale tasks:', delErr);
    }
  }

  // Cleanup conversations (only if we fetched enough)
  // IMPORTANT: Exclude local-only records (ghl_id starts with 'local_') - these should only be deleted from the app
  if (counts.conversations >= minRecordsForCleanup.conversations) {
    const { data: staleConvs, error: staleConvsErr } = await buildQuery('conversations');
    
    if (!staleConvsErr && staleConvs && staleConvs.length > 0) {
      console.log(`Found ${staleConvs.length} stale conversations (excluding local-only)`);
      const { error: delErr } = await buildDeleteQuery('conversations');
      if (!delErr) totalDeleted += staleConvs.length;
      else console.error('Error deleting stale conversations:', delErr);
    }
  }

  console.log(`Stale cleanup complete for location ${locationId}! Deleted ${totalDeleted} records.`);
  return totalDeleted;
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

    console.log('Starting multi-company GHL sync...');
    
    // Query company_integrations for active GHL connections
    const { data: integrations, error: intError } = await supabase
      .from('company_integrations')
      .select('id, company_id, location_id, api_key_vault_id, api_key_encrypted, name, is_primary')
      .eq('provider', 'ghl')
      .eq('is_active', true);

    if (intError) {
      console.error('Error fetching company integrations:', intError);
    }

    // Check if we have integrations configured in the database
    const hasDbIntegrations = integrations && integrations.length > 0 && 
      integrations.some((i: GHLIntegration) => i.api_key_encrypted || i.api_key_vault_id);

    if (hasDbIntegrations) {
      // New approach: Use company_integrations for multi-tenancy
      console.log(`Found ${integrations.length} active GHL integrations in database`);
      
      const allResults: any[] = [];
      
      for (const integration of integrations as GHLIntegration[]) {
        if (!integration.api_key_encrypted) {
          console.log(`Integration ${integration.id} has no API key configured, skipping`);
          continue;
        }

        // Get decrypted API key using pgcrypto function
        const { data: apiKey, error: vaultError } = await supabase
          .rpc('get_ghl_api_key_encrypted', { p_integration_id: integration.id });

        if (vaultError || !apiKey) {
          console.error(`Error retrieving API key for integration ${integration.id}:`, vaultError);
          continue;
        }

        // Sync this company's data
        const results = await syncLocationData(
          supabase,
          apiKey,
          integration.location_id,
          integration.name || `Integration ${integration.id}`,
          integration.company_id,
          integration.id  // Pass integration ID for field mappings
        );

        // Cleanup stale records for this company
        const staleDeleted = await cleanupStaleRecords(supabase, integration.location_id, integration.company_id, {
          contacts: results.contacts,
          opportunities: results.opportunities,
          appointments: results.appointments,
          tasks: results.tasks,
          conversations: results.conversations,
        });

        // Update last_sync_at in company_integrations
        await supabase
          .from('company_integrations')
          .update({ last_sync_at: new Date().toISOString() })
          .eq('id', integration.id);

        allResults.push({
          integrationId: integration.id,
          companyId: integration.company_id,
          locationId: integration.location_id,
          name: integration.name,
          ...results,
          staleRecordsDeleted: staleDeleted,
        });
      }

      // Run UUID backfill after all syncs complete
      console.log('Running UUID relationship backfill...');
      const { error: backfillError } = await supabase.rpc('backfill_contact_uuids');
      if (backfillError) {
        console.error('UUID backfill error:', backfillError);
      } else {
        console.log('UUID backfill completed successfully');
      }

      console.log('\n========== Full multi-company sync complete! ==========');

      // Calculate totals
      const totals = allResults.reduce((acc, r) => ({
        contacts: acc.contacts + r.contacts,
        opportunities: acc.opportunities + r.opportunities,
        appointments: acc.appointments + r.appointments,
        users: acc.users + r.users,
        pipelines: acc.pipelines + r.pipelines,
        conversations: acc.conversations + r.conversations,
        tasks: acc.tasks + r.tasks,
        callLogs: acc.callLogs + r.callLogs,
        staleRecordsDeleted: acc.staleRecordsDeleted + r.staleRecordsDeleted,
      }), {
        contacts: 0,
        opportunities: 0,
        appointments: 0,
        users: 0,
        pipelines: 0,
        conversations: 0,
        tasks: 0,
        callLogs: 0,
        staleRecordsDeleted: 0,
      });

      return new Response(JSON.stringify({
        mode: 'multi-company',
        integrations: allResults,
        totals,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // NO LEGACY FALLBACK - GHL integrations must be configured in the database
    throw new Error(
      'No GHL integrations configured. ' +
      'Please add GHL integrations in Admin Settings → GHL tab. ' +
      'Environment variable fallback has been removed.'
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in GHL sync:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
