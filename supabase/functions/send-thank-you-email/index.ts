import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getResendApiKey } from "../_shared/get-resend-key.ts";
import { createPortalShortLink, isShortLinksEnabled } from "../_shared/short-links.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ThankYouEmailRequest {
  to: string;
  customerName: string;
  portalLink: string;
  companyId: string;
}

const DEFAULT_TEMPLATE = {
  subject: "Thank You for Meeting With Us - {{company_name}}",
  body: `Dear {{customer_name}},

Thank you so much for taking the time to meet with us and considering our services! We truly appreciate the opportunity to learn about your project and discuss how we can help.

We've set up a personalized customer portal for you where you can:
- **Upload any documents** we discussed (plans, photos, permits, etc.)
- **Ask questions** directly to our team
- **Track progress** as we prepare your proposal

Click the button below to access your portal anytime.

If you have any questions or need anything at all, please don't hesitate to reach out. We're here to help!

We look forward to working with you.

Best regards,
The {{company_name}} Team`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const { to, customerName, portalLink, companyId }: ThankYouEmailRequest = await req.json();

    if (!to || !customerName || !portalLink || !companyId) {
      throw new Error("Missing required fields: to, customerName, portalLink, companyId");
    }

    // Get Resend API key
    const RESEND_API_KEY = await getResendApiKey(supabase, companyId);
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ 
          error: "Resend API key not configured. Please go to Admin Settings → Emails tab.",
          settingsRequired: true
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get company settings
    const { data: companySettings } = await supabase
      .from("company_settings")
      .select("setting_key, setting_value")
      .eq("company_id", companyId)
      .in("setting_key", ["resend_from_email", "resend_from_name", "company_name", "email_template_thank_you_meeting"]);

    const settingsMap = (companySettings || []).reduce((acc: Record<string, string>, s: any) => {
      acc[s.setting_key] = s.setting_value;
      return acc;
    }, {});

    const fromEmail = settingsMap.resend_from_email;
    const fromName = settingsMap.resend_from_name;
    const companyName = settingsMap.company_name;

    if (!fromEmail || !fromName || !companyName) {
      return new Response(
        JSON.stringify({ 
          error: "Email settings not configured. Please set From Email, From Name, and Company Name in Admin Settings.",
          settingsRequired: true
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get email template (company-specific or default)
    let template = DEFAULT_TEMPLATE;
    if (settingsMap.email_template_thank_you_meeting) {
      try {
        template = JSON.parse(settingsMap.email_template_thank_you_meeting);
      } catch {
        console.log("Using default template - failed to parse custom template");
      }
    } else {
      // Try app_settings fallback
      const { data: appTemplate } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "email_template_thank_you_meeting")
        .maybeSingle();
      
      if (appTemplate?.setting_value) {
        try {
          template = JSON.parse(appTemplate.setting_value);
        } catch {
          console.log("Using default template - failed to parse app template");
        }
      }
    }

    // Convert portal link to short link if enabled
    let finalPortalLink = portalLink;
    const shortLinksEnabled = await isShortLinksEnabled(supabase, companyId);
    if (shortLinksEnabled) {
      finalPortalLink = await createPortalShortLink(supabase, portalLink, companyId, customerName);
    }

    // Replace template variables
    const subject = template.subject
      .replace(/{{customer_name}}/g, customerName)
      .replace(/{{company_name}}/g, companyName);

    const bodyText = template.body
      .replace(/{{customer_name}}/g, customerName)
      .replace(/{{company_name}}/g, companyName)
      .replace(/{{portal_link}}/g, finalPortalLink);

    // Generate HTML email
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
            <div class="message">${bodyText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')}</div>
            
            <div style="text-align: center;">
              <a href="${finalPortalLink}" class="cta-button">Access Your Portal</a>
            </div>
            
            <p class="link-fallback">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${finalPortalLink}">${finalPortalLink}</a>
            </p>
          </div>
          
          <div class="footer">
            <p>This email was sent by ${companyName}</p>
            <p>If you have any questions, please contact us directly.</p>
          </div>
        </body>
      </html>
    `;

    // Send the email
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [to],
        subject: subject,
        html: htmlContent,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Failed to send thank-you email:", errorText);
      throw new Error(`Failed to send email: ${errorText}`);
    }

    const data = await res.json();
    console.log(`Thank-you email sent successfully to ${to}:`, data);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error sending thank-you email:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
