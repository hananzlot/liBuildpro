import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface GHLFieldMappings {
  address: string | null;
  scope_of_work: string | null;
  notes: string | null;
  [key: string]: string | null;
}

// Default hardcoded mappings as fallback
const DEFAULT_MAPPINGS: GHLFieldMappings = {
  address: "b7oTVsUQrLgZt84bHpCn",
  scope_of_work: "KwQRtJT0aMSHnq3mwR68",
  notes: "588ddQgiGEg3AWtTQB2i",
};

/**
 * Get GHL custom field mappings from the database.
 * Falls back to default hardcoded values if no mappings are configured.
 */
export async function getGHLFieldMappings(
  supabase: SupabaseClient,
  companyId?: string | null
): Promise<GHLFieldMappings> {
  // Query field mappings - first try company-specific, then global (company_id = NULL)
  const { data: mappings, error } = await supabase
    .from("ghl_field_mappings")
    .select("field_name, ghl_custom_field_id, company_id")
    .or(`company_id.is.null${companyId ? `,company_id.eq.${companyId}` : ""}`)
    .order("company_id", { ascending: false, nullsFirst: false }); // Company-specific first

  if (error) {
    console.warn("Failed to fetch field mappings, using defaults:", error.message);
    return { ...DEFAULT_MAPPINGS };
  }

  if (!mappings || mappings.length === 0) {
    console.log("No field mappings found, using defaults");
    return { ...DEFAULT_MAPPINGS };
  }

  // Build mappings object, preferring company-specific over global
  const result: GHLFieldMappings = { ...DEFAULT_MAPPINGS };
  const seenFields = new Set<string>();

  for (const mapping of mappings) {
    // Skip if we already have a company-specific mapping for this field
    if (seenFields.has(mapping.field_name)) continue;
    
    result[mapping.field_name] = mapping.ghl_custom_field_id;
    
    // Mark as seen if this is a company-specific mapping
    if (mapping.company_id) {
      seenFields.add(mapping.field_name);
    }
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
  companyId?: string | null
): Promise<string | null> {
  const mappings = await getGHLFieldMappings(supabase, companyId);
  return mappings[fieldName] || null;
}
