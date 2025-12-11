import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// GHL credentials for both locations
const LOCATION_1_API_KEY = Deno.env.get('GHL_API_KEY')!;
const LOCATION_1_ID = Deno.env.get('GHL_LOCATION_ID')!;
const LOCATION_2_API_KEY = Deno.env.get('GHL_API_KEY_2')!;
const LOCATION_2_ID = Deno.env.get('GHL_LOCATION_ID_2')!;

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

async function createContactInGHL(contact: any, apiKey: string, locationId: string) {
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
  
  // Map Location 2 fields to Location 1 custom fields
  const customFields: Array<{ id: string; value: string }> = [];
  
  // Get scope from utm_content in attributions array
  let utmContent = '';
  if (contact.attributions && Array.isArray(contact.attributions) && contact.attributions.length > 0) {
    utmContent = contact.attributions[0]?.utmContent || '';
  } else if (contact.attributions?.utmContent) {
    utmContent = contact.attributions.utmContent;
  }
  
  if (utmContent) {
    customFields.push({ id: 'KwQRtJT0aMSHnq3mwR68', value: utmContent }); // Scope of work
    console.log(`Mapping utm_content to scope: ${utmContent}`);
  }
  
  // Create address string from address fields for custom field
  const addressParts = [
    contact.address1,
    contact.city,
    contact.state,
    contact.postalCode
  ].filter(Boolean);
  
  if (addressParts.length > 0) {
    const fullAddress = addressParts.join(', ');
    customFields.push({ id: 'b7oTVsUQrLgZt84bHpCn', value: fullAddress }); // Address custom field
    console.log(`Mapping address: ${fullAddress}`);
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

async function createOpportunityInGHL(opportunity: any, contactId: string, apiKey: string) {
  // Use Location 1's default pipeline since Location 2 has different pipeline IDs
  const payload: any = {
    name: opportunity.name || 'Imported Opportunity',
    contactId: contactId,
    locationId: LOCATION_1_ID,
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
    console.log('Starting import from Location 2 to Location 1...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
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
      
      // Note: We don't skip by email anymore - we try to create and handle duplicates
      // This allows us to update existing contacts with scope data
      
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
        const newContact = await createContactInGHL(mergedContact, LOCATION_1_API_KEY, LOCATION_1_ID);
        const newContactId = newContact.contact?.id;
        const alreadyExists = newContact.alreadyExists;
        
        if (newContactId) {
          // If contact already exists, update it with scope custom field
          if (alreadyExists && utmContent) {
            console.log(`Contact exists, updating with scope: ${utmContent}`);
            await updateContactInGHL(newContactId, {
              customFields: [
                { id: 'KwQRtJT0aMSHnq3mwR68', value: utmContent } // Scope of work
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
        const newOpportunity = await createOpportunityInGHL(opportunity, targetContactId, LOCATION_1_API_KEY);
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
