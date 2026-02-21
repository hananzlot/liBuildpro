import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all active companies
    const { data: companies, error: compErr } = await supabase
      .from("companies")
      .select("id")
      .eq("is_active", true);

    if (compErr) throw compErr;

    let totalInserted = 0;

    for (const company of companies || []) {
      const companyId = company.id;
      const notifications: Array<{
        company_id: string;
        ghl_user_id: string | null;
        title: string;
        message: string;
        type: string;
        read: boolean;
        reference_url: string | null;
        appointment_ghl_id: string | null;
      }> = [];

      // ─── 1. Overdue Invoice Alerts (A/R) ───
      // Invoices with open_balance > 0 and invoice_date older than 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: overdueInvoices } = await supabase
        .from("project_invoices")
        .select("id, invoice_number, invoice_date, open_balance, project_id")
        .eq("company_id", companyId)
        .gt("open_balance", 0)
        .lt("invoice_date", thirtyDaysAgo.toISOString().split("T")[0]);

      for (const inv of overdueInvoices || []) {
        const invDate = new Date(inv.invoice_date);
        const daysOverdue = Math.floor(
          (Date.now() - invDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        const bucket =
          daysOverdue >= 90 ? "90+" : daysOverdue >= 60 ? "60" : "30";
        const dedupKey = `overdue_invoice_${inv.id}`;

        // Check for existing notification (dedup)
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("company_id", companyId)
          .eq("type", "overdue_invoice")
          .eq("appointment_ghl_id", dedupKey)
          .limit(1);

        if (!existing?.length) {
          // Get project name for context
          let projectName = "";
          if (inv.project_id) {
            const { data: proj } = await supabase
              .from("projects")
              .select("project_name, customer_first_name, customer_last_name")
              .eq("id", inv.project_id)
              .single();
            if (proj) {
              projectName =
                proj.project_name ||
                `${proj.customer_first_name || ""} ${proj.customer_last_name || ""}`.trim();
            }
          }

          notifications.push({
            company_id: companyId,
            ghl_user_id: null, // Company-wide notification
            title: `Invoice ${bucket}+ Days Overdue`,
            message: `Invoice #${inv.invoice_number || "N/A"}${projectName ? ` (${projectName})` : ""} has $${Number(inv.open_balance).toLocaleString()} outstanding (${daysOverdue} days)`,
            type: "overdue_invoice",
            read: false,
            reference_url: inv.project_id
              ? `/project/${inv.project_id}`
              : null,
            appointment_ghl_id: dedupKey,
          });
        }
      }

      // ─── 2. Overdue In-App Task Reminders ───
      const { data: overdueTasks } = await supabase
        .from("ghl_tasks")
        .select("id, title, assigned_to, due_date, contact_uuid")
        .eq("company_id", companyId)
        .eq("provider", "local")
        .eq("completed", false)
        .lt("due_date", new Date().toISOString());

      for (const task of overdueTasks || []) {
        const dedupKey = `overdue_task_${task.id}`;

        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("company_id", companyId)
          .eq("type", "overdue_task")
          .eq("appointment_ghl_id", dedupKey)
          .limit(1);

        if (!existing?.length) {
          const daysOverdue = Math.floor(
            (Date.now() - new Date(task.due_date).getTime()) /
              (1000 * 60 * 60 * 24)
          );

          notifications.push({
            company_id: companyId,
            ghl_user_id: task.assigned_to || null,
            title: "Overdue Task",
            message: `"${task.title || "Untitled task"}" is ${daysOverdue} day${daysOverdue !== 1 ? "s" : ""} overdue`,
            type: "overdue_task",
            read: false,
            reference_url: task.contact_uuid
              ? `/contacts?task=${task.id}`
              : null,
            appointment_ghl_id: dedupKey,
          });
        }
      }

      // ─── 3. Stale Opportunity Alerts ───
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: staleOpps } = await supabase
        .from("opportunities")
        .select("id, name, assigned_to, updated_at, stage_name")
        .eq("company_id", companyId)
        .lt("updated_at", sevenDaysAgo.toISOString())
        .not("stage_name", "ilike", "%won%")
        .not("stage_name", "ilike", "%lost%")
        .not("stage_name", "ilike", "%dnc%")
        .limit(50);

      for (const opp of staleOpps || []) {
        const dedupKey = `stale_opp_${opp.id}`;

        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("company_id", companyId)
          .eq("type", "stale_opportunity")
          .eq("appointment_ghl_id", dedupKey)
          .limit(1);

        if (!existing?.length) {
          const daysSince = Math.floor(
            (Date.now() - new Date(opp.updated_at).getTime()) /
              (1000 * 60 * 60 * 24)
          );

          notifications.push({
            company_id: companyId,
            ghl_user_id: opp.assigned_to || null,
            title: "Stale Opportunity",
            message: `"${opp.name || "Unnamed"}" hasn't been updated in ${daysSince} days (${opp.stage_name || "No stage"})`,
            type: "stale_opportunity",
            read: false,
            reference_url: `/opportunities/${opp.id}`,
            appointment_ghl_id: dedupKey,
          });
        }
      }

      // ─── 4. Unpaid Bills Due Soon (A/P) ───
      const fiveDaysFromNow = new Date();
      fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);

      const { data: billsDue } = await supabase
        .from("project_bills")
        .select(
          "id, installer_company, bill_amount, balance, scheduled_payment_date, project_id"
        )
        .eq("company_id", companyId)
        .gt("balance", 0)
        .eq("is_voided", false)
        .not("scheduled_payment_date", "is", null)
        .lte(
          "scheduled_payment_date",
          fiveDaysFromNow.toISOString().split("T")[0]
        );

      for (const bill of billsDue || []) {
        const dedupKey = `bill_due_${bill.id}`;

        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("company_id", companyId)
          .eq("type", "bill_due")
          .eq("appointment_ghl_id", dedupKey)
          .limit(1);

        if (!existing?.length) {
          const dueDate = new Date(bill.scheduled_payment_date);
          const isPastDue = dueDate < new Date();

          notifications.push({
            company_id: companyId,
            ghl_user_id: null,
            title: isPastDue ? "Bill Past Due" : "Bill Due Soon",
            message: `${bill.installer_company || "Vendor"}: $${Number(bill.balance).toLocaleString()} ${isPastDue ? "past due" : `due ${bill.scheduled_payment_date}`}`,
            type: "bill_due",
            read: false,
            reference_url: bill.project_id
              ? `/project/${bill.project_id}`
              : null,
            appointment_ghl_id: dedupKey,
          });
        }
      }

      // ─── 5. Proposal Activity ───
      // Check for recently accepted/declined estimates (last 24 hours)
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      const { data: recentEstimates } = await supabase
        .from("estimates")
        .select("id, status, updated_at, project_id, opportunity_uuid")
        .eq("company_id", companyId)
        .in("status", ["accepted", "declined"])
        .gte("updated_at", oneDayAgo.toISOString());

      for (const est of recentEstimates || []) {
        const dedupKey = `proposal_${est.status}_${est.id}`;

        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("company_id", companyId)
          .eq("type", "proposal_activity")
          .eq("appointment_ghl_id", dedupKey)
          .limit(1);

        if (!existing?.length) {
          const refUrl = est.project_id
            ? `/project/${est.project_id}`
            : est.opportunity_uuid
              ? `/opportunities/${est.opportunity_uuid}`
              : null;

          notifications.push({
            company_id: companyId,
            ghl_user_id: null,
            title: `Proposal ${est.status === "accepted" ? "Accepted" : "Declined"}`,
            message: `A proposal has been ${est.status}`,
            type: "proposal_activity",
            read: false,
            reference_url: refUrl,
            appointment_ghl_id: dedupKey,
          });
        }
      }

      // Insert all notifications for this company
      if (notifications.length > 0) {
        const { error: insertErr } = await supabase
          .from("notifications")
          .insert(notifications);

        if (insertErr) {
          console.error(
            `Error inserting notifications for company ${companyId}:`,
            insertErr
          );
        } else {
          totalInserted += notifications.length;
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(
      `Generated ${totalInserted} notifications in ${duration}ms for ${companies?.length || 0} companies`
    );

    return new Response(
      JSON.stringify({
        success: true,
        notificationsCreated: totalInserted,
        companiesProcessed: companies?.length || 0,
        durationMs: duration,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating productivity notifications:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
