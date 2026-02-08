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

  console.log('Received Twilio SMS webhook');

  try {
    // Parse the incoming Twilio webhook (form-urlencoded)
    const formData = await req.formData();
    
    const messageBody = formData.get('Body')?.toString() || '';
    const fromPhone = formData.get('From')?.toString() || '';
    const toPhone = formData.get('To')?.toString() || '';
    const messageSid = formData.get('MessageSid')?.toString() || '';
    
    console.log(`SMS from ${fromPhone} to ${toPhone}: ${messageBody}`);

    if (!messageBody || !fromPhone) {
      console.error('Missing required fields');
      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration');
      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Normalize phone number - strip all non-digits for comparison
    const normalizePhone = (phone: string): string => {
      const digits = phone.replace(/\D/g, '');
      // If it's 11 digits starting with 1, strip the leading 1
      if (digits.length === 11 && digits.startsWith('1')) {
        return digits.slice(1);
      }
      return digits;
    };

    const normalizedFromPhone = normalizePhone(fromPhone);
    console.log(`Normalized phone: ${normalizedFromPhone} (original: ${fromPhone})`);

    // Look up the Twilio phone number to find the company
    const { data: twilioConfig } = await supabase
      .from('company_settings')
      .select('company_id')
      .eq('setting_key', 'twilio_phone_number')
      .eq('setting_value', toPhone)
      .single();

    const companyId = twilioConfig?.company_id || null;
    console.log(`Matched company: ${companyId}`);

    // Try to find a project/contact by phone number
    let projectId: string | null = null;
    let customerName = fromPhone; // Default to phone number

    // Search for a project with matching phone (fetch all and match normalized)
    const { data: projects } = await supabase
      .from('projects')
      .select('id, customer_first_name, customer_last_name, cell_phone, home_phone')
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .or('cell_phone.not.is.null,home_phone.not.is.null')
      .order('created_at', { ascending: false });

    // Find project by normalized phone match
    const matchedProject = projects?.find(p => {
      const normalizedCell = p.cell_phone ? normalizePhone(p.cell_phone) : '';
      const normalizedHome = p.home_phone ? normalizePhone(p.home_phone) : '';
      return normalizedCell === normalizedFromPhone || normalizedHome === normalizedFromPhone;
    });

    if (matchedProject) {
      projectId = matchedProject.id;
      customerName = `${matchedProject.customer_first_name || ''} ${matchedProject.customer_last_name || ''}`.trim() || fromPhone;
      console.log(`Matched project: ${projectId} (${customerName})`);
    } else {
      // Try to find by contact with normalized phone
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, phone')
        .eq('company_id', companyId)
        .not('phone', 'is', null)
        .order('created_at', { ascending: false });

      const matchedContact = contacts?.find(c => {
        const normalizedContactPhone = c.phone ? normalizePhone(c.phone) : '';
        return normalizedContactPhone === normalizedFromPhone;
      });

      if (matchedContact) {
        customerName = `${matchedContact.first_name || ''} ${matchedContact.last_name || ''}`.trim() || fromPhone;
        
        // Find a project linked to this contact
        const { data: linkedProject } = await supabase
          .from('projects')
          .select('id')
          .eq('contact_uuid', matchedContact.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (linkedProject) {
          projectId = linkedProject.id;
        }
        console.log(`Matched contact: ${customerName}, project: ${projectId}`);
      }
    }

    // Store the SMS in portal_chat_messages
    const { data: chatMessage, error: insertError } = await supabase
      .from('portal_chat_messages')
      .insert({
        project_id: projectId,
        sender_type: 'customer',
        sender_name: customerName,
        message: messageBody,
        company_id: companyId,
        is_sms: true,
        sms_phone_number: fromPhone,
        twilio_message_sid: messageSid,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting SMS message:', insertError);
    } else {
      console.log('SMS message stored:', chatMessage.id);
    }

    // If no project matched, send auto-reply
    if (!projectId && companyId) {
      console.log('No project matched - checking for auto-reply setting');
      
      // Get auto-reply message from settings
      const { data: autoReplySetting } = await supabase
        .from('company_settings')
        .select('setting_value')
        .eq('company_id', companyId)
        .eq('setting_key', 'twilio_auto_reply_message')
        .maybeSingle();

      const autoReplyMessage = autoReplySetting?.setting_value || 
        "Thanks for your message! We couldn't find your account. Please reply with your name and project address so we can assist you.";

      // Get Twilio credentials
      const { data: twilioSettings } = await supabase
        .from('company_settings')
        .select('setting_key, setting_value')
        .eq('company_id', companyId)
        .in('setting_key', ['twilio_account_sid', 'twilio_auth_token', 'twilio_phone_number']);

      const settings: Record<string, string> = {};
      twilioSettings?.forEach(s => {
        settings[s.setting_key] = s.setting_value || '';
      });

      const accountSid = settings['twilio_account_sid'];
      const authToken = settings['twilio_auth_token'];
      const twilioPhone = settings['twilio_phone_number'];

      if (accountSid && authToken && twilioPhone) {
        console.log('Sending auto-reply to:', fromPhone);
        
        // Send auto-reply via Twilio API
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
        const credentials = btoa(`${accountSid}:${authToken}`);
        
        const smsResponse = await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: fromPhone,
            From: twilioPhone,
            Body: autoReplyMessage,
          }),
        });

        if (smsResponse.ok) {
          console.log('Auto-reply sent successfully');
          
          // Store the auto-reply in chat
          await supabase
            .from('portal_chat_messages')
            .insert({
              project_id: null,
              sender_type: 'staff',
              sender_name: 'Auto-Reply',
              message: autoReplyMessage,
              company_id: companyId,
              is_sms: true,
              sms_phone_number: fromPhone,
            });
        } else {
          const errorText = await smsResponse.text();
          console.error('Failed to send auto-reply:', errorText);
        }
      } else {
        console.log('Missing Twilio credentials for auto-reply');
      }
    }

    // Return empty TwiML response (no auto-reply via TwiML since we handle it manually)
    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
    });
  }
});
