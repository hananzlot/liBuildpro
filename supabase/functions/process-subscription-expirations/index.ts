import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date().toISOString();
    const results = {
      expired: 0,
      pastDue: 0,
      graceEnded: 0,
      errors: [] as string[]
    };

    // 1. Find active subscriptions that have passed their period end date
    // Set them to 'past_due' and give a 7-day grace period
    const { data: expiredActive, error: expiredError } = await supabase
      .from('company_subscriptions')
      .select('id, company_id, current_period_end')
      .eq('status', 'active')
      .lt('current_period_end', now);

    if (expiredError) {
      results.errors.push(`Error fetching expired active: ${expiredError.message}`);
    } else if (expiredActive && expiredActive.length > 0) {
      // Set grace period (7 days from now)
      const gracePeriodEnd = new Date();
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7);

      for (const sub of expiredActive) {
        const { error: updateError } = await supabase
          .from('company_subscriptions')
          .update({
            status: 'past_due',
            grace_period_ends_at: gracePeriodEnd.toISOString(),
            updated_at: now
          })
          .eq('id', sub.id);

        if (updateError) {
          results.errors.push(`Error updating sub ${sub.id}: ${updateError.message}`);
        } else {
          results.pastDue++;
          console.log(`Subscription ${sub.id} set to past_due with grace until ${gracePeriodEnd.toISOString()}`);
        }
      }
    }

    // 2. Find trialing subscriptions that have passed their trial end date
    const { data: expiredTrials, error: trialsError } = await supabase
      .from('company_subscriptions')
      .select('id, company_id, trial_ends_at, current_period_end')
      .eq('status', 'trialing')
      .not('trial_ends_at', 'is', null)
      .lt('trial_ends_at', now);

    if (trialsError) {
      results.errors.push(`Error fetching expired trials: ${trialsError.message}`);
    } else if (expiredTrials && expiredTrials.length > 0) {
      for (const sub of expiredTrials) {
        const { error: updateError } = await supabase
          .from('company_subscriptions')
          .update({
            status: 'expired',
            updated_at: now
          })
          .eq('id', sub.id);

        if (updateError) {
          results.errors.push(`Error expiring trial ${sub.id}: ${updateError.message}`);
        } else {
          results.expired++;
          console.log(`Trial subscription ${sub.id} expired`);
        }
      }
    }

    // 3. Find past_due subscriptions where grace period has ended
    const { data: graceEnded, error: graceError } = await supabase
      .from('company_subscriptions')
      .select('id, company_id, grace_period_ends_at')
      .eq('status', 'past_due')
      .not('grace_period_ends_at', 'is', null)
      .lt('grace_period_ends_at', now);

    if (graceError) {
      results.errors.push(`Error fetching grace ended: ${graceError.message}`);
    } else if (graceEnded && graceEnded.length > 0) {
      for (const sub of graceEnded) {
        const { error: updateError } = await supabase
          .from('company_subscriptions')
          .update({
            status: 'expired',
            updated_at: now
          })
          .eq('id', sub.id);

        if (updateError) {
          results.errors.push(`Error expiring grace ${sub.id}: ${updateError.message}`);
        } else {
          results.graceEnded++;
          console.log(`Subscription ${sub.id} expired after grace period`);
        }
      }
    }

    console.log('Subscription expiration processing complete:', results);

    return new Response(JSON.stringify({
      success: true,
      processed_at: now,
      results
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Error processing subscription expirations:", error);
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
