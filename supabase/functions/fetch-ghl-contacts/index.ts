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

async function fetchAppointments(ghlApiKey: string, locationId: string): Promise<any[]> {
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
    return [];
  }

  const calendarsData = await calendarsResponse.json();
  const calendars = calendarsData.calendars || [];
  console.log(`Found ${calendars.length} calendars`);

  if (calendars.length === 0) {
    return [];
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
  return allAppointments;
}

async function fetchConversations(ghlApiKey: string, locationId: string): Promise<any[]> {
  console.log('Fetching GHL conversations...');
  const allConversations: any[] = [];
  const seenIds = new Set<string>();
  let lastMessageId: string | undefined;
  let hasMore = true;

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
    for (const conv of conversations) {
      if (!seenIds.has(conv.id)) {
        seenIds.add(conv.id);
        allConversations.push(conv);
        newCount++;
        lastMessageId = conv.lastMessageId;
      }
    }

    console.log(`Conversations batch: ${newCount} new, total: ${allConversations.length}`);

    if (conversations.length < 100 || allConversations.length >= 5000) {
      hasMore = false;
    }
  }

  console.log(`Fetched ${allConversations.length} total conversations`);
  return allConversations;
}

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

    // Fetch all data in parallel (including pipelines for name resolution)
    console.log('Starting full GHL sync...');
    const [contacts, opportunities, appointments, users, pipelines, conversations] = await Promise.all([
      fetchAllFromGHL('contacts/', ghlApiKey, locationId, 'contacts'),
      fetchOpportunities(ghlApiKey, locationId),
      fetchAppointments(ghlApiKey, locationId),
      fetchUsers(ghlApiKey, locationId),
      fetchPipelines(ghlApiKey, locationId),
      fetchConversations(ghlApiKey, locationId),
    ]);

    // Build pipeline/stage lookup maps
    const { pipelineNames, stageNames } = buildPipelineLookups(pipelines);

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

    // Sync contacts
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
      }));

      for (let i = 0; i < contactsToUpsert.length; i += 100) {
        const batch = contactsToUpsert.slice(i, i + 100);
        const { error } = await supabase.from('contacts').upsert(batch, { onConflict: 'ghl_id' });
        if (error) console.error('Contacts upsert error:', error);
      }
    }

    // Sync opportunities with resolved pipeline/stage names
    if (opportunities.length > 0) {
      console.log(`Syncing ${opportunities.length} opportunities...`);
      const oppsToUpsert = opportunities.map(o => ({
        ghl_id: o.id,
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
      }));

      for (let i = 0; i < oppsToUpsert.length; i += 100) {
        const batch = oppsToUpsert.slice(i, i + 100);
        const { error } = await supabase.from('opportunities').upsert(batch, { onConflict: 'ghl_id' });
        if (error) console.error('Opportunities upsert error:', error);
      }
    }

    // Sync appointments
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
        ghl_date_added: a.dateAdded || a.createdAt || null,
        ghl_date_updated: a.dateUpdated || a.updatedAt || null,
      }));

      for (let i = 0; i < apptsToUpsert.length; i += 100) {
        const batch = apptsToUpsert.slice(i, i + 100);
        const { error } = await supabase.from('appointments').upsert(batch, { onConflict: 'ghl_id' });
        if (error) console.error('Appointments upsert error:', error);
      }
    }

    // Sync conversations
    if (conversations.length > 0) {
      console.log(`Syncing ${conversations.length} conversations...`);
      
      // Helper to convert Unix timestamp (ms) to ISO string
      const toISODate = (val: any): string | null => {
        if (!val) return null;
        // If it's a number (Unix timestamp in ms), convert it
        if (typeof val === 'number') {
          return new Date(val).toISOString();
        }
        // If it's already a string, return as-is (assume ISO format)
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
      }));

      for (let i = 0; i < convsToUpsert.length; i += 100) {
        const batch = convsToUpsert.slice(i, i + 100);
        const { error } = await supabase.from('conversations').upsert(batch, { onConflict: 'ghl_id' });
        if (error) console.error('Conversations upsert error:', error);
      }
    }

    console.log('Full sync complete!');

    return new Response(JSON.stringify({
      meta: {
        contacts: contacts.length,
        opportunities: opportunities.length,
        appointments: appointments.length,
        users: users.length,
        pipelines: pipelines.length,
        conversations: conversations.length,
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
