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
  salesperson_id: string | null;
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

    const { connectionId, direction, backfill, companyId } = await req.json().catch(() => ({}));

    // Handle backfill mode - create leads for existing orphaned appointments
    if (backfill && companyId) {
      console.log(`Starting backfill for company: ${companyId}`);
      const result = await backfillOrphanedAppointments(supabase, companyId);
      return new Response(JSON.stringify({ success: true, ...result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

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

// Backfill orphaned appointments (Google Calendar appointments without linked contacts)
// deno-lint-ignore no-explicit-any
async function backfillOrphanedAppointments(supabase: any, companyId: string) {
  // Get mapping settings
  const mappingSettings = await getMappingSettings(supabase, companyId);
  
  if (!mappingSettings?.enabled) {
    return { error: 'Calendar mapping is not enabled. Please enable it first.', leadsCreated: 0 };
  }

  // Find orphaned appointments (Google Calendar source, no contact_uuid linked)
  const { data: orphanedAppointments, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('company_id', companyId)
    .eq('sync_source', 'google')
    .is('contact_uuid', null);

  if (error) {
    console.error('Error fetching orphaned appointments:', error);
    return { error: error.message, leadsCreated: 0 };
  }

  console.log(`Found ${orphanedAppointments?.length || 0} orphaned appointments to backfill`);

  let leadsCreated = 0;
  const errors: string[] = [];

  for (const apt of orphanedAppointments || []) {
    try {
      // Create a mock Google event from the stored appointment data
      const mockEvent = {
        id: apt.google_event_id,
        summary: apt.title,
        description: apt.notes,
        location: apt.address,
        start: { dateTime: apt.start_time },
        end: { dateTime: apt.end_time },
        status: 'confirmed',
        updated: apt.updated_at,
      };

      // Get connection info for this appointment
      const { data: connection } = await supabase
        .from('google_calendar_connections')
        .select('*')
        .eq('company_id', companyId)
        .eq('calendar_id', apt.google_calendar_id)
        .single();

      if (!connection) {
        // Use a minimal connection object
        const minimalConnection: CalendarConnection = {
          id: '',
          company_id: companyId,
          calendar_id: apt.google_calendar_id || '',
          sync_direction: 'import',
          last_sync_at: null,
          salesperson_id: null,
        };
        
        const created = await createLeadFromEvent(supabase, mockEvent, minimalConnection, mappingSettings, apt.id);
        if (created) leadsCreated++;
      } else {
        const created = await createLeadFromEvent(supabase, mockEvent, connection, mappingSettings, apt.id);
        if (created) leadsCreated++;
      }
    } catch (err) {
      console.error(`Error backfilling appointment ${apt.id}:`, err);
      errors.push(`${apt.title}: ${String(err)}`);
    }
  }

  console.log(`Backfill complete: ${leadsCreated} leads created`);
  return { 
    leadsCreated, 
    totalProcessed: orphanedAppointments?.length || 0,
    errors: errors.length > 0 ? errors : undefined 
  };
}

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
  
  // Track address-related patterns for later combining
  const addressPatternFields: { contact_field: string | null; opportunity_field: string | null } = {
    contact_field: null,
    opportunity_field: null
  };

  // Standard address field keywords to auto-detect for combining
  const addressKeywords = ['address', 'city', 'state', 'zip', 'zipcode', 'postal'];

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
      const isAddressField = addressKeywords.includes(patternLower);
      
      if (combineAddress && isAddressField) {
        addressParts[patternLower] = value;
        // Store the target fields from the address pattern
        if (patternLower === 'address') {
          addressPatternFields.contact_field = pattern.contact_field;
          addressPatternFields.opportunity_field = pattern.opportunity_field;
        }
      } else {
        // Not an address field OR combine is disabled - assign directly
        if (pattern.contact_field) {
          contactData[pattern.contact_field] = value;
        }
        if (pattern.opportunity_field) {
          opportunityData[pattern.opportunity_field] = value;
        }
      }
    }
  }

  // If combine_address is enabled, also auto-extract common address fields NOT in patterns
  if (combineAddress) {
    for (const keyword of addressKeywords) {
      if (!addressParts[keyword]) {
        // Try to extract this field from the description even if not explicitly in patterns
        const regex = new RegExp(`${keyword}:\\s*(.+?)(?:\\n|$)`, 'i');
        const match = description.match(regex);
        if (match && match[1]) {
          addressParts[keyword] = match[1].trim();
          console.log(`Auto-detected ${keyword}: "${addressParts[keyword]}"`);
        }
      }
    }
  }

  // Combine address fields if enabled and we have any address parts
  if (combineAddress && Object.keys(addressParts).length > 0) {
    const combinedAddress = [
      addressParts.address,
      addressParts.city,
      addressParts.state,
      addressParts.zip || addressParts.zipcode || addressParts.postal
    ].filter(Boolean).join(', ');
    
    if (combinedAddress) {
      console.log(`Combined address: "${combinedAddress}" -> opportunity_field: ${addressPatternFields.opportunity_field}`);
      if (addressPatternFields.opportunity_field) {
        opportunityData[addressPatternFields.opportunity_field] = combinedAddress;
      }
      if (addressPatternFields.contact_field) {
        contactData[addressPatternFields.contact_field] = combinedAddress;
      }
    }
  }

  console.log('Parsed description fields:', { contactData, opportunityData, addressParts });
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

  // Helper to check if a string is an invalid name (email-like, response status, etc.)
  const isInvalidName = (name: string | null): boolean => {
    if (!name) return true;
    const trimmed = name.trim().toLowerCase();
    // Filter out email-like strings, response statuses, and empty values
    return (
      trimmed.includes('@') ||
      trimmed.startsWith('(') ||
      trimmed === 'decline' ||
      trimmed === '(decline)' ||
      trimmed === 'accepted' ||
      trimmed === '(accepted)' ||
      trimmed === 'tentative' ||
      trimmed === '(tentative)' ||
      trimmed === 'needsaction' ||
      trimmed === '(needsaction)' ||
      trimmed.length === 0
    );
  };

  // Set defaults if not mapped
  if (!contactData.contact_name && (contactData.first_name || contactData.last_name)) {
    contactData.contact_name = `${contactData.first_name || ''} ${contactData.last_name || ''}`.trim();
  }
  // Only use event.summary as fallback if it's a valid name
  if (!contactData.contact_name && event.summary && !isInvalidName(event.summary)) {
    contactData.contact_name = event.summary;
  }
  // If still no contact name, try attendee display name
  if (!contactData.contact_name && event.attendees?.[0]?.displayName && !isInvalidName(event.attendees[0].displayName)) {
    contactData.contact_name = event.attendees[0].displayName;
  }
  
  if (!opportunityData.name && contactData.contact_name && !isInvalidName(contactData.contact_name)) {
    opportunityData.name = contactData.contact_name;
  }
  // Use summary only if valid, otherwise try to create from attendee info
  if (!opportunityData.name && event.summary && !isInvalidName(event.summary)) {
    opportunityData.name = event.summary;
  }
  // Last resort: generate a placeholder name with date
  if (!opportunityData.name || isInvalidName(opportunityData.name)) {
    const eventDate = event.start?.dateTime || event.start?.date || new Date().toISOString();
    opportunityData.name = `Calendar Lead - ${new Date(eventDate).toLocaleDateString()}`;
    console.log(`Generated fallback opportunity name: ${opportunityData.name}`);
  }

  let contactId: string | null = null;

  // Create contact if enabled
  if (settings.create_contact && contactData.contact_name) {
    contactId = generateLocalId('contact');
    const { data: insertedContact, error: contactError } = await supabase.from('contacts').insert({
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
    }).select('id').single();

    if (contactError) {
      console.error('Error creating contact:', contactError);
      return false;
    }
    console.log(`Created contact: ${contactId} with UUID: ${insertedContact?.id}`);

    // Link appointment to contact (both contact_id and contact_uuid)
    await supabase.from('appointments').update({ 
      contact_id: contactId,
      contact_uuid: insertedContact?.id 
    }).eq('id', appointmentId);
  }

  // Create opportunity if enabled
  if (settings.create_opportunity && opportunityData.name) {
    const opportunityId = generateLocalId('opp');
    const oppInsertData: Record<string, unknown> = {
      ghl_id: opportunityId,
      location_id: 'google-calendar',
      contact_id: contactId,
      name: opportunityData.name,
      status: 'open',
      pipeline_id: settings.default_pipeline_id,
      pipeline_stage_id: settings.default_stage_id,
      address: opportunityData.address || event.location,
      scope_of_work: opportunityData.scope_of_work || opportunityData.notes || event.description,
      ghl_date_added: new Date().toISOString(),
      provider: 'google',
      company_id: connection.company_id,
    };
    
    // Link to salesperson if connection has one
    if (connection.salesperson_id) {
      oppInsertData.salesperson_id = connection.salesperson_id;
    }
    
    const { error: oppError } = await supabase.from('opportunities').insert(oppInsertData);

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

    const appointmentData: Record<string, unknown> = { 
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
    
    // Link to salesperson if connection has one
    if (connection.salesperson_id) {
      appointmentData.salesperson_id = connection.salesperson_id;
    }

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
