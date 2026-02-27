import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { auditLog, auditLogs, mode } = body;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let prompt: string;

    if (mode === "daily-summary" && auditLogs && Array.isArray(auditLogs)) {
      const TABLE_LABELS: Record<string, string> = {
        appointments: "Appointment", opportunities: "Opportunity", contacts: "Contact",
        contact_notes: "Contact Note", projects: "Project", project_payments: "Payment",
        project_bills: "Bill", project_invoices: "Invoice", bill_payments: "Bill Payment",
        commission_payments: "Commission", estimates: "Estimate", estimate_items: "Estimate Line Item",
        salespeople: "Salesperson", profiles: "User Profile", user_roles: "User Role",
        company_settings: "Setting", signature_documents: "Document", document_signatures: "Signature",
        call_logs: "Call Log", conversations: "Conversation",
      };

      // Build detailed entries (up to 100 for the AI)
      const detailedEntries = auditLogs.slice(0, 100).map((log: any) => {
        const parts: string[] = [];
        parts.push(`[${log.action}] ${TABLE_LABELS[log.table_name] || log.table_name}`);
        if (log.description) parts.push(`Desc: ${log.description}`);
        if (log.changes) parts.push(`Changes: ${JSON.stringify(log.changes)}`);
        if (log.new_values && log.action === "INSERT") {
          // Trim large new_values to key fields
          const nv = log.new_values;
          const trimmed: Record<string, any> = {};
          const keepKeys = ["project_name","customer_first_name","customer_last_name","payment_amount","payment_status","bill_amount","invoice_number","estimate_number","amount","title","start_time","end_time","address","contact_name","first_name","last_name","email","stage_name","monetary_value","project_status","status","name","full_name","role"];
          for (const k of keepKeys) { if (nv[k] !== undefined) trimmed[k] = nv[k]; }
          if (Object.keys(trimmed).length > 0) parts.push(`Values: ${JSON.stringify(trimmed)}`);
        }
        if (log.user_email) parts.push(`By: ${log.user_email}`);
        return parts.join(" | ");
      });

      const userActivity: Record<string, number> = {};
      for (const log of auditLogs) {
        const user = log.user_email || "System";
        userActivity[user] = (userActivity[user] || 0) + 1;
      }

      prompt = `You are a business operations analyst creating a detailed, specific activity report.

CRITICAL RULES:
- Be EXTREMELY SPECIFIC with real data: customer names, dollar amounts, invoice/estimate numbers, appointment details, project names, statuses.
- Extract actual values from the Changes and Values fields. Don't just say "a payment was updated" — say "Invoice #1234 for John Smith was marked as paid for $5,250".
- Never mention UUIDs or technical database IDs. DO include business identifiers (estimate numbers, invoice numbers, project/customer names).
- Format currency with $ signs. Format dates readably.
- Use markdown headers and bullet points.

Organize the summary into exactly these sections:

## 📋 Overview
One sentence: total ${auditLogs.length} changes in this period.

## 🗓️ Dispatch
All dispatch activity: appointments (who for, when, where, status), opportunity stage changes (lead name, old→new stage, value), new contacts, call logs, salesperson assignments. Be specific.

## 🏗️ Projects
All project activity: status changes (project name, old→new status), invoices created/paid (number, amount), payments received (amount, method, project), bills, commissions. Include dollar amounts.

## 📐 Estimates & Contracts
Estimate activity: new estimates (number, customer, amount), status changes, document signatures, proposal sends.

## 👥 Admin & Team
User/setting changes: role assignments, profile updates, integration changes, company settings. Name who made changes.

If a section has no related activity, write "No activity in this period."

Detailed Log Entries:
${detailedEntries.join("\n")}

Team breakdown: ${JSON.stringify(userActivity)}`;

    } else if (auditLog) {
      // Single log summary mode (existing behavior)
      prompt = `You are a helpful assistant that summarizes database audit log changes into a clear, user-friendly summary. 
Write a concise, plain-English summary of what changed. Use bullet points for multiple changes. 
Don't mention technical details like UUIDs, column names, or table names unless they help understanding.
Translate field names into human-readable labels (e.g. "payment_amount" → "Payment Amount", "project_status" → "Project Status").
Format currency values with $ signs. Format dates nicely.
Keep it brief — 2-5 sentences max.

Audit Log Entry:
- Table: ${auditLog.table_name}
- Action: ${auditLog.action}
- User: ${auditLog.user_email || "System"}
- Date: ${auditLog.changed_at}
${auditLog.description ? `- Description: ${auditLog.description}` : ""}
${auditLog.changes ? `- Changes: ${JSON.stringify(auditLog.changes)}` : ""}
${auditLog.old_values ? `- Previous Values: ${JSON.stringify(auditLog.old_values)}` : ""}
${auditLog.new_values ? `- New Values: ${JSON.stringify(auditLog.new_values)}` : ""}`;
    } else {
      return new Response(JSON.stringify({ error: "No audit log data provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You summarize database activity into user-friendly reports. Be concise and clear." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content || "Unable to generate summary.";

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
