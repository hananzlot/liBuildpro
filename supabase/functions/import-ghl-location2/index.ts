import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAllGHLCredentials, GHLCredentials } from "../_shared/ghl-credentials.ts";
import { getGHLFieldMappings, GHLFieldMappings } from "../_shared/ghl-field-mappings.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Location 1 pipeline configuration (default pipeline for imported opportunities)
const LOCATION_1_DEFAULT_PIPELINE_ID = '6bUqC98F6LCM9zuUitXw';
const LOCATION_1_DEFAULT_STAGE_ID = 'bb6ea1e4-3cf0-44cb-a498-faca5cd59a1a'; // New Lead stage

async function fetchContactDetails(contactId: string, apiKey: string) {
  const response = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Version': '2021-07-28',
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    console.error(`Failed to fetch contact details: ${response.status}`);
    return null;
  }
  
  const data = await response.json();
  return data.contact;
}

async function updateContactInGHL(contactId: string, updates: any, apiKey: string) {
  console.log(`Updating contact ${contactId} with:`, JSON.stringify(updates, null, 2));
  
  const response = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Version': '2021-07-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Failed to update contact: ${response.status} - ${errorText}`);
    return null;
  }
  
  return response.json();
}

async function createContactInGHL(contact: any, apiKey: string, locationId: string, fieldMappings: GHLFieldMappings) {
  const payload: any = {
    firstName: contact.firstName || contact.first_name || '',
    lastName: contact.lastName || contact.last_name || '',
    locationId: locationId,
  };
  
  if (contact.email) payload.email = contact.email;
  if (contact.phone) payload.phone = contact.phone;
  if (contact.source) payload.source = contact.source;
  if (contact.tags && contact.tags.length > 0) payload.tags = contact.tags;
  
  // Add address fields
  if (contact.address1) payload.address1 = contact.address1;
  if (contact.city) payload.city = contact.city;
  if (contact.state) payload.state = contact.state;
  if (contact.postalCode) payload.postalCode = contact.postalCode;
  if (contact.country) payload.country = contact.country;
  
  // Map Location 2 fields to Location 1 custom fields using configurable field IDs
  const customFields: Array<{ id: string; value: string }> = [];
  
  // Get scope from utm_content in attributions array
  let utmContent = '';
  if (contact.attributions && Array.isArray(contact.attributions) && contact.attributions.length > 0) {
    utmContent = contact.attributions[0]?.utmContent || '';
  } else if (contact.attributions?.utmContent) {
    utmContent = contact.attributions.utmContent;
  }
  
  // Use configurable field ID for scope_of_work
  const scopeFieldId = fieldMappings.scope_of_work;
  if (utmContent && scopeFieldId) {
    customFields.push({ id: scopeFieldId, value: utmContent });
    console.log(`Mapping utm_content to scope (field ${scopeFieldId}): ${utmContent}`);
  }
  
  // Create address string from address fields for custom field
  const addressParts = [
    contact.address1,
    contact.city,
    contact.state,
    contact.postalCode
  ].filter(Boolean);
  
  // Use configurable field ID for address
  const addressFieldId = fieldMappings.address;
  if (addressParts.length > 0 && addressFieldId) {
    const fullAddress = addressParts.join(', ');
    customFields.push({ id: addressFieldId, value: fullAddress });
    console.log(`Mapping address (field ${addressFieldId}): ${fullAddress}`);
  }
  
  if (customFields.length > 0) {
    payload.customFields = customFields;
  }
  
  console.log(`Creating contact in Location 1: ${payload.firstName} ${payload.lastName}`);
  console.log('Contact payload:', JSON.stringify(payload, null, 2));
  
  const response = await fetch('https://services.leadconnectorhq.com/contacts/', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Version': '2021-07-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Failed to create contact: ${response.status} - ${errorText}`);
    
    // If duplicate, return the existing contact ID from error
    try {
      const errorData = JSON.parse(errorText);
      if (errorData.meta?.contactId) {
        console.log(`Contact already exists: ${errorData.meta.contactId}`);
        return { contact: { id: errorData.meta.contactId }, alreadyExists: true };
      }
    } catch {}
    
    throw new Error(`Failed to create contact: ${response.status}`);
  }
  
  return response.json();
}

async function createOpportunityInGHL(opportunity: any, contactId: string, apiKey: string, targetLocationId: string) {
  // Use Location 1's default pipeline since Location 2 has different pipeline IDs
  const payload: any = {
    name: opportunity.name || 'Imported Opportunity',
    contactId: contactId,
    locationId: targetLocationId,
    pipelineId: LOCATION_1_DEFAULT_PIPELINE_ID,
    pipelineStageId: LOCATION_1_DEFAULT_STAGE_ID,
    status: opportunity.status || 'open',
  };
  
  if (opportunity.monetaryValue || opportunity.monetary_value) {
    payload.monetaryValue = opportunity.monetaryValue || opportunity.monetary_value;
  }
  
  console.log(`Creating opportunity in Location 1: ${payload.name}`);
  console.log('Opportunity payload:', JSON.stringify(payload, null, 2));
  
  const response = await fetch('https://services.leadconnectorhq.com/opportunities/', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Version': '2021-07-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Failed to create opportunity: ${response.status} - ${errorText}`);
    throw new Error(`Failed to create opportunity: ${response.status}`);
  }
  
  return response.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting GHL Location 2 sync/import...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get all GHL credentials from vault (only active integrations with API keys)
    let allCredentials: GHLCredentials[] = [];
    try {
      allCredentials = await getAllGHLCredentials(supabase);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to get GHL credentials:', errorMessage);
      return new Response(JSON.stringify({ 
        success: false, 
        error: errorMessage,
        message: 'No active GHL integrations found. Please configure at least one GHL integration in Admin Settings.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mark sync started for all active integrations we can see
    const startedAt = new Date().toISOString();
    const integrationIds = allCredentials.map((c) => c.integrationId);
    if (integrationIds.length > 0) {
      const { error: startedErr } = await supabase
        .from('company_integrations')
        .update({ last_sync_started_at: startedAt })
        .in('id', integrationIds);

      if (startedErr) {
        console.warn('Failed to update last_sync_started_at:', startedErr);
      }
    }

    // Handle single integration case - mark it as synced and exit
    if (allCredentials.length === 1) {
      console.log('Only 1 active integration found - syncing data from that location only');
      const singleCreds = allCredentials[0];

      const finishedAt = new Date().toISOString();
      const { error: finishErr } = await supabase
        .from('company_integrations')
        .update({ last_sync_at: finishedAt })
        .eq('id', singleCreds.integrationId);

      if (finishErr) {
        console.warn('Failed to update last_sync_at for single integration:', finishErr);
      }
      
      // Just return success with info - the main fetch-ghl-contacts already syncs this location
      return new Response(JSON.stringify({ 
        success: true, 
        mode: 'single-location',
        locationId: singleCreds.locationId,
        message: 'Only one GHL location is active. Use "Sync GHL (Main)" to sync data from this location. Cross-location import requires 2 active integrations.',
        contactsImported: 0,
        opportunitiesImported: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use first location as target (Location 1), second as source (Location 2)
    const location1Credentials = allCredentials[0];
    const location2Credentials = allCredentials[1];
    
    const LOCATION_1_ID = location1Credentials.locationId;
    const LOCATION_1_API_KEY = location1Credentials.apiKey;
    const LOCATION_2_ID = location2Credentials.locationId;
    const LOCATION_2_API_KEY = location2Credentials.apiKey;

    // Get field mappings from database using the target location's integration
    const fieldMappings = await getGHLFieldMappings(supabase, { integrationId: location1Credentials.integrationId });
    console.log('Using field mappings:', fieldMappings);

    console.log(`Importing from Location 2 (${LOCATION_2_ID}) to Location 1 (${LOCATION_1_ID})`);
    
    // Get existing contacts from Location 1 (for email deduplication)
    const { data: location1Contacts } = await supabase
      .from('contacts')
      .select('email, ghl_id')
      .eq('location_id', LOCATION_1_ID)
      .not('email', 'is', null);
    
    const existingEmails = new Set(
      (location1Contacts || []).map(c => c.email?.toLowerCase()).filter(Boolean)
    );
    console.log(`Found ${existingEmails.size} existing emails in Location 1`);
    
    // Get already imported records
    const { data: importedRecords } = await supabase
      .from('imported_records')
      .select('source_ghl_id, record_type, target_ghl_id')
      .eq('source_location_id', LOCATION_2_ID);
    
    const importedContacts = new Map<string, string>();
    const importedOpportunities = new Set<string>();
    
    (importedRecords || []).forEach(r => {
      if (r.record_type === 'contact' && r.target_ghl_id) {
        importedContacts.set(r.source_ghl_id, r.target_ghl_id);
      } else if (r.record_type === 'opportunity') {
        importedOpportunities.add(r.source_ghl_id);
      }
    });
    
    console.log(`Already imported: ${importedContacts.size} contacts, ${importedOpportunities.size} opportunities`);
    
    // Get Location 2 contacts from Supabase (which has full data including attributions)
    const { data: location2Contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('*')
      .eq('location_id', LOCATION_2_ID);
    
    if (contactsError) {
      console.error('Failed to fetch Location 2 contacts from Supabase:', contactsError);
      throw new Error('Failed to fetch contacts');
    }
    
    console.log(`Found ${location2Contacts?.length || 0} contacts in Location 2 (from Supabase)`);
    
    // Import new contacts
    let contactsImported = 0;
    let contactsSkipped = 0;
    
    for (const contact of location2Contacts || []) {
      const contactGhlId = contact.ghl_id;
      const email = contact.email?.toLowerCase();
      
      // Skip if already imported
      if (importedContacts.has(contactGhlId)) {
        continue;
      }
      
      try {
        // Fetch full contact details from GHL to get address
        const fullContact = await fetchContactDetails(contactGhlId, LOCATION_2_API_KEY);
        
        // Get scope from utm_content in attributions array
        let utmContent = '';
        if (contact.attributions && Array.isArray(contact.attributions) && contact.attributions.length > 0) {
          utmContent = contact.attributions[0]?.utmContent || '';
        }
        
        // Merge Supabase data (has attributions) with GHL data (has address)
        const mergedContact = {
          ...fullContact,
          attributions: contact.attributions, // Use Supabase attributions (has utmContent)
          firstName: fullContact?.firstName || contact.first_name,
          lastName: fullContact?.lastName || contact.last_name,
          email: fullContact?.email || contact.email,
          phone: fullContact?.phone || contact.phone,
          source: fullContact?.source || contact.source,
          tags: fullContact?.tags || contact.tags,
        };
        
        console.log(`Processing contact ${contact.contact_name}, utmContent: ${utmContent}`);
        
        // Create contact in Location 1
        const newContact = await createContactInGHL(mergedContact, LOCATION_1_API_KEY, LOCATION_1_ID, fieldMappings);
        const newContactId = newContact.contact?.id;
        const alreadyExists = newContact.alreadyExists;
        
        if (newContactId) {
          // If contact already exists, update it with scope custom field
          const scopeFieldId = fieldMappings.scope_of_work;
          if (alreadyExists && utmContent && scopeFieldId) {
            console.log(`Contact exists, updating with scope: ${utmContent}`);
            await updateContactInGHL(newContactId, {
              customFields: [
                { id: scopeFieldId, value: utmContent }
              ]
            }, LOCATION_1_API_KEY);
          }
          
          await supabase.from('imported_records').insert({
            source_location_id: LOCATION_2_ID,
            source_ghl_id: contactGhlId,
            record_type: 'contact',
            target_ghl_id: newContactId,
          });
          
          importedContacts.set(contactGhlId, newContactId);
          if (email) existingEmails.add(email);
          contactsImported++;
          console.log(`${alreadyExists ? 'Linked existing' : 'Imported'} contact: ${contact.contact_name} -> ${newContactId}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.error(`Failed to import contact ${contactGhlId}:`, error);
      }
    }
    
    // Get Location 2 opportunities from Supabase
    const { data: location2Opportunities, error: oppsError } = await supabase
      .from('opportunities')
      .select('*')
      .eq('location_id', LOCATION_2_ID);
    
    if (oppsError) {
      console.error('Failed to fetch Location 2 opportunities from Supabase:', oppsError);
    }
    
    console.log(`Found ${location2Opportunities?.length || 0} opportunities in Location 2 (from Supabase)`);
    
    // Import new opportunities
    let opportunitiesImported = 0;
    let opportunitiesSkipped = 0;
    
    for (const opportunity of location2Opportunities || []) {
      const oppGhlId = opportunity.ghl_id;
      const sourceContactId = opportunity.contact_id;
      
      // Skip if already imported
      if (importedOpportunities.has(oppGhlId)) {
        continue;
      }
      
      // Get the new contact ID in Location 1
      const targetContactId = importedContacts.get(sourceContactId);
      
      if (!targetContactId) {
        console.log(`Skipping opportunity ${opportunity.name} - contact not imported or was duplicate`);
        opportunitiesSkipped++;
        
        await supabase.from('imported_records').insert({
          source_location_id: LOCATION_2_ID,
          source_ghl_id: oppGhlId,
          record_type: 'opportunity',
          target_ghl_id: null,
        });
        continue;
      }
      
      try {
        // Create opportunity in Location 1
        const newOpportunity = await createOpportunityInGHL(opportunity, targetContactId, LOCATION_1_API_KEY, LOCATION_1_ID);
        const newOppId = newOpportunity.opportunity?.id;
        
        if (newOppId) {
          await supabase.from('imported_records').insert({
            source_location_id: LOCATION_2_ID,
            source_ghl_id: oppGhlId,
            record_type: 'opportunity',
            target_ghl_id: newOppId,
          });
          
          opportunitiesImported++;
          console.log(`Imported opportunity: ${opportunity.name} -> ${newOppId}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.error(`Failed to import opportunity ${oppGhlId}:`, error);
      }
    }
    
    const summary = {
      contactsImported,
      contactsSkipped,
      opportunitiesImported,
      opportunitiesSkipped,
      totalContactsFetched: location2Contacts?.length || 0,
      totalOpportunitiesFetched: location2Opportunities?.length || 0,
    };
    
    console.log('Import complete:', summary);
    
    return new Response(JSON.stringify({ success: true, ...summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Import error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
