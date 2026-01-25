-- Backfill opportunity monetary_value from aggregated estimate totals
-- Excludes estimates with status 'declined' or 'expired'

UPDATE opportunities o
SET monetary_value = agg.calculated_value
FROM (
  SELECT 
    COALESCE(e.opportunity_uuid, opp.id) as opp_uuid,
    SUM(CASE WHEN e.status NOT IN ('declined', 'expired') THEN COALESCE(e.total, 0) ELSE 0 END) as calculated_value
  FROM estimates e
  JOIN opportunities opp ON (opp.id = e.opportunity_uuid OR opp.ghl_id = e.opportunity_id)
  WHERE (e.opportunity_uuid IS NOT NULL OR e.opportunity_id IS NOT NULL)
  GROUP BY COALESCE(e.opportunity_uuid, opp.id)
) agg
WHERE o.id = agg.opp_uuid;