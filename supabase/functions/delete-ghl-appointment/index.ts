import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to delete event from Google Calendar
async function deleteFromGoogleCalendar(
  supabase: any, 
  googleCalendarId: string, 
  googleEventId: string,
  companyId: string
): Promise<boolean> {
  try {
    console.log(`Attempting to delete Google Calendar event: ${googleEventId} from calendar: ${googleCalendarId}`);
    
    // Find the Google Calendar connection
    const { data: connection, error: connError } = await supabase
      .from('google_calendar_connections')
      .select('id, company_id')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .single();

    if (connError || !connection) {
      console.log('No active Google Calendar connection found for company');
      return false;
    }

    // Get OAuth tokens
    const { data: tokens, error: tokenError } = await supabase.rpc(
      'get_google_oauth_tokens',
      { p_connection_id: connection.id }
    );

    if (tokenError || !tokens || tokens.length === 0) {
      console.error('Failed to get Google OAuth tokens:', tokenError?.message);
      return false;
    }

    const { access_token, refresh_token, token_expires_at } = tokens[0];
    let currentAccessToken = access_token;

    // Check if token is expired and refresh if needed
    if (token_expires_at && new Date(token_expires_at) < new Date()) {
      console.log('Access token expired, refreshing...');
      
      // Get Google OAuth credentials from company settings
      const { data: clientIdSetting } = await supabase
        .from('company_settings')
        .select('setting_value')
        .eq('company_id', companyId)
        .eq('setting_key', 'google_client_id')
        .single();

      const { data: clientSecretSetting } = await supabase
        .from('company_settings')
        .select('setting_value')
        .eq('company_id', companyId)
        .eq('setting_key', 'google_client_secret')
        .single();

      if (!clientIdSetting?.setting_value || !clientSecretSetting?.setting_value) {
        console.error('Google OAuth credentials not configured');
        return false;
      }

      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientIdSetting.setting_value,
          client_secret: clientSecretSetting.setting_value,
          refresh_token: refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      if (!refreshResponse.ok) {
        console.error('Failed to refresh access token');
        return false;
      }

      const refreshData = await refreshResponse.json();
      currentAccessToken = refreshData.access_token;

      // Store new tokens
      await supabase.rpc('store_google_oauth_tokens', {
        p_connection_id: connection.id,
        p_access_token: refreshData.access_token,
        p_refresh_token: refresh_token,
        p_expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
      });
    }

    // Delete the event from Google Calendar
    const deleteResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(googleCalendarId)}/events/${encodeURIComponent(googleEventId)}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${currentAccessToken}`,
        },
      }
    );

    if (deleteResponse.status === 204 || deleteResponse.status === 200) {
      console.log('Successfully deleted event from Google Calendar');
      return true;
    } else if (deleteResponse.status === 404) {
      console.log('Event not found in Google Calendar (already deleted or never synced)');
      return true; // Consider this a success - event is gone
    } else {
      const errorText = await deleteResponse.text();
      console.error(`Failed to delete from Google Calendar: ${deleteResponse.status} - ${errorText}`);
      return false;
    }
  } catch (error) {
    console.error('Error deleting from Google Calendar:', error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { appointmentId, appointmentUuid } = await req.json();

    // Support deletion by UUID when ghl_id is null (e.g., Google Calendar appointments)
    if (!appointmentId && !appointmentUuid) {
      throw new Error('Missing appointmentId or appointmentUuid');
    }

    console.log(`Deleting appointment: ${appointmentId || appointmentUuid} (local-only)`);

    // Fetch appointment to check for Google Calendar data
    let appointment = null;
    if (appointmentUuid) {
      const { data } = await supabase
        .from('appointments')
        .select('id, ghl_id, google_calendar_id, google_event_id, company_id')
        .eq('id', appointmentUuid)
        .single();
      appointment = data;
    } else if (appointmentId) {
      const { data } = await supabase
        .from('appointments')
        .select('id, ghl_id, google_calendar_id, google_event_id, company_id')
        .eq('ghl_id', appointmentId)
        .single();
      appointment = data;
    }

    // Delete from Google Calendar if applicable
    if (appointment?.google_event_id && appointment?.google_calendar_id && appointment?.company_id) {
      await deleteFromGoogleCalendar(
        supabase,
        appointment.google_calendar_id,
        appointment.google_event_id,
        appointment.company_id
      );
    }

    // Delete from Supabase
    let deleteQuery = supabase.from('appointments').delete();
    if (appointmentUuid) {
      deleteQuery = deleteQuery.eq('id', appointmentUuid);
    } else if (appointmentId) {
      deleteQuery = deleteQuery.eq('ghl_id', appointmentId);
    }

    const { error: deleteError } = await deleteQuery;

    if (deleteError) {
      console.error('Supabase delete error:', deleteError);
      throw new Error(`Failed to delete from Supabase: ${deleteError.message}`);
    }
    
    console.log('Appointment deleted from Supabase');

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Appointment deleted'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error deleting appointment:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
