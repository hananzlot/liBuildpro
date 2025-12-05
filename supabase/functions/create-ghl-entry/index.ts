import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GHL_API_KEY = Deno.env.get('GHL_API_KEY');
    const GHL_LOCATION_ID = Deno.env.get('GHL_LOCATION_ID');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!GHL_API_KEY || !GHL_LOCATION_ID) {
      throw new Error('GHL credentials not configured');
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const {
      firstName,
      lastName,
      phone,
      email,
      address,
      scope,
      notes,
      appointmentDateTime, // ISO string in UTC
      source,
      assignedTo,
      enteredBy, // User ID who created this entry
      pipelineId,
      pipelineStageId,
    } = await req.json();

    if (!firstName || !lastName) {
      throw new Error('First name and last name are required');
    }

    if (!pipelineId || !pipelineStageId) {
      throw new Error('Pipeline and stage are required');
    }

    console.log(`Creating entry for ${firstName} ${lastName}`);

    // Step 1: Create Contact in GHL
    const contactPayload: Record<string, unknown> = {
      firstName,
      lastName,
      locationId: GHL_LOCATION_ID,
    };

    if (phone) contactPayload.phone = phone;
    if (email) contactPayload.email = email;
    if (source) contactPayload.source = source;
    if (assignedTo) contactPayload.assignedTo = assignedTo;
    
    // Add custom fields for address and scope
    const customFields: Array<{ id: string; value: string }> = [];
    if (address) {
      customFields.push({ id: 'b7oTVsUQrLgZt84bHpCn', value: address });
    }
    if (scope) {
      customFields.push({ id: 'KwQRtJT0aMSHnq3mwR68', value: scope });
    }
    if (notes) {
      customFields.push({ id: '588ddQgiGEg3AWtTQB2i', value: notes });
    }
    if (customFields.length > 0) {
      contactPayload.customFields = customFields;
    }

    console.log('Creating contact in GHL...');
    const contactResponse = await fetch(
      'https://services.leadconnectorhq.com/contacts/',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28',
        },
        body: JSON.stringify(contactPayload),
      }
    );

    if (!contactResponse.ok) {
      const errorText = await contactResponse.text();
      console.error('GHL Contact API error:', contactResponse.status, errorText);
      throw new Error(`Failed to create contact: ${errorText}`);
    }

    const contactData = await contactResponse.json();
    const contactId = contactData.contact?.id;
    console.log('Contact created:', contactId);

    // Cache contact in Supabase
    await supabase.from('contacts').upsert({
      ghl_id: contactId,
      location_id: GHL_LOCATION_ID,
      first_name: firstName,
      last_name: lastName,
      contact_name: `${firstName} ${lastName}`,
      phone: phone || null,
      email: email || null,
      source: source || null,
      assigned_to: assignedTo || null,
      custom_fields: customFields.length > 0 ? customFields : null,
      ghl_date_added: new Date().toISOString(),
      entered_by: enteredBy || null,
    }, { onConflict: 'ghl_id' });

    // Step 2: Create Opportunity in GHL
    const oppName = `${firstName} ${lastName}`;
    console.log('Creating opportunity in GHL...');
    
    const oppPayload: Record<string, unknown> = {
      name: oppName,
      contactId: contactId,
      locationId: GHL_LOCATION_ID,
      status: 'open',
      pipelineId: pipelineId,
      pipelineStageId: pipelineStageId,
    };

    if (assignedTo) oppPayload.assignedTo = assignedTo;
    if (source) oppPayload.source = source;

    const oppResponse = await fetch(
      'https://services.leadconnectorhq.com/opportunities/',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28',
        },
        body: JSON.stringify(oppPayload),
      }
    );

    if (!oppResponse.ok) {
      const errorText = await oppResponse.text();
      console.error('GHL Opportunity API error:', oppResponse.status, errorText);
      // Don't throw - contact was created, just log the opportunity error
      console.warn('Opportunity creation failed but contact was created');
    }

    let opportunityId = null;
    if (oppResponse.ok) {
      const oppData = await oppResponse.json();
      opportunityId = oppData.opportunity?.id;
      console.log('Opportunity created:', opportunityId);

      // Cache opportunity in Supabase
      await supabase.from('opportunities').upsert({
        ghl_id: opportunityId,
        location_id: GHL_LOCATION_ID,
        contact_id: contactId,
        name: oppName,
        status: 'open',
        assigned_to: assignedTo || null,
        ghl_date_added: new Date().toISOString(),
        entered_by: enteredBy || null,
      }, { onConflict: 'ghl_id' });
    }

    // Step 3: Create Appointment if date/time provided
    let appointmentId = null;
    if (appointmentDateTime) {
      console.log('Creating appointment in GHL...');
      
      // Look up the sales rep's calendar from existing appointments
      let calendarId = null;
      if (assignedTo) {
        const { data: calendarData } = await supabase
          .from('appointments')
          .select('calendar_id')
          .eq('assigned_user_id', assignedTo)
          .not('calendar_id', 'is', null)
          .limit(1)
          .single();
        
        if (calendarData?.calendar_id) {
          calendarId = calendarData.calendar_id;
          console.log(`Found calendar ${calendarId} for sales rep ${assignedTo}`);
        }
      }

      if (!calendarId) {
        console.warn('No calendar found for sales rep, appointment cannot be created');
        console.warn('Appointment creation skipped - contact/opportunity were created');
      } else {
        // Calculate end time (1 hour after start)
        const startDate = new Date(appointmentDateTime);
        const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

        const apptPayload: Record<string, unknown> = {
          contactId: contactId,
          locationId: GHL_LOCATION_ID,
          title: `Appointment - ${firstName} ${lastName}`,
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
          appointmentStatus: 'confirmed',
          calendarId: calendarId,
        };

        apptPayload.assignedUserId = assignedTo;
        if (address) apptPayload.address = address;

        const apptResponse = await fetch(
          'https://services.leadconnectorhq.com/calendars/events/appointments',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${GHL_API_KEY}`,
              'Content-Type': 'application/json',
              'Version': '2021-04-15',
            },
            body: JSON.stringify(apptPayload),
          }
        );

        if (!apptResponse.ok) {
          const errorText = await apptResponse.text();
          console.error('GHL Appointment API error:', apptResponse.status, errorText);
          console.warn('Appointment creation failed but contact/opportunity were created');
        } else {
          const apptData = await apptResponse.json();
          appointmentId = apptData.id || apptData.appointment?.id;
          console.log('Appointment created:', appointmentId);

          // Cache appointment in Supabase
          if (appointmentId) {
            await supabase.from('appointments').upsert({
              ghl_id: appointmentId,
              location_id: GHL_LOCATION_ID,
              contact_id: contactId,
              calendar_id: calendarId,
              title: `Appointment - ${firstName} ${lastName}`,
              start_time: startDate.toISOString(),
              end_time: endDate.toISOString(),
              appointment_status: 'confirmed',
              assigned_user_id: assignedTo || null,
              ghl_date_added: new Date().toISOString(),
              entered_by: enteredBy || null,
            }, { onConflict: 'ghl_id' });
          }
        }
      }
    }

    console.log('Entry creation complete');

    return new Response(
      JSON.stringify({
        success: true,
        contactId,
        opportunityId,
        appointmentId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error creating GHL entry:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
