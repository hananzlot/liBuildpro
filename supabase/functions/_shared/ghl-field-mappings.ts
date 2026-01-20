import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface GHLFieldMappings {
  address: string | null;
  scope_of_work: string | null;
  notes: string | null;
  [key: string]: string | null;
}

// Empty mappings - each integration must have its own explicit mappings configured
// Do NOT use hardcoded defaults as they would cross-contaminate between integrations
const EMPTY_MAPPINGS: GHLFieldMappings = {
  address: null,
  scope_of_work: null,
  notes: null,
};

/**
 * Get GHL custom field mappings from the database.
 * Looks up by integration_id (preferred) or location_id.
 * Falls back to default hardcoded values if no mappings are configured.
 */
export async function getGHLFieldMappings(
  supabase: SupabaseClient,
  options?: { integrationId?: string | null; locationId?: string | null }
): Promise<GHLFieldMappings> {
  const { integrationId, locationId } = options || {};
  
  let mappings: any[] | null = null;
  let error: any = null;

  // Priority 1: Look up by integration_id directly
  if (integrationId) {
    const result = await supabase
      .from("ghl_field_mappings")
      .select("field_name, ghl_custom_field_id")
      .eq("integration_id", integrationId);
    
    mappings = result.data;
    error = result.error;
  }
  // Priority 2: Look up integration by location_id, then get its mappings
  else if (locationId) {
    // First find the integration for this location
    const { data: integration, error: integrationError } = await supabase
      .from("company_integrations")
      .select("id")
      .eq("location_id", locationId)
      .eq("provider", "ghl")
      .eq("is_active", true)
      .maybeSingle();

    if (integrationError) {
      console.warn("Failed to find integration for location:", integrationError.message);
    }

    if (integration?.id) {
      const result = await supabase
        .from("ghl_field_mappings")
        .select("field_name, ghl_custom_field_id")
        .eq("integration_id", integration.id);
      
      mappings = result.data;
      error = result.error;
    }
  }

  if (error) {
    console.warn("Failed to fetch field mappings:", error.message);
    return { ...EMPTY_MAPPINGS };
  }

  if (!mappings || mappings.length === 0) {
    console.log("No field mappings configured for this integration - fields will not be mapped");
    return { ...EMPTY_MAPPINGS };
  }

  // Build mappings object from configured values only (no defaults)
  const result: GHLFieldMappings = { ...EMPTY_MAPPINGS };

  for (const mapping of mappings) {
    result[mapping.field_name] = mapping.ghl_custom_field_id;
  }

  console.log("Loaded field mappings:", result);
  return result;
}

/**
 * Get a specific field mapping by name.
 */
export async function getFieldMapping(
  supabase: SupabaseClient,
  fieldName: string,
  options?: { integrationId?: string | null; locationId?: string | null }
): Promise<string | null> {
  const mappings = await getGHLFieldMappings(supabase, options);
  return mappings[fieldName] || null;
}
