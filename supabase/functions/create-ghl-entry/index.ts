import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logEdgeFunctionRun } from "../_shared/edge-function-logger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate a local-only ID for records
function generateLocalId(prefix: string): string {
  return `local_${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let companyId: string | null = null;
  let enteredBy: string | null = null;
  let requestSummary: Record<string, unknown> = {};

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
      appointmentDateTime,
      source,
      assignedTo,
      enteredBy: enteredByParam,
      pipelineId,
      pipelineStageId,
      calendarId,
      locationId,
      companyId: companyIdParam,
    } = await req.json();

    companyId = companyIdParam || null;
    enteredBy = enteredByParam || null;
    requestSummary = { firstName, lastName, phone, email, source, locationId, hasAppointment: !!appointmentDateTime };

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

    // Build display name - handle single name gracefully
    const displayName = effectiveLastName 
      ? `${effectiveFirstName} ${effectiveLastName}`.trim()
      : effectiveFirstName;

    console.log(`Creating local entry for ${displayName} (location: ${locationId})`);

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

    // Create local contact
    const contactId = generateLocalId('contact');
    const { data: contactData, error: contactError } = await supabase.from('contacts').insert({
      ghl_id: contactId,
      location_id: locationId,
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
      throw new Error(`Failed to create contact: ${contactError.message}`);
    }
    const contactUuid = contactData?.id || null;
    console.log('Contact created:', contactId, 'UUID:', contactUuid);

    // Create local opportunity
    const opportunityId = generateLocalId('opp');
    const { data: oppData, error: oppError } = await supabase.from('opportunities').insert({
      ghl_id: opportunityId,
      location_id: locationId,
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
    const opportunityUuid = oppData?.id || null;
    console.log('Opportunity created:', opportunityId, 'UUID:', opportunityUuid);

    // Create local appointment if date/time provided
    let appointmentId: string | null = null;
    if (appointmentDateTime) {
      const startDate = new Date(appointmentDateTime);
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
      const appointmentTitle = `Appointment - ${displayName}`;
      
      appointmentId = generateLocalId('appt');
      const { error: apptError } = await supabase.from('appointments').insert({
        ghl_id: appointmentId,
        location_id: locationId,
        contact_id: contactId,
        contact_uuid: contactUuid,
        calendar_id: calendarId || null,
        title: appointmentTitle,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        appointment_status: 'confirmed',
        assigned_user_id: assignedTo || null,
        salesperson_id: salespersonId,
        address: address || null,
        entered_by: enteredBy || null,
        provider: 'local',
        company_id: companyId || null,
      });

      if (apptError) {
        console.error('Error creating local appointment:', apptError);
      } else {
        console.log('Appointment created:', appointmentId);
      }
    }

    console.log('Entry created successfully (local-only)');

    const responseSummary = { contactUuid, opportunityUuid, appointmentId, displayName };

    // Log success
    logEdgeFunctionRun({
      functionName: 'create-ghl-entry',
      companyId,
      userId: enteredBy,
      requestSummary,
      responseSummary,
      status: 'success',
      durationMs: Date.now() - startTime,
    });

    return new Response(JSON.stringify({ 
      success: true, 
      contactId,
      contactUuid,
      opportunityId,
      opportunityUuid,
      appointmentId,
      message: 'Entry created successfully',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error creating entry:', errorMessage);

    // Log failure
    logEdgeFunctionRun({
      functionName: 'create-ghl-entry',
      companyId,
      userId: enteredBy,
      requestSummary,
      status: 'error',
      durationMs: Date.now() - startTime,
      errorMessage,
      errorDetails: error instanceof Error ? error.stack : undefined,
    });

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
