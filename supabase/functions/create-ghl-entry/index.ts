import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getGHLCredentials } from "../_shared/ghl-credentials.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate a local-only ID for records not synced to GHL
function generateLocalId(prefix: string): string {
  return `local_${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
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
      locationId, // Required: which GHL location to use
      skipGHLAppointmentSync, // If true, create local-only appointment
      companyId, // Company ID for multi-tenancy
    } = await req.json();

    // Allow entries with just firstName - use it as full name if lastName is missing
    if (!firstName && !lastName) {
      throw new Error('At least a first name or last name is required');
    }
    
    // If only one name part is provided, use it appropriately
    const effectiveFirstName = firstName?.trim() || lastName?.trim() || '';
    const effectiveLastName = lastName?.trim() || '';

    if (!pipelineId || !pipelineStageId) {
      throw new Error('Pipeline and stage are required');
    }

    if (!locationId) {
      throw new Error('locationId is required');
    }

    // Get GHL credentials from vault
    let credentials: { apiKey: string; locationId: string } | null = null;
    let isLocalOnlyMode = false;
    
    // Check if pipeline is a local-only pipeline (not from GHL)
    const isLocalPipeline = pipelineId?.startsWith('local_pipeline_');
    
    if (isLocalPipeline) {
      console.log('Using local-only mode: pipeline is a locally-configured pipeline');
      isLocalOnlyMode = true;
    } else {
      try {
        credentials = await getGHLCredentials(supabase, locationId);
      } catch (error) {
        console.log(`GHL credentials not available for location ${locationId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        isLocalOnlyMode = true;
      }
    }
    
    const GHL_API_KEY = credentials?.apiKey;
    const GHL_LOCATION_ID = locationId;

    // Build display name - handle single name gracefully
    const displayName = effectiveLastName 
      ? `${effectiveFirstName} ${effectiveLastName}`.trim()
      : effectiveFirstName;

    console.log(`Creating entry for ${displayName} (location: ${GHL_LOCATION_ID}, local-only: ${isLocalOnlyMode})`);


    // Prepare custom fields
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

    let contactId: string;
    let opportunityId: string | null = null;
    let opportunityUuid: string | null = null;
    let appointmentId: string | null = null;

    let contactUuid: string | null = null;

    if (isLocalOnlyMode) {
      // LOCAL-ONLY MODE: Create entries directly in Supabase without GHL sync
      console.log('Running in local-only mode (no GHL credentials configured)...');
      
      // Create local contact and get the generated UUID
      contactId = generateLocalId('contact');
      const { data: contactData, error: contactError } = await supabase.from('contacts').insert({
        ghl_id: contactId,
        location_id: GHL_LOCATION_ID,
        first_name: effectiveFirstName,
        last_name: effectiveLastName,
        contact_name: displayName,
        phone: phone || null,
        email: email || null,
        source: source || null,
        assigned_to: assignedTo || null,
        custom_fields: customFields.length > 0 ? customFields : null,
        ghl_date_added: new Date().toISOString(),
        entered_by: enteredBy || null,
        provider: 'local',
        company_id: companyId || null,
      }).select('id').single();

      if (contactError) {
        console.error('Error creating local contact:', contactError);
        throw new Error(`Failed to create local contact: ${contactError.message}`);
      }
      contactUuid = contactData?.id || null;
      console.log('Local contact created:', contactId, 'UUID:', contactUuid);

      // Look up salesperson UUID if assignedTo is provided
      let salespersonId: string | null = null;
      if (assignedTo) {
        const { data: spData } = await supabase
          .from('salespeople')
          .select('id')
          .or(`id.eq.${assignedTo},ghl_user_id.eq.${assignedTo}`)
          .eq('company_id', companyId)
          .maybeSingle();
        salespersonId = spData?.id || null;
        console.log('Resolved salesperson_id:', salespersonId, 'from assignedTo:', assignedTo);
      }

      // Create local opportunity with contact_uuid
      opportunityId = generateLocalId('opp');
      const { data: oppData, error: oppError } = await supabase.from('opportunities').insert({
        ghl_id: opportunityId,
        location_id: GHL_LOCATION_ID,
        contact_id: contactId,
        contact_uuid: contactUuid,
        name: displayName,
        status: 'open',
        pipeline_id: pipelineId,
        pipeline_stage_id: pipelineStageId,
        pipeline_name: pipelineName,
        stage_name: stageName,
        assigned_to: assignedTo || null,
        salesperson_id: salespersonId,
        address: address || null,
        scope_of_work: scope || null,
        ghl_date_added: new Date().toISOString(),
        entered_by: enteredBy || null,
        provider: 'local',
        company_id: companyId || null,
      }).select('id').single();

      if (oppError) {
        console.error('Error creating local opportunity:', oppError);
        throw new Error(`Failed to create opportunity: ${oppError.message}`);
      }
      opportunityUuid = oppData?.id || null;
      console.log('Local opportunity created:', opportunityId, 'UUID:', opportunityUuid);

      // Create local appointment if date/time provided
      if (appointmentDateTime) {
        const startDate = new Date(appointmentDateTime);
        const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
        const appointmentTitle = `Appointment - ${displayName}`;
        
        appointmentId = generateLocalId('appt');
        const { error: apptError } = await supabase.from('appointments').insert({
          ghl_id: appointmentId,
          location_id: GHL_LOCATION_ID,
          contact_id: contactId,
          contact_uuid: contactUuid,
          calendar_id: calendarId || null,
          title: appointmentTitle,
          start_time: startDate.toISOString(),
          end_time: endDate.toISOString(),
          appointment_status: 'confirmed',
          assigned_user_id: assignedTo || null,
          address: address || null,
          entered_by: enteredBy || null,
          provider: 'local',
          company_id: companyId || null,
        });

        if (apptError) {
          console.error('Error creating local appointment:', apptError);
        } else {
          console.log('Local appointment created:', appointmentId);
        }
      }

    } else {
      // GHL MODE: Create entries in GHL and sync to Supabase
      
      // Step 1: Create Contact in GHL
      const contactPayload: Record<string, unknown> = {
        firstName: effectiveFirstName,
        lastName: effectiveLastName || effectiveFirstName, // GHL requires lastName, fallback to firstName
        locationId: GHL_LOCATION_ID,
      };

      if (phone) contactPayload.phone = phone;
      if (email) contactPayload.email = email;
      if (source) contactPayload.source = source;
      if (assignedTo) contactPayload.assignedTo = assignedTo;
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
      contactId = contactData.contact?.id;
      console.log('Contact created:', contactId);

      // Cache contact in Supabase and get the UUID
      const { data: upsertedContact } = await supabase.from('contacts').upsert({
        ghl_id: contactId,
        location_id: GHL_LOCATION_ID,
        first_name: effectiveFirstName,
        last_name: effectiveLastName,
        contact_name: displayName,
        phone: phone || null,
        email: email || null,
        source: source || null,
        assigned_to: assignedTo || null,
        custom_fields: customFields.length > 0 ? customFields : null,
        ghl_date_added: new Date().toISOString(),
        entered_by: enteredBy || null,
        company_id: companyId || null,
      }, { onConflict: 'ghl_id' }).select('id').single();
      
      contactUuid = upsertedContact?.id || null;
      console.log('Contact cached in Supabase, UUID:', contactUuid);

      // Look up salesperson UUID if assignedTo is provided
      let salespersonId: string | null = null;
      if (assignedTo) {
        const { data: spData } = await supabase
          .from('salespeople')
          .select('id')
          .or(`id.eq.${assignedTo},ghl_user_id.eq.${assignedTo}`)
          .eq('company_id', companyId)
          .maybeSingle();
        salespersonId = spData?.id || null;
        console.log('Resolved salesperson_id:', salespersonId, 'from assignedTo:', assignedTo);
      }

      // Step 2: Create Opportunity in GHL
      console.log('Creating opportunity in GHL...');
      
      const oppPayload: Record<string, unknown> = {
        name: displayName,
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
        // If GHL fails, still create opportunity locally so it's not lost
        console.warn('GHL opportunity creation failed, creating locally instead...');
        
        opportunityId = generateLocalId('opp');
        const { data: localOppData, error: localOppError } = await supabase.from('opportunities').insert({
          ghl_id: opportunityId,
          location_id: GHL_LOCATION_ID,
          contact_id: contactId,
          contact_uuid: contactUuid,
          name: displayName,
          status: 'open',
          pipeline_id: pipelineId,
          pipeline_stage_id: pipelineStageId,
          pipeline_name: pipelineName,
          stage_name: stageName,
          assigned_to: assignedTo || null,
          salesperson_id: salespersonId,
          address: address || null,
          scope_of_work: scope || null,
          ghl_date_added: new Date().toISOString(),
          entered_by: enteredBy || null,
          provider: 'local', // Mark as local since GHL failed
          company_id: companyId || null,
        }).select('id').single();
        
        if (localOppError) {
          console.error('Error creating local fallback opportunity:', localOppError);
        } else {
          opportunityUuid = localOppData?.id || null;
          console.log('Local fallback opportunity created:', opportunityId, 'UUID:', opportunityUuid);
        }
      } else {
        const oppData = await oppResponse.json();
        opportunityId = oppData.opportunity?.id;
        console.log('GHL Opportunity created:', opportunityId);

        // Cache opportunity in Supabase with pipeline/stage info and get the UUID
        const { data: upsertedOpp, error: upsertError } = await supabase.from('opportunities').upsert({
          ghl_id: opportunityId,
          location_id: GHL_LOCATION_ID,
          contact_id: contactId,
          contact_uuid: contactUuid,
          name: displayName,
          status: 'open',
          pipeline_id: pipelineId,
          pipeline_stage_id: pipelineStageId,
          pipeline_name: pipelineName,
          stage_name: stageName,
          assigned_to: assignedTo || null,
          salesperson_id: salespersonId,
          address: address || null,
          scope_of_work: scope || null,
          ghl_date_added: new Date().toISOString(),
          entered_by: enteredBy || null,
          company_id: companyId || null,
        }, { onConflict: 'ghl_id' }).select('id').single();
        
        if (upsertError) {
          console.error('Error caching opportunity in Supabase:', upsertError);
        }
        opportunityUuid = upsertedOpp?.id || null;
        console.log('Opportunity cached in Supabase, UUID:', opportunityUuid);
      }

      // Step 3: Create Appointment if date/time provided
      if (appointmentDateTime) {
        // Calculate start and end time
        const startDate = new Date(appointmentDateTime);
        const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
        const appointmentTitle = `Appointment - ${displayName}`;

        // If skipGHLAppointmentSync is true, create local-only appointment
        if (skipGHLAppointmentSync) {
          console.log('Creating local-only appointment (skipping GHL sync)...');
          
          // Generate a local ID for the appointment
          const localApptId = `local_${crypto.randomUUID()}`;
          
          const { error: insertError } = await supabase.from('appointments').insert({
            ghl_id: localApptId,
            location_id: GHL_LOCATION_ID,
            contact_id: contactId,
            calendar_id: calendarId || null,
            title: appointmentTitle,
            start_time: startDate.toISOString(),
            end_time: endDate.toISOString(),
            appointment_status: 'confirmed',
            assigned_user_id: assignedTo || null,
            address: address || null,
            entered_by: enteredBy || null,
            company_id: companyId || null,
          });

          if (insertError) {
            console.error('Error creating local appointment:', insertError);
          } else {
            appointmentId = localApptId;
            console.log('Local appointment created:', appointmentId);
          }
        } else {
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
            const apptPayload: Record<string, unknown> = {
              contactId: contactId,
              locationId: GHL_LOCATION_ID,
              title: appointmentTitle,
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
                  title: appointmentTitle,
                  start_time: startDate.toISOString(),
                  end_time: endDate.toISOString(),
                  appointment_status: 'confirmed',
                  assigned_user_id: assignedTo || null,
                  ghl_date_added: new Date().toISOString(),
                  entered_by: enteredBy || null,
                  company_id: companyId || null,
                }, { onConflict: 'ghl_id' });
              }
            }
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
        opportunityUuid,
        appointmentId,
        localOnlyMode: isLocalOnlyMode,
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
