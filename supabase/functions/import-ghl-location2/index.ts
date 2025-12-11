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

async function fetchFromGHL(endpoint: string, apiKey: string) {
  const response = await fetch(`https://services.leadconnectorhq.com${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Version': '2021-07-28',
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`GHL API error: ${response.status} - ${errorText}`);
    throw new Error(`GHL API error: ${response.status}`);
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
  if (contact.customFields) payload.customFields = contact.customFields;
  
  console.log(`Creating contact in Location 1: ${payload.firstName} ${payload.lastName}`);
  
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
    throw new Error(`Failed to create contact: ${response.status}`);
  }
  
  return response.json();
}

async function createOpportunityInGHL(opportunity: any, contactId: string, apiKey: string) {
  // Use default pipeline from Location 1 or the same pipeline structure
  const payload: any = {
    name: opportunity.name || 'Imported Opportunity',
    contactId: contactId,
    pipelineId: opportunity.pipelineId || opportunity.pipeline_id,
    pipelineStageId: opportunity.pipelineStageId || opportunity.pipeline_stage_id,
    status: opportunity.status || 'open',
  };
  
  if (opportunity.monetaryValue || opportunity.monetary_value) {
    payload.monetaryValue = opportunity.monetaryValue || opportunity.monetary_value;
  }
  
  console.log(`Creating opportunity in Location 1: ${payload.name}`);
  
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
    
    // Fetch contacts from Location 2
    let allContacts: any[] = [];
    let startAfterId = '';
    let hasMore = true;
    
    while (hasMore) {
      const endpoint = `/contacts/?locationId=${LOCATION_2_ID}&limit=100${startAfterId ? `&startAfterId=${startAfterId}` : ''}`;
      const data = await fetchFromGHL(endpoint, LOCATION_2_API_KEY);
      const contacts = data.contacts || [];
      allContacts = [...allContacts, ...contacts];
      
      if (contacts.length < 100) {
        hasMore = false;
      } else {
        startAfterId = contacts[contacts.length - 1]?.id || '';
      }
    }
    
    console.log(`Fetched ${allContacts.length} contacts from Location 2`);
    
    // Import new contacts
    let contactsImported = 0;
    let contactsSkipped = 0;
    
    for (const contact of allContacts) {
      const contactGhlId = contact.id;
      const email = contact.email?.toLowerCase();
      
      // Skip if already imported
      if (importedContacts.has(contactGhlId)) {
        continue;
      }
      
      // Skip if email already exists in Location 1
      if (email && existingEmails.has(email)) {
        console.log(`Skipping contact ${contact.firstName} ${contact.lastName} - email already exists`);
        contactsSkipped++;
        
        // Mark as imported (with null target since it was a duplicate)
        await supabase.from('imported_records').insert({
          source_location_id: LOCATION_2_ID,
          source_ghl_id: contactGhlId,
          record_type: 'contact',
          target_ghl_id: null,
        });
        continue;
      }
      
      try {
        // Create contact in Location 1
        const newContact = await createContactInGHL(contact, LOCATION_1_API_KEY, LOCATION_1_ID);
        const newContactId = newContact.contact?.id;
        
        if (newContactId) {
          // Mark as imported
          await supabase.from('imported_records').insert({
            source_location_id: LOCATION_2_ID,
            source_ghl_id: contactGhlId,
            record_type: 'contact',
            target_ghl_id: newContactId,
          });
          
          importedContacts.set(contactGhlId, newContactId);
          if (email) existingEmails.add(email);
          contactsImported++;
          console.log(`Imported contact: ${contact.firstName} ${contact.lastName} -> ${newContactId}`);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`Failed to import contact ${contactGhlId}:`, error);
      }
    }
    
    // Fetch opportunities from Location 2
    let allOpportunities: any[] = [];
    let startAfter = '';
    hasMore = true;
    
    while (hasMore) {
      const endpoint = `/opportunities/search?location_id=${LOCATION_2_ID}&limit=100${startAfter ? `&startAfter=${startAfter}` : ''}`;
      const response = await fetch(`https://services.leadconnectorhq.com${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOCATION_2_API_KEY}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      
      if (!response.ok) {
        console.error(`Failed to fetch opportunities: ${response.status}`);
        break;
      }
      
      const data = await response.json();
      const opportunities = data.opportunities || [];
      allOpportunities = [...allOpportunities, ...opportunities];
      
      if (opportunities.length < 100 || !data.meta?.nextPageUrl) {
        hasMore = false;
      } else {
        startAfter = data.meta?.startAfter || '';
      }
    }
    
    console.log(`Fetched ${allOpportunities.length} opportunities from Location 2`);
    
    // Import new opportunities
    let opportunitiesImported = 0;
    let opportunitiesSkipped = 0;
    
    for (const opportunity of allOpportunities) {
      const oppGhlId = opportunity.id;
      const sourceContactId = opportunity.contactId || opportunity.contact?.id;
      
      // Skip if already imported
      if (importedOpportunities.has(oppGhlId)) {
        continue;
      }
      
      // Get the new contact ID in Location 1
      const targetContactId = importedContacts.get(sourceContactId);
      
      if (!targetContactId) {
        console.log(`Skipping opportunity ${opportunity.name} - contact not imported or was duplicate`);
        opportunitiesSkipped++;
        
        // Mark as imported (skipped)
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
          // Mark as imported
          await supabase.from('imported_records').insert({
            source_location_id: LOCATION_2_ID,
            source_ghl_id: oppGhlId,
            record_type: 'opportunity',
            target_ghl_id: newOppId,
          });
          
          opportunitiesImported++;
          console.log(`Imported opportunity: ${opportunity.name} -> ${newOppId}`);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`Failed to import opportunity ${oppGhlId}:`, error);
      }
    }
    
    const summary = {
      contactsImported,
      contactsSkipped,
      opportunitiesImported,
      opportunitiesSkipped,
      totalContactsFetched: allContacts.length,
      totalOpportunitiesFetched: allOpportunities.length,
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
