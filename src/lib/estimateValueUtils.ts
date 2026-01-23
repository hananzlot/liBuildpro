import { supabase } from "@/integrations/supabase/client";

/**
 * Statuses that should NOT be included in opportunity value aggregation
 */
const EXCLUDED_STATUSES = ["declined", "expired"];

/**
 * Calculate the aggregated value from all non-excluded estimates for an opportunity
 */
export async function calculateAggregatedEstimateValue(
  opportunityId: string | null,
  opportunityGhlId: string | null,
  companyId: string
): Promise<number> {
  if (!opportunityId && !opportunityGhlId) return 0;

  // Build the query to fetch all estimates linked to this opportunity
  let query = supabase
    .from("estimates")
    .select("id, total, status")
    .eq("company_id", companyId);

  // Match by either opportunity_uuid or opportunity_id (ghl_id)
  if (opportunityId && opportunityGhlId) {
    query = query.or(`opportunity_uuid.eq.${opportunityId},opportunity_id.eq.${opportunityGhlId}`);
  } else if (opportunityId) {
    query = query.eq("opportunity_uuid", opportunityId);
  } else if (opportunityGhlId) {
    query = query.eq("opportunity_id", opportunityGhlId);
  }

  const { data: estimates, error } = await query;

  if (error) {
    console.error("Error fetching estimates for aggregation:", error);
    return 0;
  }

  // Sum up totals from non-excluded estimates
  const aggregatedValue = (estimates || [])
    .filter((est) => !EXCLUDED_STATUSES.includes(est.status))
    .reduce((sum, est) => sum + (est.total || 0), 0);

  return aggregatedValue;
}

/**
 * Update the opportunity's monetary_value with the aggregated estimate total
 */
export async function updateOpportunityValueFromEstimates(
  opportunityId: string | null,
  opportunityGhlId: string | null,
  companyId: string,
  userId?: string
): Promise<void> {
  if (!opportunityGhlId) {
    console.log("No opportunity GHL ID provided, skipping value update");
    return;
  }

  const aggregatedValue = await calculateAggregatedEstimateValue(
    opportunityId,
    opportunityGhlId,
    companyId
  );

  console.log(`Updating opportunity ${opportunityGhlId} monetary_value to aggregated total: ${aggregatedValue}`);

  try {
    await supabase.functions.invoke("update-ghl-opportunity", {
      body: {
        ghl_id: opportunityGhlId,
        monetary_value: aggregatedValue,
        edited_by: userId,
        company_id: companyId,
      },
    });
  } catch (err) {
    console.error("Failed to update opportunity value:", err);
  }
}
