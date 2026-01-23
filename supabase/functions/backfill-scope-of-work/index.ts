import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Location 2 ID
const GHL_LOCATION_2_ID = 'XYDIgpHivVWHii65sId5';

// Clean campaign name to extract product/service name
function cleanCampaignName(campaign: string): string {
  if (!campaign) return campaign;
  
  // Handle format: "Product Name | Price | Date" -> extract "Product Name"
  if (campaign.includes('|')) {
    const parts = campaign.split('|');
    const productName = parts[0].trim();
    if (productName) {
      console.log(`Extracted scope "${productName}" from campaign (pipe format): ${campaign}`);
      return productName;
    }
  }
  
  // Remove (Lead Gen) or [Lead Gen] prefix
  let cleanCampaign = campaign
    .replace(/^\(Lead Gen\)\s*/i, '')
    .replace(/^\[Lead Gen\]\s*/i, '');
  
  // Remove date prefix like "2025/12/18 "
  cleanCampaign = cleanCampaign.replace(/^\d{4}\/\d{2}\/\d{2}\s*/, '').trim();
  
  // Also handle [Lead Gen] or (Lead Gen) after date
  cleanCampaign = cleanCampaign
    .replace(/^\(Lead Gen\)\s*/i, '')
    .replace(/^\[Lead Gen\]\s*/i, '')
    .trim();
  
  return cleanCampaign || campaign;
}

// Fetch a single contact by ID (V2 API)
async function fetchContact(ghlApiKey: string, contactId: string): Promise<any | null> {
  try {
    const response = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ghlApiKey}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch contact ${contactId}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.contact || null;
  } catch (err) {
    console.error(`Error fetching contact ${contactId}:`, err);
    return null;
  }
}

// Extract scope from ALL possible locations in V2 contact object
function extractScopeFromContactV2(contact: any): string | null {
  if (!contact) return null;
  
  // 1. Check attributions array (standard V2 format)
  if (contact.attributions && Array.isArray(contact.attributions) && contact.attributions.length > 0) {
    for (const attr of contact.attributions) {
      if (attr.utmCampaign) {
        return cleanCampaignName(attr.utmCampaign);
      }
    }
  }
  
  // 2. Check singular attributionSource object (contains first attribution details)
  if (contact.attributionSource) {
    const attr = contact.attributionSource;
    if (attr.utmCampaign) {
      return cleanCampaignName(attr.utmCampaign);
    }
    if (attr.campaign) {
      return cleanCampaignName(attr.campaign);
    }
    if (attr.formName) {
      return cleanCampaignName(attr.formName);
    }
  }
  
  // 3. Check firstAttribution object
  if (contact.firstAttribution?.utmCampaign) {
    return cleanCampaignName(contact.firstAttribution.utmCampaign);
  }
  
  // 4. Check direct UTM fields on contact object
  if (contact.utmCampaign) {
    return cleanCampaignName(contact.utmCampaign);
  }
  
  // 5. Check formName directly on contact
  if (contact.formName) {
    return cleanCampaignName(contact.formName);
  }
  
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting scope_of_work backfill for Location 2 opportunities...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the GHL API key for Location 2
    const { data: integrations, error: intError } = await supabase
      .from('company_integrations')
      .select('id, company_id, location_id, name')
      .eq('location_id', GHL_LOCATION_2_ID)
      .eq('is_active', true)
      .limit(1);

    if (intError || !integrations || integrations.length === 0) {
      throw new Error(`Failed to find Location 2 integration: ${intError?.message}`);
    }

    const integration = integrations[0];
    console.log(`Found integration: ${integration.name} (${integration.id})`);

    // Get the decrypted API key
    const { data: apiKeyData, error: keyError } = await supabase
      .rpc('get_ghl_api_key_encrypted', { p_integration_id: integration.id });

    if (keyError || !apiKeyData) {
      throw new Error(`Failed to get API key: ${keyError?.message}`);
    }

    const ghlApiKey = apiKeyData;

    // Fetch all Location 2 opportunities with null scope_of_work
    const { data: opportunities, error: oppError } = await supabase
      .from('opportunities')
      .select('id, ghl_id, contact_id, name')
      .eq('location_id', GHL_LOCATION_2_ID)
      .is('scope_of_work', null)
      .not('contact_id', 'is', null);

    if (oppError) {
      throw new Error(`Failed to fetch opportunities: ${oppError.message}`);
    }

    console.log(`Found ${opportunities?.length || 0} opportunities needing scope_of_work backfill`);

    if (!opportunities || opportunities.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No opportunities need backfill', updated: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get unique contact IDs
    const uniqueContactIds = [...new Set(opportunities.map(o => o.contact_id).filter(Boolean))];
    console.log(`Processing ${uniqueContactIds.length} unique contacts...`);

    // Fetch contact data and extract scope
    const contactScopes = new Map<string, string>();
    
    for (const contactId of uniqueContactIds) {
      try {
        const contact = await fetchContact(ghlApiKey, contactId);
        if (contact) {
          const scope = extractScopeFromContactV2(contact);
          if (scope) {
            contactScopes.set(contactId, scope);
            console.log(`Contact ${contactId}: Found scope "${scope}"`);
          } else {
            console.log(`Contact ${contactId}: No scope found in V2 response`);
          }
        }
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (err) {
        console.error(`Error processing contact ${contactId}:`, err);
      }
    }

    console.log(`Found scope data for ${contactScopes.size} contacts`);

    // Update opportunities with the extracted scope
    let updatedCount = 0;
    const results: Array<{ opportunity: string; scope: string | null; success: boolean }> = [];

    for (const opp of opportunities) {
      const scope = contactScopes.get(opp.contact_id);
      if (scope) {
        const { error: updateError } = await supabase
          .from('opportunities')
          .update({ scope_of_work: scope })
          .eq('id', opp.id);

        if (updateError) {
          console.error(`Failed to update opportunity ${opp.id}: ${updateError.message}`);
          results.push({ opportunity: opp.name || opp.id, scope, success: false });
        } else {
          console.log(`Updated opportunity "${opp.name}" with scope "${scope}"`);
          updatedCount++;
          results.push({ opportunity: opp.name || opp.id, scope, success: true });
        }
      } else {
        results.push({ opportunity: opp.name || opp.id, scope: null, success: false });
      }
    }

    console.log(`\n=== Backfill complete! ===`);
    console.log(`Updated ${updatedCount} of ${opportunities.length} opportunities`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        total: opportunities.length,
        updated: updatedCount,
        contactsProcessed: uniqueContactIds.length,
        contactsWithScope: contactScopes.size,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Backfill error:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
