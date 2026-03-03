import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getResendApiKey } from "../_shared/get-resend-key.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const { recipientEmail, domain, dnsRecords, companyName } = await req.json();

    if (!recipientEmail || !domain || !dnsRecords) {
      return new Response(
        JSON.stringify({ success: false, error: "recipientEmail, domain, and dnsRecords are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const RESEND_API_KEY = await getResendApiKey(supabase);
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "Resend API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build DNS records table rows
    const dnsRowsHtml = dnsRecords.map((r: { type: string; name: string; value: string; priority?: number }) => `
      <tr>
        <td style="padding:8px 12px;border:1px solid #e5e5e5;font-weight:600;">${r.type}</td>
        <td style="padding:8px 12px;border:1px solid #e5e5e5;"><code style="background:#f5f5f5;padding:2px 6px;border-radius:4px;font-size:13px;">${r.name}</code></td>
        <td style="padding:8px 12px;border:1px solid #e5e5e5;word-break:break-all;"><code style="background:#f5f5f5;padding:2px 6px;border-radius:4px;font-size:13px;">${r.value}</code></td>
        <td style="padding:8px 12px;border:1px solid #e5e5e5;">${r.priority !== undefined ? r.priority : '—'}</td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;max-width:700px;margin:0 auto;padding:20px;background:#ffffff;">
        <div style="border-bottom:2px solid #e5e5e5;padding-bottom:16px;margin-bottom:24px;">
          <h1 style="margin:0;font-size:22px;color:#1a1a2e;">DNS Setup Required: Email Domain Verification</h1>
          <p style="margin:4px 0 0;color:#666;font-size:14px;">Action needed for ${companyName || domain}</p>
        </div>

        <p>Hi,</p>
        <p>We need the following DNS records added to <strong>${domain}</strong> so we can send emails from this domain. These records are required for email authentication (SPF, DKIM, MX).</p>

        <h2 style="font-size:16px;margin-top:24px;color:#1a1a2e;">DNS Records to Add</h2>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <thead>
            <tr style="background:#f5f5f5;">
              <th style="padding:8px 12px;border:1px solid #e5e5e5;text-align:left;">Type</th>
              <th style="padding:8px 12px;border:1px solid #e5e5e5;text-align:left;">Host/Name</th>
              <th style="padding:8px 12px;border:1px solid #e5e5e5;text-align:left;">Value</th>
              <th style="padding:8px 12px;border:1px solid #e5e5e5;text-align:left;">Priority</th>
            </tr>
          </thead>
          <tbody>
            ${dnsRowsHtml}
          </tbody>
        </table>

        <div style="background:#f0f7ff;border:1px solid #c4ddf7;border-radius:8px;padding:16px;margin:20px 0;">
          <p style="margin:0;font-size:14px;"><strong>⏱ Important:</strong> DNS changes can take up to 72 hours to propagate. Verification will be checked automatically once the records are in place.</p>
        </div>

        <h2 style="font-size:16px;margin-top:24px;color:#1a1a2e;">Steps</h2>
        <ol style="padding-left:20px;">
          <li>Log in to your domain registrar / DNS provider for <strong>${domain}</strong></li>
          <li>Navigate to DNS settings / DNS management</li>
          <li>Add each record from the table above</li>
          <li>Save changes — verification will happen automatically</li>
        </ol>

        <p style="color:#666;font-size:13px;margin-top:32px;border-top:1px solid #e5e5e5;padding-top:16px;">
          This email was sent by ${companyName || 'your organization'}'s CRM platform. If you have questions, reply to the person who requested this change.
        </p>
      </body>
      </html>
    `;

    // Send using Resend — use onboarding@resend.dev as default sender since the company domain isn't verified yet
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "DNS Setup <onboarding@resend.dev>",
        to: [recipientEmail],
        subject: `DNS Records Needed: Set up email for ${domain}`,
        html,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Failed to send DNS instructions:", errorText);
      throw new Error(`Failed to send email: ${errorText}`);
    }

    const data = await res.json();
    console.log(`DNS instructions sent to ${recipientEmail}:`, data);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error sending DNS instructions:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
