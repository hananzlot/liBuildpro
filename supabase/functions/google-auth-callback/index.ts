import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

interface GoogleCalendar {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
  accessRole: string;
}

interface GoogleCalendarListResponse {
  items: GoogleCalendar[];
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      console.error('OAuth error:', error);
      return new Response(
        `<html><body><script>window.opener.postMessage({type:'google-auth-error',error:'${error}'},'*');window.close();</script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    if (!code || !state) {
      return new Response(
        JSON.stringify({ error: 'Missing code or state parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse state to get company_id, user_id, and is_company_calendar
    let stateData: { companyId: string; userId?: string; isCompanyCalendar: boolean; redirectUrl: string };
    try {
      stateData = JSON.parse(atob(state));
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid state parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { companyId, userId, isCompanyCalendar, redirectUrl } = stateData;

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get Google credentials from company_settings
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
      console.error('Google credentials not configured');
      return new Response(
        `<html><body><script>window.opener.postMessage({type:'google-auth-error',error:'Google credentials not configured'},'*');window.close();</script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    const clientId = clientIdSetting.setting_value;
    const clientSecret = clientSecretSetting.setting_value;

    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${supabaseUrl}/functions/v1/google-auth-callback`,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token exchange failed:', errorData);
      return new Response(
        `<html><body><script>window.opener.postMessage({type:'google-auth-error',error:'Token exchange failed'},'*');window.close();</script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    const tokens: GoogleTokenResponse = await tokenResponse.json();
    console.log('Received tokens, expires_in:', tokens.expires_in);

    // Fetch user's calendars
    const calendarsResponse = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=writer',
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }
    );

    if (!calendarsResponse.ok) {
      const errorData = await calendarsResponse.text();
      console.error('Failed to fetch calendars:', errorData);
      return new Response(
        `<html><body><script>window.opener.postMessage({type:'google-auth-error',error:'Failed to fetch calendars'},'*');window.close();</script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    const calendarsData: GoogleCalendarListResponse = await calendarsResponse.json();
    console.log(`Found ${calendarsData.items.length} calendars`);

    // Find primary calendar or first writable calendar
    const primaryCalendar = calendarsData.items.find(c => c.primary) || calendarsData.items[0];

    if (!primaryCalendar) {
      return new Response(
        `<html><body><script>window.opener.postMessage({type:'google-auth-error',error:'No writable calendars found'},'*');window.close();</script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Calculate token expiration
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // For personal calendars, look up the salesperson_id from the user's profile
    let salespersonId: string | null = null;
    if (!isCompanyCalendar && userId) {
      // Get the user's ghl_user_id from their profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('ghl_user_id')
        .eq('id', userId)
        .single();

      if (profile?.ghl_user_id) {
        // Look up the salesperson by ghl_user_id
        const { data: salesperson } = await supabase
          .from('salespeople')
          .select('id')
          .eq('ghl_user_id', profile.ghl_user_id)
          .eq('company_id', companyId)
          .eq('is_active', true)
          .single();

        salespersonId = salesperson?.id || null;
        console.log('Found salesperson_id for personal calendar:', salespersonId);
      }
    }

    // Create calendar connection record
    const { data: connection, error: insertError } = await supabase
      .from('google_calendar_connections')
      .upsert({
        company_id: companyId,
        user_id: isCompanyCalendar ? null : userId,
        salesperson_id: salespersonId,
        calendar_id: primaryCalendar.id,
        calendar_name: primaryCalendar.summary,
        calendar_email: primaryCalendar.id,
        is_company_calendar: isCompanyCalendar,
        is_active: true,
        sync_direction: 'bidirectional',
        token_expires_at: tokenExpiresAt,
      }, {
        onConflict: 'company_id,calendar_id',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create connection:', insertError);
      return new Response(
        `<html><body><script>window.opener.postMessage({type:'google-auth-error',error:'Failed to save connection'},'*');window.close();</script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Store encrypted tokens
    const { error: tokenError } = await supabase.rpc('store_google_oauth_tokens', {
      p_connection_id: connection.id,
      p_access_token: tokens.access_token,
      p_refresh_token: tokens.refresh_token || null,
      p_expires_at: tokenExpiresAt,
    });

    if (tokenError) {
      console.error('Failed to store tokens:', tokenError);
      // Clean up the connection
      await supabase.from('google_calendar_connections').delete().eq('id', connection.id);
      return new Response(
        `<html><body><script>window.opener.postMessage({type:'google-auth-error',error:'Failed to store tokens'},'*');window.close();</script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    console.log('Successfully connected calendar:', primaryCalendar.summary);

    // Return success and close the popup
    return new Response(
      `<html><body><script>
        window.opener.postMessage({
          type:'google-auth-success',
          calendar: {
            id: '${connection.id}',
            calendarId: '${primaryCalendar.id}',
            name: '${primaryCalendar.summary.replace(/'/g, "\\'")}',
            isCompanyCalendar: ${isCompanyCalendar}
          }
        },'*');
        window.close();
      </script></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );

  } catch (error) {
    console.error('Error in google-auth-callback:', error);
    return new Response(
      `<html><body><script>window.opener.postMessage({type:'google-auth-error',error:'${String(error).replace(/'/g, "\\'")}'},'*');window.close();</script></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
});
