import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  estimateId: string;
  action: 'accepted' | 'declined';
  customerEmail: string;
  customerName: string;
}

const DEFAULT_TEMPLATES: Record<string, { subject: string; body: string }> = {
  proposal_accepted: {
    subject: "🎉 Thank You for Choosing {{company_name}}!",
    body: `Dear {{customer_name}},

Congratulations and thank you for selecting {{company_name}} for your project!

We are absolutely thrilled and honored that you've chosen us. Our team is excited to bring your vision to life and deliver exceptional results.

**What happens next:**
1. Our project manager will contact you within 24-48 hours to schedule a kickoff meeting
2. We'll review all project details and timeline with you
3. You'll receive information about your dedicated project team

**Your Project Details:**
- Proposal: {{estimate_title}}
- Contract #: CNT-{{estimate_number}}
- Project Value: {{total}}

If you have any questions in the meantime, please don't hesitate to reach out.

Thank you again for your trust in us. We can't wait to get started!

Warmest regards,
The {{company_name}} Team`,
  },
  proposal_declined: {
    subject: "We received your response - {{company_name}}",
    body: `Dear {{customer_name}},

Thank you for taking the time to review our proposal for {{estimate_title}}.

We understand that this proposal wasn't the right fit for you at this time. We truly appreciate your consideration and the opportunity to provide you with a quote.

If there's anything we could do differently, or if you'd like to discuss alternative options, please don't hesitate to reach out. We're always here to help and would welcome the chance to work with you in the future.

Thank you again for considering {{company_name}}.

Best regards,
The {{company_name}} Team`,
  },
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      console.log("RESEND_API_KEY not configured, skipping customer email");
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { estimateId, action, customerEmail, customerName }: EmailRequest = await req.json();

    if (!customerEmail) {
      console.log("No customer email provided, skipping");
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "No email" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Sending ${action} confirmation to customer ${customerEmail}`);

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Fetch settings and estimate
    const [settingsRes, estimateRes] = await Promise.all([
      supabase
        .from("app_settings")
        .select("setting_key, setting_value")
        .or(`setting_key.eq.resend_from_email,setting_key.eq.resend_from_name,setting_key.eq.company_name,setting_key.like.email_template_proposal_${action}`),
      supabase.from("estimates").select("*").eq("id", estimateId).single(),
    ]);

    const settingsMap = (settingsRes.data || []).reduce((acc: Record<string, string>, s: any) => {
      acc[s.setting_key] = s.setting_value;
      return acc;
    }, {});

    const fromEmail = settingsMap.resend_from_email || "proposals@caprobuilders.com";
    const fromName = settingsMap.resend_from_name || "Capro Builders";
    const companyName = settingsMap.company_name || "Capro Builders";

    const estimate = estimateRes.data;
    if (!estimate) {
      throw new Error("Estimate not found");
    }

    // Get template - either custom or default
    const templateKey = `email_template_proposal_${action}`;
    let template = DEFAULT_TEMPLATES[`proposal_${action}`];
    
    if (settingsMap[templateKey]) {
      try {
        template = JSON.parse(settingsMap[templateKey]);
      } catch {
        console.log("Failed to parse custom template, using default");
      }
    }

    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount || 0);
    };

    // Replace template variables
    const variables: Record<string, string> = {
      customer_name: customerName,
      company_name: companyName,
      estimate_title: estimate.estimate_title || '',
      estimate_number: String(estimate.estimate_number),
      total: formatCurrency(estimate.total),
      job_address: estimate.job_address || '',
    };

    let subject = template.subject;
    let body = template.body;
    
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, "g");
      subject = subject.replace(regex, value);
      body = body.replace(regex, value);
    });

    // Convert markdown-style bold to HTML
    const htmlBody = body
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br />');

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
              border-bottom: 2px solid ${action === 'accepted' ? '#22c55e' : '#6b7280'};
              margin-bottom: 30px;
            }
            .header h1 {
              color: #1a1a2e;
              margin: 0;
              font-size: 24px;
            }
            .content {
              padding: 20px 0;
              font-size: 15px;
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
            ${htmlBody}
          </div>
          
          <div class="footer">
            <p>This email was sent by ${companyName}</p>
          </div>
        </body>
      </html>
    `;

    // Send email with retry logic
    const sendEmailWithRetry = async (maxRetries = 3, baseDelay = 1000): Promise<Response> => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: `${fromName} <${fromEmail}>`,
            to: [customerEmail],
            subject: subject,
            html: htmlContent,
          }),
        });

        if (res.ok) {
          return res;
        }

        if (res.status === 429 && attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          console.log(`Rate limited, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        const errorText = await res.text();
        throw new Error(`Failed to send email: ${errorText}`);
      }
      throw new Error("Max retries exceeded");
    };

    const res = await sendEmailWithRetry();
    const resData = await res.json();

    console.log("Customer email sent successfully:", resData);

    return new Response(JSON.stringify({ success: true, data: resData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error sending customer email:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    // Don't fail the operation if email fails
    return new Response(
      JSON.stringify({ success: false, error: message }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});