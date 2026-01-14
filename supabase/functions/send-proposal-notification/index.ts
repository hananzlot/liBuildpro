import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  estimateId: string;
  action: 'accepted' | 'declined';
  customerName: string;
  declineReason?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      console.log("RESEND_API_KEY not configured, skipping notification email");
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase client to fetch settings
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Fetch email settings and estimate details
    const [settingsRes, estimateRes, usersRes] = await Promise.all([
      supabase
        .from("app_settings")
        .select("setting_key, setting_value")
        .in("setting_key", ["resend_from_email", "resend_from_name", "company_name", "notification_email"]),
      supabase.from("estimates").select("*").eq("id", (await req.json()).estimateId).single(),
      supabase.from("profiles").select("email").limit(10), // Get first 10 admins/users
    ]);

    // Re-parse the request body
    const body = await req.clone().json();
    const { estimateId, action, customerName, declineReason }: NotificationRequest = body;

    console.log(`Sending ${action} notification for estimate ${estimateId}`);

    const settingsMap = (settingsRes.data || []).reduce((acc: Record<string, string>, s: any) => {
      acc[s.setting_key] = s.setting_value;
      return acc;
    }, {});

    const fromEmail = settingsMap.resend_from_email || "proposals@caprobuilders.com";
    const fromName = settingsMap.resend_from_name || "Capro Builders";
    const companyName = settingsMap.company_name || "Capro Builders";
    const notificationEmail = settingsMap.notification_email;

    // Get estimate data
    const estimate = estimateRes.data;
    if (!estimate) {
      throw new Error("Estimate not found");
    }

    // Determine recipients - use notification_email or fallback to first admin
    const recipients: string[] = [];
    if (notificationEmail) {
      recipients.push(notificationEmail);
    } else if (usersRes.data && usersRes.data.length > 0) {
      recipients.push(usersRes.data[0].email);
    }

    if (recipients.length === 0) {
      console.log("No notification recipients configured");
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "No recipients" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount || 0);
    };

    const isAccepted = action === 'accepted';
    const subject = isAccepted 
      ? `🎉 Proposal Accepted: ${estimate.estimate_title}` 
      : `❌ Proposal Declined: ${estimate.estimate_title}`;

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
              border-bottom: 2px solid ${isAccepted ? '#22c55e' : '#ef4444'};
              margin-bottom: 30px;
            }
            .header h1 {
              color: ${isAccepted ? '#16a34a' : '#dc2626'};
              margin: 0;
              font-size: 24px;
            }
            .content {
              padding: 20px 0;
            }
            .info-card {
              background: #f9fafb;
              border-radius: 8px;
              padding: 20px;
              margin: 20px 0;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              border-bottom: 1px solid #e5e7eb;
            }
            .info-row:last-child {
              border-bottom: none;
            }
            .label {
              color: #6b7280;
            }
            .value {
              font-weight: 600;
            }
            .decline-reason {
              background: #fef2f2;
              border: 1px solid #fecaca;
              border-radius: 8px;
              padding: 15px;
              margin: 20px 0;
            }
            .decline-reason h4 {
              color: #dc2626;
              margin: 0 0 10px 0;
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
            <h1>${isAccepted ? '🎉 Proposal Accepted!' : '❌ Proposal Declined'}</h1>
          </div>
          
          <div class="content">
            <p>${isAccepted 
              ? `Great news! ${customerName} has accepted and signed your proposal.` 
              : `${customerName} has declined your proposal.`}</p>
            
            <div class="info-card">
              <div class="info-row">
                <span class="label">Customer</span>
                <span class="value">${estimate.customer_name}</span>
              </div>
              <div class="info-row">
                <span class="label">Proposal</span>
                <span class="value">${estimate.estimate_title}</span>
              </div>
              <div class="info-row">
                <span class="label">Estimate #</span>
                <span class="value">EST-${estimate.estimate_number}</span>
              </div>
              <div class="info-row">
                <span class="label">Amount</span>
                <span class="value">${formatCurrency(estimate.total)}</span>
              </div>
              ${estimate.job_address ? `
              <div class="info-row">
                <span class="label">Job Address</span>
                <span class="value">${estimate.job_address}</span>
              </div>
              ` : ''}
            </div>
            
            ${!isAccepted && declineReason ? `
            <div class="decline-reason">
              <h4>Reason for Decline:</h4>
              <p>${declineReason}</p>
            </div>
            ` : ''}
            
            ${isAccepted ? `
            <p><strong>Next Steps:</strong></p>
            <ul>
              <li>Review the signed contract in your CRM</li>
              <li>Schedule the project kickoff</li>
              <li>Send deposit invoice if applicable</li>
            </ul>
            ` : `
            <p><strong>Suggested Actions:</strong></p>
            <ul>
              <li>Review the feedback and consider revisions</li>
              <li>Reach out to the customer to discuss alternatives</li>
              <li>Create a new estimate if needed</li>
            </ul>
            `}
          </div>
          
          <div class="footer">
            <p>This notification was sent by ${companyName} CRM</p>
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
            to: recipients,
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

    console.log("Notification email sent successfully:", resData);

    return new Response(JSON.stringify({ success: true, data: resData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error sending notification:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    // Don't fail the whole operation if notification fails
    return new Response(
      JSON.stringify({ success: false, error: message }),
      {
        status: 200, // Return 200 so the main operation doesn't fail
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});