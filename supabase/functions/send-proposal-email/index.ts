import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string;
  subject: string;
  message: string;
  portalLink: string;
  customerName: string;
  estimateId: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not configured");
    }

    // Initialize Supabase client to fetch settings
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Fetch email settings from database
    const { data: settings } = await supabase
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["resend_from_email", "resend_from_name", "company_name"]);

    const settingsMap = (settings || []).reduce((acc: Record<string, string>, s: any) => {
      acc[s.setting_key] = s.setting_value;
      return acc;
    }, {});

    const fromEmail = settingsMap.resend_from_email || "proposals@caprobuilders.com";
    const fromName = settingsMap.resend_from_name || "Capro Builders";
    const companyName = settingsMap.company_name || "Capro Builders";

    const { to, subject, message, portalLink, customerName }: EmailRequest = await req.json();

    if (!to || !portalLink) {
      throw new Error("Missing required fields");
    }

    console.log(`Sending email to ${to} from ${fromName} <${fromEmail}>`);

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              text-align: center;
              padding: 20px 0;
              border-bottom: 2px solid #e5e5e5;
              margin-bottom: 30px;
            }
            .header h1 {
              color: #1a1a2e;
              margin: 0;
              font-size: 24px;
            }
            .content {
              padding: 20px 0;
            }
            .message {
              white-space: pre-wrap;
              margin-bottom: 30px;
            }
            .cta-button {
              display: inline-block;
              background-color: #1a1a2e;
              color: #ffffff !important;
              padding: 14px 28px;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 600;
              margin: 20px 0;
            }
            .cta-button:hover {
              background-color: #2d2d4a;
            }
            .link-fallback {
              font-size: 12px;
              color: #666;
              margin-top: 20px;
              word-break: break-all;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #e5e5e5;
              font-size: 12px;
              color: #666;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${companyName}</h1>
          </div>
          
          <div class="content">
            <p>Dear ${customerName},</p>
            
            <div class="message">${message}</div>
            
            <div style="text-align: center;">
              <a href="${portalLink}" class="cta-button">View & Sign Proposal</a>
            </div>
            
            <p class="link-fallback">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${portalLink}">${portalLink}</a>
            </p>
          </div>
          
          <div class="footer">
            <p>This email was sent by ${companyName}</p>
            <p>If you have any questions, please contact us directly.</p>
          </div>
        </body>
      </html>
    `;

    const resend = new Resend(RESEND_API_KEY);

    const res = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject: subject,
      html: htmlContent,
    });

    console.log("Email sent successfully:", res);

    return new Response(JSON.stringify({ success: true, data: res }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error sending email:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
