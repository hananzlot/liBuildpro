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

    // Search for a project with matching phone
    const { data: project } = await supabase
      .from('projects')
      .select('id, customer_first_name, customer_last_name, cell_phone, home_phone')
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .or(`cell_phone.eq.${fromPhone},home_phone.eq.${fromPhone}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (project) {
      projectId = project.id;
      customerName = `${project.customer_first_name || ''} ${project.customer_last_name || ''}`.trim() || fromPhone;
      console.log(`Matched project: ${projectId} (${customerName})`);
    } else {
      // Try to find by contact
      const { data: contact } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, phone')
        .eq('company_id', companyId)
        .eq('phone', fromPhone)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (contact) {
        customerName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || fromPhone;
        
        // Find a project linked to this contact
        const { data: linkedProject } = await supabase
          .from('projects')
          .select('id')
          .eq('contact_uuid', contact.id)
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

    // Return empty TwiML response (no auto-reply)
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
