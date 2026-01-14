import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

// Sync data for a single GHL location
async function syncLocationData(
  supabase: any,
  ghlApiKey: string,
  locationId: string,
  locationLabel: string
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
  console.log(`\n========== Starting sync for ${locationLabel} (${locationId}) ==========`);

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

  // Sync contacts with last_synced_at tracking
  if (contacts.length > 0) {
    console.log(`Syncing ${contacts.length} contacts...`);
    const contactsToUpsert = contacts.map(c => ({
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
      last_synced_at: syncTimestamp,
    }));

    for (let i = 0; i < contactsToUpsert.length; i += 100) {
      const batch = contactsToUpsert.slice(i, i + 100);
      const { error } = await supabase.from('contacts').upsert(batch, { onConflict: 'ghl_id' });
      if (error) console.error('Contacts upsert error:', error);
    }
  }

  // Sync opportunities with last_synced_at tracking
  // IMPORTANT: Preserve won_at field - NEVER overwrite manually set won_at during sync
  if (opportunities.length > 0) {
    console.log(`Syncing ${opportunities.length} opportunities...`);
    
    // Fetch ALL existing opportunity data to preserve won_at values
    // We need to fetch in batches if there are many opportunities
    const oppGhlIds = opportunities.map(o => o.id);
    const existingWonAtMap = new Map<string, { won_at: string | null; status: string | null; scope_of_work: string | null; address: string | null }>();
    
    // Fetch in batches of 100 to avoid query limits
    for (let i = 0; i < oppGhlIds.length; i += 100) {
      const batchIds = oppGhlIds.slice(i, i + 100);
      const { data: existingOpps, error: fetchError } = await supabase
        .from('opportunities')
        .select('ghl_id, won_at, status, scope_of_work, address')
        .in('ghl_id', batchIds);
      
      if (fetchError) {
        console.error('Error fetching existing opportunities for preservation:', fetchError);
      }
      
      (existingOpps || []).forEach((opp: { ghl_id: string; won_at: string | null; status: string | null; scope_of_work: string | null; address: string | null }) => {
        existingWonAtMap.set(opp.ghl_id, { won_at: opp.won_at, status: opp.status, scope_of_work: opp.scope_of_work, address: opp.address });
      });
    }
    
    console.log(`Found ${existingWonAtMap.size} existing opportunities with potential values to preserve`);
    
    // Build a map of contact IDs to their custom_fields for scope extraction
    const contactCustomFieldsMap = new Map<string, any[]>();
    contacts.forEach(c => {
      if (c.id && c.customFields && Array.isArray(c.customFields)) {
        contactCustomFieldsMap.set(c.id, c.customFields);
      }
    });
    console.log(`Built contact custom fields map for ${contactCustomFieldsMap.size} contacts`);
    
    const oppsToUpsert = opportunities.map(o => {
      const existing = existingWonAtMap.get(o.id);
      
      // Determine won_at value:
      // 1. If already has won_at in DB, ALWAYS preserve it (never overwrite manual edits)
      // 2. If status is 'won' in GHL and we have no won_at, only set it for NEW won opportunities
      // 3. Otherwise, leave it as-is (null or existing value)
      let wonAt: string | null = existing?.won_at || null;
      
      if (existing?.won_at) {
        // ALWAYS preserve existing won_at - this is critical for manual edits
        wonAt = existing.won_at;
        console.log(`Preserving won_at for ${o.id}: ${wonAt}`);
      } else if (o.status === 'won' && !existing?.won_at) {
        // Only set won_at if this is a newly won opportunity without an existing won_at
        // Use current time, NOT GHL updatedAt (which changes on any edit)
        wonAt = new Date().toISOString();
        console.log(`Setting new won_at for ${o.id}: ${wonAt}`);
      }
      
      // Determine status value:
      // 1. If won_at is set (manually marked as won), ALWAYS preserve 'won' status
      // 2. If local status differs from GHL status, preserve local status (manual edit)
      // 3. Otherwise use GHL status
      let finalStatus = o.status || null;
      
      if (wonAt) {
        // Won opportunities always stay won
        finalStatus = 'won';
        if (o.status !== 'won') {
          console.log(`Preserving 'won' status for ${o.id} (has won_at: ${wonAt}) despite GHL status: ${o.status}`);
        }
      } else if (existing?.status && existing.status !== o.status) {
        // Local status differs from GHL - preserve local status (manual edit)
        // This prevents sync from reverting manually changed statuses
        finalStatus = existing.status;
        console.log(`Preserving local status '${existing.status}' for ${o.id} (GHL has: ${o.status})`);
      }
      
      // Extract scope_of_work and address from contact's custom_fields
      // Only set if not already in opportunity (preserve existing values)
      let scopeOfWork: string | null = existing?.scope_of_work || null;
      let opportunityAddress: string | null = existing?.address || null;
      
      const contactCustomFields = contactCustomFieldsMap.get(o.contactId);
      if (contactCustomFields) {
        // Scope of work (field ID: KwQRtJT0aMSHnq3mwR68) - only if not already set
        if (!scopeOfWork) {
          const scopeField = contactCustomFields.find(
            (field: { id: string; value?: string }) => field.id === 'KwQRtJT0aMSHnq3mwR68'
          );
          if (scopeField && scopeField.value) {
            scopeOfWork = scopeField.value;
          }
        }
        
        // Address (field ID: b7oTVsUQrLgZt84bHpCn) - only if not already set
        if (!opportunityAddress) {
          const addressField = contactCustomFields.find(
            (field: { id: string; value?: string }) => field.id === 'b7oTVsUQrLgZt84bHpCn'
          );
          if (addressField && addressField.value) {
            opportunityAddress = addressField.value;
          }
        }
      }
      
      return {
        ghl_id: o.id,
        location_id: o.locationId || locationId,
        contact_id: o.contactId || null,
        pipeline_id: o.pipelineId || null,
        pipeline_stage_id: o.pipelineStageId || null,
        pipeline_name: pipelineNames.get(o.pipelineId) || null,
        stage_name: stageNames.get(o.pipelineStageId) || o.status || null,
        name: o.name || null,
        monetary_value: o.monetaryValue || null,
        status: finalStatus,
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
  if (appointments.length > 0) {
    console.log(`Syncing ${appointments.length} appointments...`);
    const apptsToUpsert = appointments.map(a => ({
      ghl_id: a.id,
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
    }));

    for (let i = 0; i < apptsToUpsert.length; i += 100) {
      const batch = apptsToUpsert.slice(i, i + 100);
      const { error } = await supabase.from('appointments').upsert(batch, { onConflict: 'ghl_id' });
      if (error) console.error('Appointments upsert error:', error);
    }
  }

  // Sync conversations with last_synced_at tracking
  if (conversations.length > 0) {
    console.log(`Syncing ${conversations.length} conversations...`);
    
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

    const convsToUpsert = conversations.map(c => ({
      ghl_id: c.id,
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
    }));

    for (let i = 0; i < convsToUpsert.length; i += 100) {
      const batch = convsToUpsert.slice(i, i + 100);
      const { error } = await supabase.from('conversations').upsert(batch, { onConflict: 'ghl_id' });
      if (error) console.error('Conversations upsert error:', error);
    }
  }

  // Sync tasks with last_synced_at tracking
  if (tasks.length > 0) {
    console.log(`Syncing ${tasks.length} tasks...`);
    const tasksToUpsert = tasks.map(t => ({
      ghl_id: t.id,
      location_id: locationId,
      contact_id: t.contactId,
      title: t.title || 'Untitled Task',
      body: t.body || null,
      assigned_to: t.assignedTo || null,
      due_date: t.dueDate || null,
      completed: t.completed || false,
      last_synced_at: syncTimestamp,
    }));

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

// Run stale record cleanup for a specific location
async function cleanupStaleRecords(
  supabase: any,
  locationId: string,
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

  // Cleanup contacts (only if we fetched enough)
  if (counts.contacts >= minRecordsForCleanup.contacts) {
    const { data: staleContacts, error: staleContactsErr } = await supabase
      .from('contacts')
      .select('ghl_id')
      .eq('location_id', locationId)
      .lt('last_synced_at', staleThreshold);
    
    if (!staleContactsErr && staleContacts && staleContacts.length > 0) {
      console.log(`Found ${staleContacts.length} stale contacts`);
      const { error: delErr } = await supabase
        .from('contacts')
        .delete()
        .eq('location_id', locationId)
        .lt('last_synced_at', staleThreshold);
      if (!delErr) totalDeleted += staleContacts.length;
      else console.error('Error deleting stale contacts:', delErr);
    }
  }

  // Cleanup opportunities (only if we fetched enough)
  if (counts.opportunities >= minRecordsForCleanup.opportunities) {
    const { data: staleOpps, error: staleOppsErr } = await supabase
      .from('opportunities')
      .select('ghl_id')
      .eq('location_id', locationId)
      .lt('last_synced_at', staleThreshold);
    
    if (!staleOppsErr && staleOpps && staleOpps.length > 0) {
      console.log(`Found ${staleOpps.length} stale opportunities`);
      const { error: delErr } = await supabase
        .from('opportunities')
        .delete()
        .eq('location_id', locationId)
        .lt('last_synced_at', staleThreshold);
      if (!delErr) totalDeleted += staleOpps.length;
      else console.error('Error deleting stale opportunities:', delErr);
    }
  }

  // Cleanup appointments (only if we fetched enough)
  // IMPORTANT: Exclude local-only appointments (ghl_id starts with 'local_') from cleanup
  if (counts.appointments >= minRecordsForCleanup.appointments) {
    const { data: staleAppts, error: staleApptsErr } = await supabase
      .from('appointments')
      .select('ghl_id')
      .eq('location_id', locationId)
      .lt('last_synced_at', staleThreshold)
      .not('ghl_id', 'like', 'local_%');
    
    if (!staleApptsErr && staleAppts && staleAppts.length > 0) {
      console.log(`Found ${staleAppts.length} stale appointments (excluding local-only)`);
      const { error: delErr } = await supabase
        .from('appointments')
        .delete()
        .eq('location_id', locationId)
        .lt('last_synced_at', staleThreshold)
        .not('ghl_id', 'like', 'local_%');
      if (!delErr) totalDeleted += staleAppts.length;
      else console.error('Error deleting stale appointments:', delErr);
    }
  }

  // Cleanup tasks (only if we fetched enough)
  if (counts.tasks >= minRecordsForCleanup.tasks) {
    const { data: staleTasks, error: staleTasksErr } = await supabase
      .from('ghl_tasks')
      .select('ghl_id')
      .eq('location_id', locationId)
      .lt('last_synced_at', staleThreshold);
    
    if (!staleTasksErr && staleTasks && staleTasks.length > 0) {
      console.log(`Found ${staleTasks.length} stale tasks`);
      const { error: delErr } = await supabase
        .from('ghl_tasks')
        .delete()
        .eq('location_id', locationId)
        .lt('last_synced_at', staleThreshold);
      if (!delErr) totalDeleted += staleTasks.length;
      else console.error('Error deleting stale tasks:', delErr);
    }
  }

  // Cleanup conversations (only if we fetched enough)
  if (counts.conversations >= minRecordsForCleanup.conversations) {
    const { data: staleConvs, error: staleConvsErr } = await supabase
      .from('conversations')
      .select('ghl_id')
      .eq('location_id', locationId)
      .lt('last_synced_at', staleThreshold);
    
    if (!staleConvsErr && staleConvs && staleConvs.length > 0) {
      console.log(`Found ${staleConvs.length} stale conversations`);
      const { error: delErr } = await supabase
        .from('conversations')
        .delete()
        .eq('location_id', locationId)
        .lt('last_synced_at', staleThreshold);
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
    // Get credentials for Location 1 (primary)
    const ghlApiKey1 = Deno.env.get('GHL_API_KEY');
    const locationId1 = Deno.env.get('GHL_LOCATION_ID');
    
    // Get credentials for Location 2 (secondary)
    const ghlApiKey2 = Deno.env.get('GHL_API_KEY_2');
    const locationId2 = Deno.env.get('GHL_LOCATION_ID_2');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!ghlApiKey1 || !locationId1) {
      throw new Error('Missing GHL_API_KEY or GHL_LOCATION_ID for primary location');
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting multi-location GHL sync...');
    
    // Sync Location 1
    const location1Results = await syncLocationData(supabase, ghlApiKey1, locationId1, 'Location 1 (Primary)');
    
    // Cleanup stale records for Location 1
    const staleDeleted1 = await cleanupStaleRecords(supabase, locationId1, {
      contacts: location1Results.contacts,
      opportunities: location1Results.opportunities,
      appointments: location1Results.appointments,
      tasks: location1Results.tasks,
      conversations: location1Results.conversations,
    });

    // Sync Location 2 if credentials are available
    let location2Results = {
      contacts: 0,
      opportunities: 0,
      appointments: 0,
      users: 0,
      pipelines: 0,
      conversations: 0,
      tasks: 0,
      callLogs: 0,
    };
    let staleDeleted2 = 0;

    if (ghlApiKey2 && locationId2) {
      console.log('\nLocation 2 credentials found, syncing...');
      location2Results = await syncLocationData(supabase, ghlApiKey2, locationId2, 'Location 2 (Secondary)');
      
      staleDeleted2 = await cleanupStaleRecords(supabase, locationId2, {
        contacts: location2Results.contacts,
        opportunities: location2Results.opportunities,
        appointments: location2Results.appointments,
        tasks: location2Results.tasks,
        conversations: location2Results.conversations,
      });
    } else {
      console.log('\nNo Location 2 credentials found, skipping secondary sync.');
    }

    console.log('\n========== Full multi-location sync complete! ==========');

    return new Response(JSON.stringify({
      meta: {
        location1: {
          locationId: locationId1,
          ...location1Results,
          staleRecordsDeleted: staleDeleted1,
        },
        location2: ghlApiKey2 && locationId2 ? {
          locationId: locationId2,
          ...location2Results,
          staleRecordsDeleted: staleDeleted2,
        } : null,
        totals: {
          contacts: location1Results.contacts + location2Results.contacts,
          opportunities: location1Results.opportunities + location2Results.opportunities,
          appointments: location1Results.appointments + location2Results.appointments,
          users: location1Results.users + location2Results.users,
          pipelines: location1Results.pipelines + location2Results.pipelines,
          conversations: location1Results.conversations + location2Results.conversations,
          tasks: location1Results.tasks + location2Results.tasks,
          callLogs: location1Results.callLogs + location2Results.callLogs,
          staleRecordsDeleted: staleDeleted1 + staleDeleted2,
        }
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in GHL sync:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
