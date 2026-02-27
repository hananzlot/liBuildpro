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
      // Daily/batch summary mode
      const logCount = auditLogs.length;
      const tableBreakdown: Record<string, { INSERT: number; UPDATE: number; DELETE: number }> = {};
      const userActivity: Record<string, number> = {};

      for (const log of auditLogs) {
        const table = log.table_name || "unknown";
        if (!tableBreakdown[table]) tableBreakdown[table] = { INSERT: 0, UPDATE: 0, DELETE: 0 };
        tableBreakdown[table][log.action as "INSERT" | "UPDATE" | "DELETE"] = 
          (tableBreakdown[table][log.action as "INSERT" | "UPDATE" | "DELETE"] || 0) + 1;
        
        const user = log.user_email || "System";
        userActivity[user] = (userActivity[user] || 0) + 1;
      }

      // Pick up to 20 representative log descriptions
      const sampleDescriptions = auditLogs
        .filter((l: any) => l.description)
        .slice(0, 20)
        .map((l: any) => `- [${l.action}] ${l.table_name}: ${l.description}`);

      prompt = `You are a helpful assistant that creates concise daily activity reports from database audit logs.
Write a clear, executive-style summary of the day's activity. Use sections with headers. Be concise but comprehensive.
Translate table names into human-readable labels (e.g. "projects" → "Projects", "project_payments" → "Payments", "estimates" → "Estimates").
Don't mention UUIDs. Format as markdown with bullet points.

Activity Data:
- Total changes: ${logCount}
- Table breakdown: ${JSON.stringify(tableBreakdown)}
- User activity: ${JSON.stringify(userActivity)}
${sampleDescriptions.length > 0 ? `- Sample descriptions:\n${sampleDescriptions.join("\n")}` : ""}

Write the summary in these sections:
1. **Overview** - One sentence summary of the day
2. **Key Activity** - What happened, organized by area (projects, payments, estimates, etc.)
3. **Team Activity** - Who did what (brief)`;

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
