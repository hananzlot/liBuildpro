import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to get the correct GHL API key based on location_id
// Returns null if GHL credentials are not configured (local-only mode)
function getGHLApiKey(locationId: string): string | null {
  const location2Id = Deno.env.get('GHL_LOCATION_ID_2');
  
  if (locationId === location2Id) {
    const apiKey2 = Deno.env.get('GHL_API_KEY_2');
    if (apiKey2) return apiKey2;
  }
  
  // Default to primary API key
  const apiKey1 = Deno.env.get('GHL_API_KEY');
  if (!apiKey1) return null; // Return null for local-only mode
  return apiKey1;
}

// Helper to add delay between API calls to avoid rate limiting
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Update opportunity status in GHL
async function updateGHLOpportunityStatus(ghlId: string, locationId: string): Promise<boolean> {
  try {
    const ghlApiKey = getGHLApiKey(locationId);
    
    // If no GHL credentials, skip GHL update (local-only mode)
    if (!ghlApiKey) {
      console.log(`No GHL credentials, skipping GHL update for ${ghlId} (local-only mode)`);
      return true; // Return true to allow local update to proceed
    }
    
    const response = await fetch(`https://services.leadconnectorhq.com/opportunities/${ghlId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${ghlApiKey}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'abandoned' }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`GHL API Error for ${ghlId}:`, errorText);
      return false;
    }

    console.log(`Successfully updated ${ghlId} to abandoned in GHL`);
    return true;
  } catch (error) {
    console.error(`Error updating ${ghlId} in GHL:`, error);
    return false;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting auto-abandon Never Answered opportunities job...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // NOTE: PNS opportunities are NO LONGER auto-abandoned as of Jan 2026
    // Only process "Never Answer" opportunities now

    // Find all opportunities with stage_name containing "Never Answer" (matches "Never Answers" and "Never Answered")
    // Exclude local-only opportunities (ghl_id starts with 'local_') - these should only be managed from the app
    const { data: neverAnsweredOpportunities, error: naFetchError } = await supabase
      .from('opportunities')
      .select('id, ghl_id, name, stage_name, status, contact_id, location_id')
      .ilike('stage_name', '%Never Answer%')
      .neq('status', 'abandoned')
      .not('ghl_id', 'like', 'local_%');

    if (naFetchError) {
      console.error('Error fetching Never Answered opportunities:', naFetchError);
      throw naFetchError;
    }

    console.log(`Found ${neverAnsweredOpportunities?.length || 0} Never Answered opportunities to update`);

    // Only Never Answered opportunities are processed now (PNS removed)
    const uniqueOpportunities = neverAnsweredOpportunities || [];

    if (uniqueOpportunities.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No Never Answered opportunities to update',
          updated: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update each opportunity in GHL first, then in Supabase
    // Add 500ms delay between calls to avoid rate limiting
    let ghlUpdated = 0;
    let ghlFailed = 0;
    
    for (const opp of uniqueOpportunities) {
      if (opp.ghl_id && opp.location_id) {
        const success = await updateGHLOpportunityStatus(opp.ghl_id, opp.location_id);
        if (success) {
          ghlUpdated++;
        } else {
          ghlFailed++;
        }
        // Wait 500ms between API calls to avoid rate limiting
        await delay(500);
      }
    }

    console.log(`GHL updates: ${ghlUpdated} successful, ${ghlFailed} failed`);

    // Update all matching opportunities to Abandoned status in Supabase
    const opportunityIds = uniqueOpportunities.map(o => o.id);
    
    const { error: updateError } = await supabase
      .from('opportunities')
      .update({ status: 'abandoned' })
      .in('id', opportunityIds);

    if (updateError) {
      console.error('Error updating opportunities:', updateError);
      throw updateError;
    }

    console.log(`Successfully updated ${uniqueOpportunities.length} opportunities to Abandoned status in Supabase`);

    // Create notes for each opportunity that was moved to abandoned
    const notesToInsert = uniqueOpportunities
      .filter(opp => opp.contact_id && opp.location_id)
      .map(opp => {
        return {
          ghl_id: `auto-abandon-${opp.ghl_id}-${Date.now()}`,
          contact_id: opp.contact_id,
          location_id: opp.location_id,
          body: `[SYSTEM] This opportunity "${opp.name}" was automatically moved to Abandoned status because it is marked as Never Answered.`,
          ghl_date_added: new Date().toISOString(),
        };
      });

    if (notesToInsert.length > 0) {
      const { error: notesError } = await supabase
        .from('contact_notes')
        .insert(notesToInsert);

      if (notesError) {
        console.error('Error inserting notes:', notesError);
        // Don't throw - the main update succeeded, just log the note error
      } else {
        console.log(`Successfully created ${notesToInsert.length} notes for abandoned opportunities`);
      }
    }
    
    // Log the updated opportunities for debugging
    uniqueOpportunities.forEach(opp => {
      console.log(`Updated: ${opp.name} (${opp.ghl_id}) - Stage: ${opp.stage_name}`);
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Updated ${uniqueOpportunities.length} Never Answered opportunities to Abandoned`,
        updated: uniqueOpportunities.length,
        ghlUpdated,
        ghlFailed,
        notesCreated: notesToInsert.length,
        opportunities: uniqueOpportunities.map(o => ({ id: o.ghl_id, name: o.name, stage: o.stage_name }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in auto-abandon-pns-opportunities:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});