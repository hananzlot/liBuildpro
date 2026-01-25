import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GoogleEvent {
  id: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  location?: string;
  status: string;
  updated: string;
  organizer?: { email?: string; displayName?: string };
  attendees?: { email?: string; displayName?: string; responseStatus?: string }[];
}

interface GoogleEventsResponse {
  items: GoogleEvent[];
}

interface CalendarConnection {
  id: string;
  company_id: string;
  calendar_id: string;
  sync_direction: string;
  last_sync_at: string | null;
}

interface Appointment {
  id: string;
  title: string;
  notes: string | null;
  address: string | null;
  start_time: string;
  end_time: string | null;
  google_event_id: string | null;
  updated_at: string;
}

interface FieldMapping {
  google_field: string;
  contact_field: string | null;
  opportunity_field: string | null;
}

interface DescriptionPattern {
  id: string;
  pattern: string;
  contact_field: string | null;
  opportunity_field: string | null;
}

interface CalendarMappingSettings {
  enabled: boolean;
  create_contact: boolean;
  create_opportunity: boolean;
  default_pipeline_id: string | null;
  default_stage_id: string | null;
  mappings: FieldMapping[];
  parse_description: boolean;
  description_patterns: DescriptionPattern[];
  combine_address_fields: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    // deno-lint-ignore no-explicit-any
    const supabase: any = createClient(supabaseUrl, supabaseServiceKey);

    const { connectionId, direction } = await req.json().catch(() => ({}));

    let connectionsQuery = supabase
      .from('google_calendar_connections')
      .select('*')
      .eq('is_active', true);

    if (connectionId) {
      connectionsQuery = connectionsQuery.eq('id', connectionId);
    }

    const { data: connections, error: connError } = await connectionsQuery;

    if (connError || !connections?.length) {
      return new Response(
        JSON.stringify({ message: 'No active connections to sync' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Syncing ${connections.length} Google Calendar connections...`);
    const results = [];

    for (const conn of connections as CalendarConnection[]) {
      try {
        const result = await syncConnection(supabase, conn, direction);
        results.push({ connectionId: conn.id, ...result });
      } catch (error) {
        console.error(`Error syncing ${conn.id}:`, error);
        results.push({ connectionId: conn.id, error: String(error), imported: 0, exported: 0 });
        await supabase.from('google_calendar_connections').update({ sync_error: String(error) }).eq('id', conn.id);
      }
    }

    return new Response(JSON.stringify({ success: true, results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

// deno-lint-ignore no-explicit-any
async function syncConnection(supabase: any, connection: CalendarConnection, direction?: string) {
  const tokenResult = await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/get_google_oauth_tokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}` },
    body: JSON.stringify({ p_connection_id: connection.id }),
  });

  const tokensData = await tokenResult.json();
  if (!tokensData?.length) throw new Error('No tokens found');

  let { access_token, refresh_token, token_expires_at } = tokensData[0];

  if (new Date(token_expires_at) <= new Date()) {
    access_token = await refreshAccessToken(supabase, connection, refresh_token);
  }

  const syncDir = direction || connection.sync_direction || 'bidirectional';
  let imported = 0, exported = 0, leadsCreated = 0;

  if (syncDir === 'import' || syncDir === 'bidirectional') {
    const importResult = await importFromGoogle(supabase, connection, access_token);
    imported = importResult.imported;
    leadsCreated = importResult.leadsCreated;
  }
  if (syncDir === 'export' || syncDir === 'bidirectional') exported = await exportToGoogle(supabase, connection, access_token);

  await supabase.from('google_calendar_connections').update({ last_sync_at: new Date().toISOString(), sync_error: null }).eq('id', connection.id);
  return { imported, exported, leadsCreated };
}

// deno-lint-ignore no-explicit-any
async function refreshAccessToken(supabase: any, connection: CalendarConnection, refreshToken: string) {
  const { data: clientIdSetting } = await supabase.from('company_settings').select('setting_value').eq('company_id', connection.company_id).eq('setting_key', 'google_client_id').single();
  const { data: clientSecretSetting } = await supabase.from('company_settings').select('setting_value').eq('company_id', connection.company_id).eq('setting_key', 'google_client_secret').single();

  if (!clientIdSetting?.setting_value || !clientSecretSetting?.setting_value) throw new Error('Google credentials not configured');

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientIdSetting.setting_value, client_secret: clientSecretSetting.setting_value, refresh_token: refreshToken, grant_type: 'refresh_token' }),
  });

  const data = await response.json();
  await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/store_google_oauth_tokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}` },
    body: JSON.stringify({ p_connection_id: connection.id, p_access_token: data.access_token, p_refresh_token: null, p_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString() }),
  });

  return data.access_token;
}

// deno-lint-ignore no-explicit-any
async function getMappingSettings(supabase: any, companyId: string): Promise<CalendarMappingSettings | null> {
  const { data } = await supabase
    .from('company_settings')
    .select('setting_value')
    .eq('company_id', companyId)
    .eq('setting_key', 'calendar_opportunity_mappings')
    .single();

  if (!data?.setting_value) return null;
  
  try {
    return JSON.parse(data.setting_value);
  } catch {
    return null;
  }
}

function extractFieldValue(event: GoogleEvent, fieldName: string): string | null {
  switch (fieldName) {
    case 'summary':
      return event.summary || null;
    case 'description':
      return event.description || null;
    case 'location':
      return event.location || null;
    case 'organizer_email':
      return event.organizer?.email || null;
    case 'attendee_name':
      return event.attendees?.[0]?.displayName || null;
    case 'attendee_email':
      return event.attendees?.[0]?.email || null;
    default:
      return null;
  }
}

function generateLocalId(prefix: string): string {
  return `local_${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Parse structured fields from event description (e.g., "NAME: John Doe")
function parseDescriptionFields(
  description: string,
  patterns: DescriptionPattern[],
  combineAddress: boolean
): { contactData: Record<string, string>, opportunityData: Record<string, string> } {
  const contactData: Record<string, string> = {};
  const opportunityData: Record<string, string> = {};
  const addressParts: Record<string, string> = {};

  for (const pattern of patterns) {
    if (!pattern.pattern) continue;
    
    // Escape special regex chars in the pattern key
    const escapedPattern = pattern.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match "PATTERN: value" or "PATTERN value" until newline or end
    const regex = new RegExp(`${escapedPattern}\\s*(.+?)(?:\\n|$)`, 'i');
    const match = description.match(regex);
    
    if (match && match[1]) {
      const value = match[1].trim();
      
      // Check if this is an address-related pattern for combining
      const patternLower = pattern.pattern.toLowerCase().replace(/[:\s]/g, '');
      if (combineAddress && ['address', 'city', 'state', 'zip'].includes(patternLower)) {
        addressParts[patternLower] = value;
      } else {
        if (pattern.contact_field) {
          contactData[pattern.contact_field] = value;
        }
        if (pattern.opportunity_field) {
          opportunityData[pattern.opportunity_field] = value;
        }
      }
    }
  }

  // Combine address fields if enabled
  if (combineAddress && Object.keys(addressParts).length > 0) {
    const combinedAddress = [
      addressParts.address,
      addressParts.city,
      addressParts.state,
      addressParts.zip
    ].filter(Boolean).join(', ');
    
    if (combinedAddress) {
      // Find which field the address should go to from patterns
      const addressPattern = patterns.find(p => 
        p.pattern.toLowerCase().replace(/[:\s]/g, '') === 'address'
      );
      if (addressPattern?.opportunity_field) {
        opportunityData[addressPattern.opportunity_field] = combinedAddress;
      }
      if (addressPattern?.contact_field) {
        contactData[addressPattern.contact_field] = combinedAddress;
      }
    }
  }

  console.log('Parsed description fields:', { contactData, opportunityData });
  return { contactData, opportunityData };
}

// deno-lint-ignore no-explicit-any
async function createLeadFromEvent(supabase: any, event: GoogleEvent, connection: CalendarConnection, settings: CalendarMappingSettings, appointmentId: string): Promise<boolean> {
  console.log(`Creating lead from event: ${event.summary}`);
  
  // Build contact data from mappings
  const contactData: Record<string, string | null> = {
    first_name: null,
    last_name: null,
    contact_name: null,
    email: null,
    phone: null,
  };

  // Build opportunity data from mappings
  const opportunityData: Record<string, string | null> = {
    name: null,
    scope_of_work: null,
    address: null,
    notes: null,
  };

  // Apply event field mappings first
  for (const mapping of settings.mappings) {
    const value = extractFieldValue(event, mapping.google_field);
    if (!value) continue;

    if (mapping.contact_field && settings.create_contact) {
      contactData[mapping.contact_field] = value;
    }
    if (mapping.opportunity_field && settings.create_opportunity) {
      opportunityData[mapping.opportunity_field] = value;
    }
  }

  // Parse description patterns if enabled (overrides event field mappings)
  if (settings.parse_description && event.description && settings.description_patterns?.length) {
    const parsed = parseDescriptionFields(
      event.description,
      settings.description_patterns,
      settings.combine_address_fields ?? true
    );
    
    // Apply parsed contact data
    for (const [field, value] of Object.entries(parsed.contactData)) {
      if (value && settings.create_contact) {
        contactData[field] = value;
      }
    }
    
    // Apply parsed opportunity data
    for (const [field, value] of Object.entries(parsed.opportunityData)) {
      if (value && settings.create_opportunity) {
        opportunityData[field] = value;
      }
    }
  }

  // Set defaults if not mapped
  if (!contactData.contact_name && (contactData.first_name || contactData.last_name)) {
    contactData.contact_name = `${contactData.first_name || ''} ${contactData.last_name || ''}`.trim();
  }
  if (!contactData.contact_name && event.summary) {
    contactData.contact_name = event.summary;
  }
  if (!opportunityData.name && contactData.contact_name) {
    opportunityData.name = contactData.contact_name;
  }
  if (!opportunityData.name && event.summary) {
    opportunityData.name = event.summary;
  }

  let contactId: string | null = null;

  // Create contact if enabled
  if (settings.create_contact && contactData.contact_name) {
    contactId = generateLocalId('contact');
    const { error: contactError } = await supabase.from('contacts').insert({
      ghl_id: contactId,
      location_id: 'google-calendar',
      first_name: contactData.first_name,
      last_name: contactData.last_name,
      contact_name: contactData.contact_name,
      email: contactData.email,
      phone: contactData.phone,
      source: 'Google Calendar',
      ghl_date_added: new Date().toISOString(),
      provider: 'google',
      company_id: connection.company_id,
    });

    if (contactError) {
      console.error('Error creating contact:', contactError);
      return false;
    }
    console.log(`Created contact: ${contactId}`);

    // Link appointment to contact
    await supabase.from('appointments').update({ contact_id: contactId }).eq('id', appointmentId);
  }

  // Create opportunity if enabled
  if (settings.create_opportunity && opportunityData.name) {
    const opportunityId = generateLocalId('opp');
    const { error: oppError } = await supabase.from('opportunities').insert({
      ghl_id: opportunityId,
      location_id: 'google-calendar',
      contact_id: contactId,
      name: opportunityData.name,
      status: 'open',
      pipeline_id: settings.default_pipeline_id,
      pipeline_stage_id: settings.default_stage_id,
      address: opportunityData.address || event.location,
      scope_of_work: opportunityData.scope_of_work || event.description,
      notes: opportunityData.notes,
      ghl_date_added: new Date().toISOString(),
      provider: 'google',
      company_id: connection.company_id,
    });

    if (oppError) {
      console.error('Error creating opportunity:', oppError);
      return false;
    }
    console.log(`Created opportunity: ${opportunityId}`);
  }

  return true;
}

// deno-lint-ignore no-explicit-any
async function importFromGoogle(supabase: any, connection: CalendarConnection, accessToken: string) {
  const timeMin = new Date(); timeMin.setDate(timeMin.getDate() - 30);
  const timeMax = new Date(); timeMax.setDate(timeMax.getDate() + 60);
  const params = new URLSearchParams({ timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: '250' });
  if (connection.last_sync_at) params.set('updatedMin', connection.last_sync_at);

  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(connection.calendar_id)}/events?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error(`Failed to fetch events: ${await response.text()}`);

  const eventsData: GoogleEventsResponse = await response.json();
  let imported = 0;
  let leadsCreated = 0;

  // Get mapping settings
  const mappingSettings = await getMappingSettings(supabase, connection.company_id);
  console.log(`Mapping settings enabled: ${mappingSettings?.enabled}`);

  for (const event of eventsData.items || []) {
    if (event.status === 'cancelled') { 
      await supabase.from('appointments').delete().eq('google_event_id', event.id).eq('company_id', connection.company_id); 
      continue; 
    }
    const startTime = event.start?.dateTime || event.start?.date;
    if (!startTime) continue;

    const { data: existing } = await supabase.from('appointments').select('id, updated_at, contact_id').eq('google_event_id', event.id).eq('company_id', connection.company_id).single();
    if (existing && new Date(existing.updated_at) > new Date(event.updated)) continue;

    const appointmentData = { 
      company_id: connection.company_id, 
      google_event_id: event.id, 
      google_calendar_id: connection.calendar_id, 
      sync_source: 'google', 
      title: event.summary || 'Untitled Event', 
      notes: event.description || null, 
      address: event.location || null, 
      start_time: startTime, 
      end_time: event.end?.dateTime || event.end?.date, 
      location_id: 'google-calendar', 
      updated_at: new Date().toISOString() 
    };

    let appointmentId: string;

    if (existing) {
      await supabase.from('appointments').update(appointmentData).eq('id', existing.id);
      appointmentId = existing.id;
    } else {
      const { data: newAppt } = await supabase.from('appointments').insert(appointmentData).select('id').single();
      appointmentId = newAppt?.id;
      
      // Create lead for NEW events only (not updates)
      if (mappingSettings?.enabled && appointmentId) {
        const created = await createLeadFromEvent(supabase, event, connection, mappingSettings, appointmentId);
        if (created) leadsCreated++;
      }
    }
    imported++;
  }
  
  return { imported, leadsCreated };
}

// deno-lint-ignore no-explicit-any
async function exportToGoogle(supabase: any, connection: CalendarConnection, accessToken: string) {
  let query = supabase.from('appointments').select('*').eq('company_id', connection.company_id).neq('sync_source', 'google');
  if (connection.last_sync_at) query = query.or(`google_event_id.is.null,updated_at.gt.${connection.last_sync_at}`);
  else query = query.is('google_event_id', null);

  const { data: appointments } = await query;
  let exported = 0;

  for (const apt of (appointments as Appointment[]) || []) {
    const eventData = { summary: apt.title || 'Appointment', description: apt.notes || '', location: apt.address || '', start: { dateTime: apt.start_time, timeZone: 'America/Los_Angeles' }, end: { dateTime: apt.end_time || apt.start_time, timeZone: 'America/Los_Angeles' } };

    const url = apt.google_event_id ? `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(connection.calendar_id)}/events/${apt.google_event_id}` : `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(connection.calendar_id)}/events`;
    const response = await fetch(url, { method: apt.google_event_id ? 'PUT' : 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(eventData) });

    if (response.ok) {
      const createdEvent = await response.json();
      await supabase.from('appointments').update({ google_event_id: createdEvent.id, google_calendar_id: connection.calendar_id, sync_source: 'local' }).eq('id', apt.id);
      exported++;
    }
  }
  return exported;
}
