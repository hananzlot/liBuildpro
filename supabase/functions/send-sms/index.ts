import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log('Send SMS request received');

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = claimsData.claims.sub;
    console.log(`User ${userId} sending SMS`);

    const { toPhone, message, projectId, companyId } = await req.json();

    if (!toPhone || !message) {
      return new Response(JSON.stringify({ success: false, error: 'Missing phone or message' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate phone format (basic check)
    const cleanPhone = toPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid phone number' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get Twilio credentials from company settings
    const supabaseService = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: twilioSettings } = await supabaseService
      .from('company_settings')
      .select('setting_key, setting_value')
      .eq('company_id', companyId)
      .in('setting_key', ['twilio_account_sid', 'twilio_auth_token', 'twilio_phone_number']);

    const settingsMap = new Map(twilioSettings?.map(s => [s.setting_key, s.setting_value]) || []);
    const accountSid = settingsMap.get('twilio_account_sid');
    const authToken = settingsMap.get('twilio_auth_token');
    const fromPhone = settingsMap.get('twilio_phone_number');

    if (!accountSid || !authToken || !fromPhone) {
      console.error('Missing Twilio configuration');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'SMS not configured. Please add Twilio credentials in Settings.' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Format phone number
    const formattedTo = cleanPhone.startsWith('1') ? `+${cleanPhone}` : `+1${cleanPhone}`;

    console.log(`Sending SMS from ${fromPhone} to ${formattedTo}`);

    // Send SMS via Twilio
    const twilioResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: formattedTo,
          From: fromPhone,
          Body: message,
        }),
      }
    );

    const twilioResult = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error('Twilio error:', twilioResult);
      return new Response(JSON.stringify({ 
        success: false, 
        error: twilioResult.message || 'Failed to send SMS' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('SMS sent:', twilioResult.sid);

    // Get user info for sender name
    const { data: profile } = await supabaseService
      .from('profiles')
      .select('full_name, email')
      .eq('id', userId)
      .single();

    const senderName = profile?.full_name || profile?.email?.split('@')[0] || 'Staff';

    // Store the sent message in chat
    const { error: insertError } = await supabaseService
      .from('portal_chat_messages')
      .insert({
        project_id: projectId,
        sender_type: 'staff',
        sender_name: senderName,
        sender_user_id: userId,
        sender_email: profile?.email,
        message: message,
        company_id: companyId,
        is_sms: true,
        sms_phone_number: formattedTo,
        twilio_message_sid: twilioResult.sid,
      });

    if (insertError) {
      console.error('Error storing sent SMS:', insertError);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      messageSid: twilioResult.sid 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Send SMS error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
