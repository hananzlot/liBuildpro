import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SingleEmailRequest {
  to: string;
  subject: string;
  message: string;
  portalLink: string;
  customerName: string;
  estimateId: string;
  companyId?: string;
  isReminder?: boolean;
  salespersonName?: string;
}

interface BatchEmailRequest {
  batch: true;
  recipients: Array<{
    email: string;
    name: string;
    portalLink: string;
  }>;
  subject: string;
  message: string;
  estimateId: string;
  companyId?: string;
  isReminder?: boolean;
  totalSigners?: number;
  salespersonName?: string;
}

type EmailRequest = SingleEmailRequest | BatchEmailRequest;

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

    const body: EmailRequest = await req.json();
    const companyId = body.companyId;

    let fromEmail = "proposals@caprobuilders.com";
    let fromName = "Capro Builders";
    let companyName = "Capro Builders";

    // First try to get settings from company_settings if companyId is provided
    if (companyId) {
      const { data: companySettings } = await supabase
        .from("company_settings")
        .select("setting_key, setting_value")
        .eq("company_id", companyId)
        .in("setting_key", ["resend_from_email", "resend_from_name", "company_name"]);

      if (companySettings && companySettings.length > 0) {
        const settingsMap = companySettings.reduce((acc: Record<string, string>, s: any) => {
          acc[s.setting_key] = s.setting_value;
          return acc;
        }, {});

        fromEmail = settingsMap.resend_from_email || fromEmail;
        fromName = settingsMap.resend_from_name || fromName;
        companyName = settingsMap.company_name || companyName;
        
        console.log(`Using company_settings for company ${companyId}: ${fromName} <${fromEmail}>`);
      }
    }

    // Fallback to app_settings if company settings not found
    if (fromEmail === "proposals@caprobuilders.com") {
      const { data: appSettings } = await supabase
        .from("app_settings")
        .select("setting_key, setting_value")
        .in("setting_key", ["resend_from_email", "resend_from_name", "company_name"]);

      if (appSettings && appSettings.length > 0) {
        const settingsMap = appSettings.reduce((acc: Record<string, string>, s: any) => {
          acc[s.setting_key] = s.setting_value;
          return acc;
        }, {});

        fromEmail = settingsMap.resend_from_email || fromEmail;
        fromName = settingsMap.resend_from_name || fromName;
        companyName = settingsMap.company_name || companyName;
        
        console.log(`Fallback to app_settings: ${fromName} <${fromEmail}>`);
      }
    }

    // Helper function to generate HTML email content
    const generateHtmlContent = (
      customerName: string,
      messageText: string,
      portalLink: string,
      subject: string,
      isReminder: boolean,
      signerInfo?: { current: number; total: number },
      salespersonName?: string
    ) => {
      const signerNote = signerInfo && signerInfo.total > 1
        ? `<p style="margin: 10px 0; font-size: 13px; color: #666;">You are signer ${signerInfo.current} of ${signerInfo.total}.</p>`
        : '';
      
      const salesRepNote = salespersonName
        ? `<p style="margin: 10px 0; font-size: 13px; color: #444;">Your Sales Representative: <strong>${salespersonName}</strong></p>`
        : '';

      return `
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
              ${isReminder ? '<p style="margin: 10px 0 0 0; font-size: 14px; opacity: 0.9;">Friendly Reminder</p>' : ''}
            </div>
            
            <div class="content">
              <p>Dear ${customerName},</p>
              ${signerNote}
              ${salesRepNote}
              
              <div class="message">${messageText}</div>
              
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
    };

    // Helper function to send email with retry logic for rate limits
    const sendEmailWithRetry = async (
      to: string,
      subject: string,
      htmlContent: string,
      maxRetries = 6,
      baseDelay = 1000
    ): Promise<{ success: boolean; error?: string }> => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
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

          if (res.ok) {
            const data = await res.json();
            console.log(`Email sent successfully to ${to}:`, data);
            return { success: true };
          }

          // Check if rate limited (429)
          if (res.status === 429 && attempt < maxRetries) {
            // Exponential backoff with jitter
            const jitter = Math.random() * 1000;
            const delay = Math.min(baseDelay * Math.pow(2, attempt - 1) + jitter, 15000);
            console.log(`Rate limited for ${to}, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }

          // For non-rate-limit errors or final attempt, return error
          const errorText = await res.text();
          console.error(`Failed to send email to ${to}:`, errorText);
          return { success: false, error: errorText };
        } catch (error) {
          if (attempt < maxRetries) {
            const delay = baseDelay * attempt;
            console.log(`Network error for ${to}, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      }
      return { success: false, error: "Max retries exceeded" };
    };

    // Check if this is a batch request
    if ('batch' in body && body.batch === true) {
      const { recipients, subject, message, isReminder, totalSigners, salespersonName } = body as BatchEmailRequest;

      if (!recipients || recipients.length === 0) {
        throw new Error("No recipients provided");
      }

      console.log(`Sending batch emails to ${recipients.length} recipients`);

      const results = [];
      for (let i = 0; i < recipients.length; i++) {
        const recipient = recipients[i];
        const htmlContent = generateHtmlContent(
          recipient.name,
          message,
          recipient.portalLink,
          subject,
          isReminder || false,
          { current: i + 1, total: totalSigners || recipients.length },
          salespersonName
        );

        const result = await sendEmailWithRetry(recipient.email, subject, htmlContent);
        results.push({ email: recipient.email, ...result });

        // Small delay between emails to avoid hitting rate limits
        if (i < recipients.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success);

      console.log(`Batch complete: ${successful}/${recipients.length} emails sent successfully`);

      if (failed.length > 0) {
        console.error("Failed emails:", failed);
      }

      return new Response(
        JSON.stringify({ 
          success: successful > 0, 
          sent: successful, 
          total: recipients.length,
          failed: failed.map(f => ({ email: f.email, error: f.error }))
        }),
        {
          status: failed.length === recipients.length ? 500 : 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } else {
      // Single email flow (legacy)
      const { to, subject, message, portalLink, customerName, isReminder, salespersonName } = body as SingleEmailRequest;

      if (!to || !portalLink) {
        throw new Error("Missing required fields");
      }

      console.log(`Sending ${isReminder ? 'reminder ' : ''}email to ${to} from ${fromName} <${fromEmail}>`);

      const htmlContent = generateHtmlContent(customerName, message, portalLink, subject, isReminder || false, undefined, salespersonName);
      const result = await sendEmailWithRetry(to, subject, htmlContent);

      if (!result.success) {
        throw new Error(result.error || "Failed to send email");
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
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
