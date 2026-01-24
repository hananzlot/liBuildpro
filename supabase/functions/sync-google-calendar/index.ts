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
  let imported = 0, exported = 0;

  if (syncDir === 'import' || syncDir === 'bidirectional') imported = await importFromGoogle(supabase, connection, access_token);
  if (syncDir === 'export' || syncDir === 'bidirectional') exported = await exportToGoogle(supabase, connection, access_token);

  await supabase.from('google_calendar_connections').update({ last_sync_at: new Date().toISOString(), sync_error: null }).eq('id', connection.id);
  return { imported, exported };
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
async function importFromGoogle(supabase: any, connection: CalendarConnection, accessToken: string) {
  const timeMin = new Date(); timeMin.setDate(timeMin.getDate() - 30);
  const timeMax = new Date(); timeMax.setDate(timeMax.getDate() + 60);
  const params = new URLSearchParams({ timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: '250' });
  if (connection.last_sync_at) params.set('updatedMin', connection.last_sync_at);

  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(connection.calendar_id)}/events?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error(`Failed to fetch events: ${await response.text()}`);

  const eventsData: GoogleEventsResponse = await response.json();
  let imported = 0;

  for (const event of eventsData.items || []) {
    if (event.status === 'cancelled') { await supabase.from('appointments').delete().eq('google_event_id', event.id).eq('company_id', connection.company_id); continue; }
    const startTime = event.start?.dateTime || event.start?.date;
    if (!startTime) continue;

    const { data: existing } = await supabase.from('appointments').select('id, updated_at').eq('google_event_id', event.id).eq('company_id', connection.company_id).single();
    if (existing && new Date(existing.updated_at) > new Date(event.updated)) continue;

    const appointmentData = { company_id: connection.company_id, google_event_id: event.id, google_calendar_id: connection.calendar_id, sync_source: 'google', title: event.summary || 'Untitled Event', notes: event.description || null, address: event.location || null, start_time: startTime, end_time: event.end?.dateTime || event.end?.date, location_id: 'google-calendar', updated_at: new Date().toISOString() };

    if (existing) await supabase.from('appointments').update(appointmentData).eq('id', existing.id);
    else await supabase.from('appointments').insert(appointmentData);
    imported++;
  }
  return imported;
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
