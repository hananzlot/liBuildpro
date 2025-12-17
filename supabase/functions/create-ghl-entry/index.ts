import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to get the correct GHL credentials based on location_id
function getGHLCredentials(locationId: string): { apiKey: string; locationId: string } {
  const location1Id = Deno.env.get('GHL_LOCATION_ID') || '';
  const location2Id = Deno.env.get('GHL_LOCATION_ID_2') || '';
  
  if (locationId === location2Id) {
    const apiKey2 = Deno.env.get('GHL_API_KEY_2');
    if (apiKey2) return { apiKey: apiKey2, locationId: location2Id };
  }
  
  // Default to primary credentials
  const apiKey1 = Deno.env.get('GHL_API_KEY');
  if (!apiKey1) throw new Error('Missing GHL_API_KEY');
  return { apiKey: apiKey1, locationId: location1Id };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

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
      calendarId, // Calendar ID for appointments
      locationId, // Optional: which GHL location to use
    } = await req.json();

    if (!firstName || !lastName) {
      throw new Error('First name and last name are required');
    }

    if (!pipelineId || !pipelineStageId) {
      throw new Error('Pipeline and stage are required');
    }

    // Determine which GHL location to use (default to primary)
    const effectiveLocationId = locationId || Deno.env.get('GHL_LOCATION_ID')!;
    const { apiKey: GHL_API_KEY, locationId: GHL_LOCATION_ID } = getGHLCredentials(effectiveLocationId);

    console.log(`Creating entry for ${firstName} ${lastName} (location: ${GHL_LOCATION_ID})`);

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

    // Look up pipeline and stage names from ghl_pipelines
    let pipelineName = null;
    let stageName = null;
    const { data: pipelineData } = await supabase
      .from('ghl_pipelines')
      .select('name, stages')
      .eq('ghl_id', pipelineId)
      .maybeSingle();
    
    if (pipelineData) {
      pipelineName = pipelineData.name;
      const stages = pipelineData.stages as Array<{ id: string; name: string }> || [];
      const stage = stages.find(s => s.id === pipelineStageId);
      if (stage) stageName = stage.name;
    }

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

      // Cache opportunity in Supabase with pipeline/stage info
      await supabase.from('opportunities').upsert({
        ghl_id: opportunityId,
        location_id: GHL_LOCATION_ID,
        contact_id: contactId,
        name: oppName,
        status: 'open',
        pipeline_id: pipelineId,
        pipeline_stage_id: pipelineStageId,
        pipeline_name: pipelineName,
        stage_name: stageName,
        assigned_to: assignedTo || null,
        ghl_date_added: new Date().toISOString(),
        entered_by: enteredBy || null,
      }, { onConflict: 'ghl_id' });
    }

    // Step 3: Create Appointment if date/time provided
    let appointmentId = null;
    if (appointmentDateTime) {
      console.log('Creating appointment in GHL...');
      
      // Use provided calendarId or look up from existing appointments
      let appointmentCalendarId = calendarId;
      if (!appointmentCalendarId && assignedTo) {
        const { data: calendarData } = await supabase
          .from('appointments')
          .select('calendar_id')
          .eq('assigned_user_id', assignedTo)
          .eq('location_id', GHL_LOCATION_ID)
          .not('calendar_id', 'is', null)
          .limit(1)
          .maybeSingle();
        
        if (calendarData?.calendar_id) {
          appointmentCalendarId = calendarData.calendar_id;
          console.log(`Found calendar ${appointmentCalendarId} for sales rep ${assignedTo}`);
        }
      }

      if (!appointmentCalendarId) {
        console.warn('No calendar provided or found for sales rep, appointment cannot be created');
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
          calendarId: appointmentCalendarId,
          ignoreFreeSlotValidation: true, // Bypass slot availability check
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
              calendar_id: appointmentCalendarId,
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
