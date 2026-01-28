import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getGHLFieldMappings } from "../_shared/ghl-field-mappings.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GHLIntegration {
  id: string;
  company_id: string;
  location_id: string;
  api_key_encrypted: string | null;
  name: string;
  is_primary: boolean;
  last_sync_at: string | null;
}

interface SyncResult {
  integrationId: string;
  companyId: string;
  locationId: string;
  name: string;
  opportunitiesSynced: number;
  contactsSynced: number;
  appointmentsSynced: number;
}

// Fetch opportunities from GHL API with date filter
async function fetchRecentOpportunities(
  ghlApiKey: string,
  locationId: string,
  sinceDate: Date
): Promise<any[]> {
  console.log(`Fetching opportunities since ${sinceDate.toISOString()}...`);
  const allOpportunities: any[] = [];
  const seenIds = new Set<string>();
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const params = new URLSearchParams({
      location_id: locationId,
      limit: '100',
      page: page.toString(),
    });

    const response = await fetch(`https://services.leadconnectorhq.com/opportunities/search?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ghlApiKey}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GHL Opportunities API Error:', errorText);
      break;
    }

    const data = await response.json();
    const opportunities = data.opportunities || [];

    let newInRangeCount = 0;
    for (const opp of opportunities) {
      if (seenIds.has(opp.id)) continue;
      seenIds.add(opp.id);
      
      // Filter by creation OR update date - include opportunities created or modified since sinceDate
      const oppCreatedAt = opp.createdAt ? new Date(opp.createdAt) : null;
      const oppUpdatedAt = opp.updatedAt ? new Date(opp.updatedAt) : null;
      
      // Include if created since sinceDate, updated since sinceDate, or if no dates available (new record)
      const isInRange = (oppCreatedAt && oppCreatedAt >= sinceDate) || 
                        (oppUpdatedAt && oppUpdatedAt >= sinceDate) ||
                        (!oppCreatedAt && !oppUpdatedAt);
      
      if (isInRange) {
        allOpportunities.push(opp);
        newInRangeCount++;
      }
    }

    console.log(`Page ${page}: ${opportunities.length} total, ${newInRangeCount} in date range`);

    // Stop if we've gone past our date range (opportunities are usually sorted by date desc)
    // or if we've hit the end
    if (opportunities.length < 100 || page >= 20) {
      hasMore = false;
    } else {
      page++;
    }
  }

  console.log(`Found ${allOpportunities.length} opportunities since ${sinceDate.toISOString()}`);
  return allOpportunities;
}

// Extract scope of work from Facebook campaign attribution
// Handles formats like:
// - utmCampaign: "Deck & Patio Cover | $3,995 | 2025/12/04"
// - utmCampaign: "2025/12/18 Paver & Turf Sale"
// - utmCampaign: "[Lead Gen] Product Name"
// - utmContent: "Static 2025/12/04 Deck & Patio Cover"
function extractScopeFromAttribution(attributions: any[] | null): string | null {
  if (!attributions || !Array.isArray(attributions)) return null;
  
  for (const attr of attributions) {
    // Check if this is from Facebook/Paid Social - prioritize utmCampaign for these
    const isFacebookLead = attr.medium === 'facebook' || 
                           attr.adSource === 'facebook' ||
                           attr.utmSessionSource === 'Paid Social';
    
    // For Facebook leads, extract from utmCampaign first (has the sale/product info)
    if (isFacebookLead && attr.utmCampaign) {
      const campaign = attr.utmCampaign as string;
      
      // Handle format: "Product Name | Price | Date" -> extract "Product Name"
      if (campaign.includes('|')) {
        const parts = campaign.split('|');
        const productName = parts[0].trim();
        if (productName) {
          console.log(`Extracted scope "${productName}" from campaign (pipe format): ${campaign}`);
          return productName;
        }
      }
      
      // Handle format: "(Lead Gen) 2025/12/18 Paver & Turf Sale" or "2025/12/18 Paver & Turf Sale"
      // First remove (Lead Gen) or [Lead Gen] prefix anywhere
      let cleanCampaign = campaign
        .replace(/^\(Lead Gen\)\s*/i, '')
        .replace(/^\[Lead Gen\]\s*/i, '');
      
      // Then remove date prefix like "2025/12/18 "
      cleanCampaign = cleanCampaign.replace(/^\d{4}\/\d{2}\/\d{2}\s*/, '').trim();
      
      // Also handle [Lead Gen] or (Lead Gen) after date
      cleanCampaign = cleanCampaign
        .replace(/^\(Lead Gen\)\s*/i, '')
        .replace(/^\[Lead Gen\]\s*/i, '')
        .trim();
      
      if (cleanCampaign && cleanCampaign !== campaign) {
        console.log(`Extracted scope "${cleanCampaign}" from campaign: ${campaign}`);
        return cleanCampaign;
      }
      
      // Otherwise return the full campaign name as scope
      console.log(`Using full campaign as scope: ${campaign}`);
      return campaign;
    }
    
    // Fall back to utmContent if no campaign found
    if (attr.utmContent) {
      // Clean up utmContent format like "Static 2025/12/04 Deck & Patio Cover"
      let content = attr.utmContent as string;
      content = content.replace(/^Static\s+\d{4}\/\d{2}\/\d{2}\s*/i, '').trim();
      if (content) {
        console.log(`Extracted scope from utmContent: ${content}`);
        return content;
      }
    }
  }
  
  return null;
}

// Build a stable display name for an opportunity from its related contact.
function buildContactDisplayName(contact: {
  contact_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  email?: string | null;
} | null | undefined): string | null {
  if (!contact) return null;
  const fullName = `${contact.first_name || ""} ${contact.last_name || ""}`.trim();
  return (
    contact.contact_name ||
    (fullName.length > 0 ? fullName : null) ||
    contact.phone ||
    contact.email ||
    null
  );
}

// Extract address from GHL contact - try native fields first, then custom field mapping
function extractContactAddress(
  contact: any,
  addressFieldId: string | null
): string | null {
  // Try native GHL address fields first
  const parts: string[] = [];
  if (contact.address1) parts.push(contact.address1);
  if (contact.city) parts.push(contact.city);
  if (contact.state) parts.push(contact.state);
  if (contact.postalCode) parts.push(contact.postalCode);
  if (contact.country && contact.country !== 'US') parts.push(contact.country);
  
  if (parts.length > 0) {
    return parts.join(', ');
  }
  
  // Fall back to custom field mapping if configured
  if (addressFieldId && contact.customFields) {
    const customFields = Array.isArray(contact.customFields) 
      ? contact.customFields 
      : [];
    const addressField = customFields.find((f: any) => f.id === addressFieldId);
    if (addressField?.value) {
      return addressField.value;
    }
  }
  
  return null;
}

// Fetch a single contact by ID (V2 API)
async function fetchContact(ghlApiKey: string, contactId: string, locationId?: string): Promise<any | null> {
  const GHL_LOCATION_2_ID = 'XYDIgpHivVWHii65sId5';
  const isLocation2 = locationId === GHL_LOCATION_2_ID;
  
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
    const contact = data.contact || null;
    
    // DEBUG: Log full V2 API response for Location 2 contacts to find UTM data fields
    if (isLocation2 && contact) {
      console.log(`V2 API CONTACT RESPONSE for ${contactId}:`, JSON.stringify({
        // Log specific fields we're looking for
        hasAttributions: !!contact.attributions,
        attributionsLength: contact.attributions?.length || 0,
        attributions: contact.attributions || null,
        // Check for singular attributionSource (different from attributions array)
        hasAttributionSource: !!contact.attributionSource,
        attributionSource: contact.attributionSource || null,
        // Check for direct UTM fields on contact object
        utmCampaign: contact.utmCampaign || null,
        utmSource: contact.utmSource || null,
        utmMedium: contact.utmMedium || null,
        utmContent: contact.utmContent || null,
        // Check for other potential attribution fields
        firstAttribution: contact.firstAttribution || null,
        lastAttribution: contact.lastAttribution || null,
        // Standard fields
        source: contact.source || null,
        tags: contact.tags || null,
        // Log all top-level keys to find where UTM data lives
        allKeys: Object.keys(contact),
      }, null, 2));
    }
    
    return contact;
  } catch (err) {
    console.error(`Error fetching contact ${contactId}:`, err);
    return null;
  }
}

// Extract scope from ALL possible locations in V2 contact object
// This checks attributions array, attributionSource object, and direct UTM fields
function extractScopeFromContactV2(contact: any): string | null {
  if (!contact) return null;
  
  // 1. Check attributions array (standard V2 format)
  if (contact.attributions && Array.isArray(contact.attributions) && contact.attributions.length > 0) {
    const scope = extractScopeFromAttribution(contact.attributions);
    if (scope) {
      console.log(`Found scope from V2 attributions array: "${scope}"`);
      return scope;
    }
  }
  
  // 2. Check singular attributionSource object (may contain first attribution details)
  if (contact.attributionSource) {
    const attr = contact.attributionSource;
    if (attr.utmCampaign) {
      const scope = cleanCampaignName(attr.utmCampaign);
      console.log(`Found scope from attributionSource.utmCampaign: "${scope}"`);
      return scope;
    }
    if (attr.campaign) {
      const scope = cleanCampaignName(attr.campaign);
      console.log(`Found scope from attributionSource.campaign: "${scope}"`);
      return scope;
    }
    // Also check formName as it may contain campaign info
    if (attr.formName) {
      console.log(`Found formName in attributionSource: "${attr.formName}"`);
      // formName often contains the campaign info like "2025/12/22 Pavers & Turf"
      const scope = cleanCampaignName(attr.formName);
      if (scope) return scope;
    }
  }
  
  // 3. Check firstAttribution object (another possible location)
  if (contact.firstAttribution) {
    const attr = contact.firstAttribution;
    if (attr.utmCampaign) {
      const scope = cleanCampaignName(attr.utmCampaign);
      console.log(`Found scope from firstAttribution.utmCampaign: "${scope}"`);
      return scope;
    }
  }
  
  // 4. Check direct UTM fields on contact object
  if (contact.utmCampaign) {
    const scope = cleanCampaignName(contact.utmCampaign);
    console.log(`Found scope from direct utmCampaign: "${scope}"`);
    return scope;
  }
  
  // 5. Check formName directly on contact (may contain campaign info)
  if (contact.formName) {
    console.log(`Found direct formName: "${contact.formName}"`);
    return cleanCampaignName(contact.formName);
  }
  
  return null;
}

// Fetch contact using GHL V1 API to get activity/history data including UTM campaigns
// The V1 API (rest.gohighlevel.com) may require an Agency API key rather than the Location API key
async function fetchContactV1(ghlApiKey: string, contactId: string): Promise<any | null> {
  try {
    console.log(`Fetching contact ${contactId} via V1 API for activity data...`);
    
    // First try with the provided API key (in case it's an Agency key)
    let response = await fetch(
      `https://rest.gohighlevel.com/v1/contacts/${contactId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${ghlApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // If 401, try with the legacy GHL_API_KEY_2 env var (Agency key for Location 2)
    if (response.status === 401) {
      const legacyApiKey2 = Deno.env.get('GHL_API_KEY_2');
      if (legacyApiKey2) {
        console.log(`V1 API returned 401, trying with legacy GHL_API_KEY_2...`);
        response = await fetch(
          `https://rest.gohighlevel.com/v1/contacts/${contactId}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${legacyApiKey2}`,
              'Content-Type': 'application/json',
            },
          }
        );
      }
    }

    if (!response.ok) {
      console.log(`V1 API returned ${response.status} for contact ${contactId}`);
      return null;
    }

    const data = await response.json();
    
    // Log the FULL V1 response to understand the structure and find UTM data
    console.log(`V1 API FULL RESPONSE for ${contactId}:`, JSON.stringify(data, null, 2));
    
    return data.contact || data || null;
  } catch (err) {
    console.error(`Error fetching contact V1 ${contactId}:`, err);
    return null;
  }
}

// Extract UTM campaign from V1 API response (different structure than V2)
function extractScopeFromV1Contact(contact: any): string | null {
  if (!contact) return null;
  
  // Log all top-level keys to understand structure
  console.log(`V1 Contact keys: ${Object.keys(contact).join(', ')}`);
  
  // Check attributionSource (singular, V1 format)
  if (contact.attributionSource?.utmCampaign) {
    console.log(`Found utmCampaign in attributionSource: ${contact.attributionSource.utmCampaign}`);
    return cleanCampaignName(contact.attributionSource.utmCampaign);
  }
  
  // Check direct utmCampaign field
  if (contact.utmCampaign) {
    console.log(`Found direct utmCampaign: ${contact.utmCampaign}`);
    return cleanCampaignName(contact.utmCampaign);
  }
  
  // Check attributions (array, same as V2)
  if (contact.attributions && Array.isArray(contact.attributions) && contact.attributions.length > 0) {
    const scope = extractScopeFromAttribution(contact.attributions);
    if (scope) {
      console.log(`Found scope from V1 attributions array: ${scope}`);
      return scope;
    }
  }
  
  // Check source field for campaign info
  if (contact.source && typeof contact.source === 'string') {
    console.log(`V1 Contact source: ${contact.source}`);
  }
  
  // Check customField array (V1 uses customField, not customFields)
  if (contact.customField && Array.isArray(contact.customField)) {
    console.log(`V1 customField array has ${contact.customField.length} fields`);
    for (const field of contact.customField) {
      console.log(`V1 customField: id=${field.id}, value=${field.value}`);
      if (field.value && typeof field.value === 'string') {
        // Check if field value looks like a campaign name
        const lowerValue = field.value.toLowerCase();
        if (lowerValue.includes('paver') || 
            lowerValue.includes('turf') ||
            lowerValue.includes('sale') ||
            lowerValue.includes('deck') ||
            lowerValue.includes('patio')) {
          console.log(`Found potential scope in customField ${field.id}: ${field.value}`);
          return field.value;
        }
      }
    }
  }
  
  // Check tags for campaign info
  if (contact.tags && Array.isArray(contact.tags)) {
    console.log(`V1 tags: ${contact.tags.join(', ')}`);
    for (const tag of contact.tags) {
      if (typeof tag === 'string') {
        const lowerTag = tag.toLowerCase();
        if (lowerTag.includes('paver') || 
            lowerTag.includes('turf') ||
            lowerTag.includes('campaign') ||
            lowerTag.includes('sale')) {
          console.log(`Found potential scope in tag: ${tag}`);
          return tag;
        }
      }
    }
  }
  
  return null;
}

// Clean campaign name by removing date prefixes and [Lead Gen] tags
function cleanCampaignName(campaign: string): string {
  if (!campaign) return campaign;
  
  // Handle format: "Product Name | Price | Date" -> extract "Product Name"
  if (campaign.includes('|')) {
    const parts = campaign.split('|');
    const productName = parts[0].trim();
    if (productName) {
      return productName;
    }
  }
  
  // Remove (Lead Gen) or [Lead Gen] prefix
  let clean = campaign
    .replace(/^\(Lead Gen\)\s*/i, '')
    .replace(/^\[Lead Gen\]\s*/i, '');
  
  // Remove date prefix like "2025/12/18 "
  clean = clean.replace(/^\d{4}\/\d{2}\/\d{2}\s*/, '').trim();
  
  // Remove [Lead Gen] or (Lead Gen) after date
  clean = clean
    .replace(/^\(Lead Gen\)\s*/i, '')
    .replace(/^\[Lead Gen\]\s*/i, '')
    .trim();
  
  return clean || campaign;
}

// Fetch recent appointments
async function fetchRecentAppointments(
  ghlApiKey: string,
  locationId: string,
  sinceDate: Date
): Promise<any[]> {
  console.log(`Fetching appointments since ${sinceDate.toISOString()}...`);
  
  // First get all calendars
  const calendarsResponse = await fetch(`https://services.leadconnectorhq.com/calendars/?locationId=${locationId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${ghlApiKey}`,
      'Version': '2021-07-28',
      'Content-Type': 'application/json',
    },
  });

  if (!calendarsResponse.ok) {
    console.error('Failed to fetch calendars');
    return [];
  }

  const calendarsData = await calendarsResponse.json();
  const calendars = calendarsData.calendars || [];

  if (calendars.length === 0) {
    return [];
  }

  const allAppointments: any[] = [];
  const seenIds = new Set<string>();
  
  // Fetch appointments from sinceDate to 90 days in future
  const startTime = sinceDate.getTime();
  const endTime = Date.now() + (90 * 24 * 60 * 60 * 1000);

  for (const calendar of calendars) {
    const params = new URLSearchParams({
      locationId,
      calendarId: calendar.id,
      startTime: startTime.toString(),
      endTime: endTime.toString(),
    });

    const response = await fetch(`https://services.leadconnectorhq.com/calendars/events?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ghlApiKey}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch events for calendar ${calendar.id}`);
      continue;
    }

    const data = await response.json();
    const events = data.events || [];
    
    for (const event of events) {
      if (!seenIds.has(event.id)) {
        seenIds.add(event.id);
        allAppointments.push(event);
      }
    }
  }

  console.log(`Found ${allAppointments.length} appointments`);
  return allAppointments;
}

// Fetch pipelines for name resolution
async function fetchPipelines(ghlApiKey: string, locationId: string): Promise<{ pipelineNames: Map<string, string>; stageNames: Map<string, string> }> {
  const pipelineNames = new Map<string, string>();
  const stageNames = new Map<string, string>();

  try {
    const response = await fetch(`https://services.leadconnectorhq.com/opportunities/pipelines?locationId=${locationId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ghlApiKey}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      for (const pipeline of data.pipelines || []) {
        pipelineNames.set(pipeline.id, pipeline.name);
        for (const stage of pipeline.stages || []) {
          stageNames.set(stage.id, stage.name);
        }
      }
    }
  } catch (err) {
    console.error('Error fetching pipelines:', err);
  }

  return { pipelineNames, stageNames };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting lightweight GHL sync (recent opportunities only)...');
    
    // Get all active GHL integrations
    const { data: integrations, error: intError } = await supabase
      .from('company_integrations')
      .select('id, company_id, location_id, api_key_encrypted, name, is_primary, last_sync_at')
      .eq('provider', 'ghl')
      .eq('is_active', true);

    if (intError) {
      throw new Error(`Error fetching integrations: ${intError.message}`);
    }

    if (!integrations || integrations.length === 0) {
      throw new Error('No active GHL integrations found');
    }

    console.log(`Found ${integrations.length} active GHL integrations`);

    const results: SyncResult[] = [];
    const syncTimestamp = new Date().toISOString();

    for (const integration of integrations as GHLIntegration[]) {
      if (!integration.api_key_encrypted) {
        console.log(`Integration ${integration.id} has no API key, skipping`);
        continue;
      }

      // Get decrypted API key
      const { data: apiKey, error: vaultError } = await supabase
        .rpc('get_ghl_api_key_encrypted', { p_integration_id: integration.id });

      if (vaultError || !apiKey) {
        console.error(`Error retrieving API key for integration ${integration.id}:`, vaultError);
        continue;
      }

      console.log(`\n=== Processing ${integration.name || integration.id} (Company: ${integration.company_id}) ===`);

      // Calculate since date: last sync - 24 hours buffer, or 48 hours if no last sync
      let sinceDate: Date;
      if (integration.last_sync_at) {
        sinceDate = new Date(new Date(integration.last_sync_at).getTime() - (24 * 60 * 60 * 1000));
      } else {
        sinceDate = new Date(Date.now() - (48 * 60 * 60 * 1000));
      }

      // Fetch pipeline names for resolution
      const { pipelineNames, stageNames } = await fetchPipelines(apiKey, integration.location_id);

      // Load field mappings for this integration (address, scope_of_work, etc.)
      const fieldMappings = await getGHLFieldMappings(supabase, { integrationId: integration.id });
      const addressFieldId = fieldMappings.address;
      console.log(`Field mappings loaded - address field: ${addressFieldId || 'not configured'}`);

      // Build a lookup map of GHL user IDs to salesperson UUIDs for this company
      const salespersonLookup = new Map<string, string>();
      const { data: salespeople } = await supabase
        .from('salespeople')
        .select('id, ghl_user_id')
        .eq('company_id', integration.company_id)
        .eq('is_active', true)
        .not('ghl_user_id', 'is', null);
      
      if (salespeople) {
        for (const sp of salespeople) {
          if (sp.ghl_user_id) {
            salespersonLookup.set(sp.ghl_user_id, sp.id);
          }
        }
        console.log(`Loaded ${salespersonLookup.size} salespeople for salesperson_id mapping`);
      }

      // Fetch sync exclusions for this location (deleted records that should not re-sync)
      const excludedOpportunityIds = new Set<string>();
      const excludedContactIds = new Set<string>();
      const excludedAppointmentIds = new Set<string>();
      
      const { data: exclusions } = await supabase
        .from('ghl_sync_exclusions')
        .select('ghl_id, record_type')
        .eq('location_id', integration.location_id);
      
      if (exclusions) {
        for (const ex of exclusions) {
          if (ex.record_type === 'opportunity') {
            excludedOpportunityIds.add(ex.ghl_id);
          } else if (ex.record_type === 'contact') {
            excludedContactIds.add(ex.ghl_id);
          } else if (ex.record_type === 'appointment') {
            excludedAppointmentIds.add(ex.ghl_id);
          }
        }
        console.log(`Loaded sync exclusions: ${excludedOpportunityIds.size} opportunities, ${excludedContactIds.size} contacts, ${excludedAppointmentIds.size} appointments`);
      }

      // Fetch recent opportunities
      const opportunities = await fetchRecentOpportunities(apiKey, integration.location_id, sinceDate);

      // Collect unique contact IDs that we might need to fetch
      const contactIds = new Set<string>();
      for (const opp of opportunities) {
        if (opp.contactId) {
          contactIds.add(opp.contactId);
        }
      }

      // Check which contacts already exist in DB and whether they have attributions
      const existingContactIds = new Set<string>();
      const contactsNeedingAttributions = new Set<string>(); // Existing contacts with null attributions
      if (contactIds.size > 0) {
        const contactIdArray = Array.from(contactIds);
        for (let i = 0; i < contactIdArray.length; i += 100) {
          const batch = contactIdArray.slice(i, i + 100);
          const { data: existingContacts } = await supabase
            .from('contacts')
            .select('ghl_id, attributions')
            .in('ghl_id', batch);
          
          (existingContacts || []).forEach((c: any) => {
            existingContactIds.add(c.ghl_id);
            // Track contacts that exist but have null attributions - we need to refresh from GHL
            if (!c.attributions || (Array.isArray(c.attributions) && c.attributions.length === 0)) {
              contactsNeedingAttributions.add(c.ghl_id);
            }
          });
        }
      }

      // Fetch missing contacts from GHL AND existing contacts that need attributions
      const missingContactIds = Array.from(contactIds).filter(id => !existingContactIds.has(id));
      const contactsToRefresh = Array.from(contactsNeedingAttributions);
      const allContactsToFetch = [...missingContactIds, ...contactsToRefresh];
      console.log(`Need to fetch ${missingContactIds.length} missing contacts and ${contactsToRefresh.length} existing contacts needing attributions`);

      // Map to store contact attributions for scope extraction
      const contactAttributions = new Map<string, any[]>();
      // Map to store contact display names for opportunity name fallback
      const contactDisplayNames = new Map<string, string>();
      // Map to store contact addresses
      const contactAddresses = new Map<string, string>();

      const contactsToUpsert: any[] = [];
      const GHL_LOCATION_2_ID = 'XYDIgpHivVWHii65sId5'; // Results Grow - needs enhanced UTM extraction
      
      for (const contactId of allContactsToFetch) {
        // Skip excluded contacts (previously deleted, should not re-sync)
        if (excludedContactIds.has(contactId)) {
          console.log(`Skipping excluded contact: ${contactId}`);
          continue;
        }
        
        const contact = await fetchContact(apiKey, contactId, integration.location_id);
        if (contact) {
          const displayName = buildContactDisplayName({
            contact_name: contact.contactName || null,
            first_name: contact.firstName || null,
            last_name: contact.lastName || null,
            phone: contact.phone || null,
            email: contact.email || null,
          });

          // Extract address from contact
          const contactAddress = extractContactAddress(contact, addressFieldId);

          contactsToUpsert.push({
            ghl_id: contact.id,
            company_id: integration.company_id,
            provider: 'ghl',
            external_id: contact.id,
            location_id: contact.locationId || integration.location_id,
            contact_name: contact.contactName || null,
            first_name: contact.firstName || null,
            last_name: contact.lastName || null,
            email: contact.email || null,
            phone: contact.phone || null,
            source: contact.source || null,
            tags: contact.tags || [],
            assigned_to: contact.assignedTo || null,
            ghl_date_added: contact.dateAdded || null,
            ghl_date_updated: contact.dateUpdated || null,
            custom_fields: contact.customFields || null,
            attributions: contact.attributions || null,
            last_synced_at: syncTimestamp,
          });
          
          // First try to extract scope from ALL possible V2 fields
          const scopeFromV2 = extractScopeFromContactV2(contact);
          
          if (scopeFromV2) {
            console.log(`Found scope from V2 API for ${contactId} (${displayName}): "${scopeFromV2}"`);
            // Store as synthetic attribution for scope extraction
            contactAttributions.set(contact.id, [{ 
              utmCampaign: scopeFromV2, 
              source: 'v2_api_enhanced',
              medium: 'facebook' 
            }]);
          } else if (contact.attributions && Array.isArray(contact.attributions) && contact.attributions.length > 0) {
            // Store original attributions for scope extraction
            contactAttributions.set(contact.id, contact.attributions);
          } else if (integration.location_id === GHL_LOCATION_2_ID) {
            // For Location 2 contacts without any V2 UTM data, try V1 API as fallback
            console.log(`Contact ${contactId} (${displayName}) has no V2 UTM data, trying V1 API...`);
            const v1Contact = await fetchContactV1(apiKey, contactId);
            if (v1Contact) {
              const scopeFromV1 = extractScopeFromV1Contact(v1Contact);
              if (scopeFromV1) {
                console.log(`Found scope from V1 API for ${contactId}: "${scopeFromV1}"`);
                // Store as synthetic attribution for scope extraction
                contactAttributions.set(contactId, [{ 
                  utmCampaign: scopeFromV1, 
                  source: 'v1_api',
                  medium: 'facebook' 
                }]);
              }
            }
          }
          
          if (displayName) {
            contactDisplayNames.set(contact.id, displayName);
          }
          if (contactAddress) {
            contactAddresses.set(contact.id, contactAddress);
          }
        }
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Upsert contacts (including updates for contacts that needed attributions)
      if (contactsToUpsert.length > 0) {
        for (let i = 0; i < contactsToUpsert.length; i += 50) {
          const batch = contactsToUpsert.slice(i, i + 50);
          const { error } = await supabase.from('contacts').upsert(batch, { onConflict: 'ghl_id' });
          if (error) console.error('Contacts upsert error:', error);
        }
        console.log(`Upserted ${contactsToUpsert.length} contacts`);
      }

      // Fetch attributions and addresses for existing contacts that we didn't just fetch
      const existingContactsToQuery = Array.from(contactIds).filter(id => 
        existingContactIds.has(id) && !contactsNeedingAttributions.has(id)
      );
      if (existingContactsToQuery.length > 0) {
        for (let i = 0; i < existingContactsToQuery.length; i += 100) {
          const batch = existingContactsToQuery.slice(i, i + 100);
          const { data: existingContacts } = await supabase
            .from('contacts')
            .select('ghl_id, attributions, contact_name, first_name, last_name, phone, email, custom_fields')
            .in('ghl_id', batch);
          
          (existingContacts || []).forEach((c: any) => {
            if (c.attributions) {
              contactAttributions.set(c.ghl_id, c.attributions);
            }

            const displayName = buildContactDisplayName(c);
            if (displayName) {
              contactDisplayNames.set(c.ghl_id, displayName);
            }

            // Extract address from stored contact custom_fields
            if (addressFieldId && c.custom_fields) {
              const customFields = Array.isArray(c.custom_fields) ? c.custom_fields : [];
              const addressField = customFields.find((f: any) => f.id === addressFieldId);
              if (addressField?.value) {
                contactAddresses.set(c.ghl_id, addressField.value);
              }
            }
          });
        }
      }

      // Build a set of existing contact_id + name combinations to skip new duplicates
      // Also track existing opportunities that need scope updates
      const existingOppKeys = new Set<string>();
      const oppsNeedingScopeUpdate = new Map<string, string>(); // ghl_id -> contact_id for opportunities with null scope
      const allContactIdsForOpps = opportunities.map(o => o.contactId).filter(Boolean);
      if (allContactIdsForOpps.length > 0) {
        for (let i = 0; i < allContactIdsForOpps.length; i += 100) {
          const batch = allContactIdsForOpps.slice(i, i + 100);
          const { data: existingOpps } = await supabase
            .from('opportunities')
            .select('ghl_id, contact_id, name, scope_of_work')
            .in('contact_id', batch)
            .eq('company_id', integration.company_id);
          
          (existingOpps || []).forEach((o: any) => {
            if (o.contact_id && o.name) {
              existingOppKeys.add(`${o.contact_id}::${o.name.toLowerCase()}`);
              // Track opportunities that exist but have no scope_of_work - we need to update them
              if (!o.scope_of_work && o.ghl_id) {
                oppsNeedingScopeUpdate.set(o.ghl_id, o.contact_id);
              }
            }
          });
        }
      }

      // CROSS-LOCATION DUPLICATE PREVENTION: Fetch ALL opportunity names for this company
      // to prevent the same lead from being created in multiple GHL locations
      const crossLocationOppNames = new Set<string>();
      const { data: companyOpps } = await supabase
        .from('opportunities')
        .select('name')
        .eq('company_id', integration.company_id);
      
      (companyOpps || []).forEach((o: any) => {
        if (o.name) {
          crossLocationOppNames.add(o.name.toLowerCase());
        }
      });
      console.log(`Loaded ${crossLocationOppNames.size} existing opportunity names for cross-location duplicate check`);
      console.log(`Found ${oppsNeedingScopeUpdate.size} existing opportunities that need scope updates`);

      // Prepare opportunities for upsert with scope_of_work from Facebook campaigns
      // Filter out duplicates where contact_id + name already exists
      const oppsToUpsert: any[] = [];
      const scopeUpdates: { ghlId: string; scope: string }[] = [];
      let skippedDuplicates = 0;

      for (const o of opportunities) {
        // Skip excluded opportunities (previously deleted, should not re-sync)
        if (excludedOpportunityIds.has(o.id)) {
          console.log(`Skipping excluded opportunity: ${o.id}`);
          skippedDuplicates++;
          continue;
        }
        
        // Try to extract scope from contact's attributions
        const attributions = o.contactId ? contactAttributions.get(o.contactId) : null;
        const scopeFromCampaign = extractScopeFromAttribution(attributions || null);
        const fallbackName = o.contactId ? contactDisplayNames.get(o.contactId) : null;
        const contactAddress = o.contactId ? contactAddresses.get(o.contactId) : null;
        
        const oppName = o.name || fallbackName || null;
        
        // Check if this opportunity needs a scope update (exists but has no scope)
        if (oppsNeedingScopeUpdate.has(o.id) && scopeFromCampaign) {
          scopeUpdates.push({ ghlId: o.id, scope: scopeFromCampaign });
          console.log(`Will update scope for existing opportunity ${oppName}: "${scopeFromCampaign}"`);
        }
        
        // Check if this contact_id + name combination already exists (skip if duplicate)
        if (o.contactId && oppName) {
          const dedupKey = `${o.contactId}::${oppName.toLowerCase()}`;
          if (existingOppKeys.has(dedupKey)) {
            skippedDuplicates++;
            continue; // Skip this duplicate opportunity (already handled scope update above)
          }
          // Add to set to prevent duplicates within same sync batch
          existingOppKeys.add(dedupKey);
        }
        
        // CROSS-LOCATION DUPLICATE CHECK: Skip if same name exists in ANY location for this company
        // This prevents the same lead from being synced from multiple GHL locations
        if (oppName && crossLocationOppNames.has(oppName.toLowerCase())) {
          console.log(`Skipping cross-location duplicate opportunity: ${oppName}`);
          skippedDuplicates++;
          continue;
        }
        // Add to set to prevent duplicates within same sync batch
        if (oppName) {
          crossLocationOppNames.add(oppName.toLowerCase());
        }
        
        oppsToUpsert.push({
          ghl_id: o.id,
          company_id: integration.company_id,
          provider: 'ghl',
          external_id: o.id,
          location_id: o.locationId || integration.location_id,
          contact_id: o.contactId || null,
          pipeline_id: o.pipelineId || null,
          pipeline_stage_id: o.pipelineStageId || null,
          pipeline_name: pipelineNames.get(o.pipelineId) || null,
          stage_name: stageNames.get(o.pipelineStageId) || o.status || null,
          name: oppName,
          monetary_value: o.monetaryValue || null,
          status: o.status || null,
          assigned_to: o.assignedTo || null,
          salesperson_id: o.assignedTo ? salespersonLookup.get(o.assignedTo) || null : null,
          ghl_date_added: o.createdAt || null,
          ghl_date_updated: o.updatedAt || null,
          custom_fields: o.customFields || null,
          scope_of_work: scopeFromCampaign, // Auto-populate from Facebook campaign
          address: contactAddress, // Auto-populate from contact address
          last_synced_at: syncTimestamp,
        });
      }

      if (skippedDuplicates > 0) {
        console.log(`Skipped ${skippedDuplicates} duplicate opportunities (contact_id + name already exists)`);
      }

      // Update scope_of_work for existing opportunities that need it
      if (scopeUpdates.length > 0) {
        for (const update of scopeUpdates) {
          const { error } = await supabase
            .from('opportunities')
            .update({ scope_of_work: update.scope, last_synced_at: syncTimestamp })
            .eq('ghl_id', update.ghlId);
          if (error) {
            console.error(`Failed to update scope for ${update.ghlId}:`, error);
          }
        }
        console.log(`Updated scope_of_work for ${scopeUpdates.length} existing opportunities`);
      }

      // Upsert new opportunities
      if (oppsToUpsert.length > 0) {
        for (let i = 0; i < oppsToUpsert.length; i += 50) {
          const batch = oppsToUpsert.slice(i, i + 50);
          const { error } = await supabase.from('opportunities').upsert(batch, { onConflict: 'ghl_id' });
          if (error) console.error('Opportunities upsert error:', error);
        }
        console.log(`Upserted ${oppsToUpsert.length} opportunities`);
      }

      // Fetch and upsert recent appointments
      const appointments = await fetchRecentAppointments(apiKey, integration.location_id, sinceDate);
      
      // Filter out excluded appointments
      const filteredAppointments = appointments.filter(a => !excludedAppointmentIds.has(a.id));
      if (filteredAppointments.length < appointments.length) {
        console.log(`Filtered out ${appointments.length - filteredAppointments.length} excluded appointments`);
      }
      
      const apptsToUpsert = filteredAppointments.map(a => ({
        ghl_id: a.id,
        company_id: integration.company_id,
        provider: 'ghl',
        external_id: a.id,
        location_id: a.locationId || integration.location_id,
        contact_id: a.contactId || null,
        calendar_id: a.calendarId || null,
        title: a.title || null,
        appointment_status: a.appointmentStatus || a.status || null,
        assigned_user_id: a.assignedUserId || null,
        salesperson_id: a.assignedUserId ? salespersonLookup.get(a.assignedUserId) || null : null,
        start_time: a.startTime || null,
        end_time: a.endTime || null,
        notes: a.notes || null,
        address: a.address || null,
        ghl_date_added: a.dateAdded || a.createdAt || null,
        ghl_date_updated: a.dateUpdated || a.updatedAt || null,
        last_synced_at: syncTimestamp,
      }));

      if (apptsToUpsert.length > 0) {
        for (let i = 0; i < apptsToUpsert.length; i += 50) {
          const batch = apptsToUpsert.slice(i, i + 50);
          const { error } = await supabase.from('appointments').upsert(batch, { onConflict: 'ghl_id' });
          if (error) console.error('Appointments upsert error:', error);
        }
        console.log(`Upserted ${apptsToUpsert.length} appointments`);
      }

      // Update last_sync_at for this integration
      await supabase
        .from('company_integrations')
        .update({ last_sync_at: syncTimestamp })
        .eq('id', integration.id);

      results.push({
        integrationId: integration.id,
        companyId: integration.company_id,
        locationId: integration.location_id,
        name: integration.name || `Integration ${integration.id}`,
        opportunitiesSynced: oppsToUpsert.length,
        contactsSynced: contactsToUpsert.length,
        appointmentsSynced: apptsToUpsert.length,
      });
    }

    // Calculate totals
    const totals = results.reduce((acc, r) => ({
      opportunities: acc.opportunities + r.opportunitiesSynced,
      contacts: acc.contacts + r.contactsSynced,
      appointments: acc.appointments + r.appointmentsSynced,
    }), { opportunities: 0, contacts: 0, appointments: 0 });

    console.log('\n=== Sync complete! ===');
    console.log(`Total: ${totals.opportunities} opportunities, ${totals.contacts} contacts, ${totals.appointments} appointments`);

    return new Response(JSON.stringify({
      success: true,
      integrations: results,
      totals,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in GHL sync:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
