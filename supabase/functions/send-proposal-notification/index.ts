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
  estimateId?: string;
  documentId?: string;
  documentName?: string;
  action: 'accepted' | 'declined' | 'document_signed' | 'document_declined';
  customerName?: string;
  recipientName?: string;
  recipientEmail?: string;
  declineReason?: string;
  signedAt?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let body: NotificationRequest;
  
  try {
    // Clone request before reading body to avoid "Body is unusable" error
    const clonedReq = req.clone();
    body = await clonedReq.json();
  } catch (parseError) {
    console.error("Failed to parse request body:", parseError);
    return new Response(
      JSON.stringify({ success: false, error: "Invalid request body" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const { 
      estimateId, 
      documentId,
      documentName,
      action, 
      customerName, 
      recipientName,
      recipientEmail,
      declineReason,
      signedAt 
    } = body;

    console.log(`Processing ${action} notification`, body);

    if (!RESEND_API_KEY) {
      console.log("RESEND_API_KEY not configured, skipping notification email");
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Fetch email settings
    const { data: settingsData } = await supabase
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["resend_from_email", "resend_from_name", "company_name", "notification_email"]);

    const settingsMap = (settingsData || []).reduce((acc: Record<string, string>, s: any) => {
      acc[s.setting_key] = s.setting_value;
      return acc;
    }, {});

    const fromEmail = settingsMap.resend_from_email || "proposals@caprobuilders.com";
    const fromName = settingsMap.resend_from_name || "Capro Builders";
    const companyName = settingsMap.company_name || "Capro Builders";
    const notificationEmails = settingsMap.notification_email;

    // Get recipients - support comma-separated list
    const recipients: string[] = [];
    if (notificationEmails) {
      // Parse comma-separated emails, trim whitespace, filter empty/invalid
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const parsedEmails = notificationEmails
        .split(',')
        .map((email: string) => email.trim())
        .filter((email: string) => email && emailRegex.test(email));
      recipients.push(...parsedEmails);
    }
    
    // Fallback to first admin if no valid emails configured
    if (recipients.length === 0) {
      const { data: usersData } = await supabase.from("profiles").select("email").limit(1);
      if (usersData && usersData.length > 0 && usersData[0].email) {
        recipients.push(usersData[0].email);
      }
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

    let subject = '';
    let htmlContent = '';

    // Handle document signature notifications
    if (action === 'document_signed' || action === 'document_declined') {
      const isDocSigned = action === 'document_signed';
      const signerName = recipientName || customerName || 'Customer';
      const docName = documentName || 'Document';
      
      subject = isDocSigned 
        ? `✅ Document Signed: ${docName}` 
        : `❌ Document Declined: ${docName}`;

      htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${subject}</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { text-align: center; padding: 20px 0; border-bottom: 2px solid ${isDocSigned ? '#22c55e' : '#ef4444'}; margin-bottom: 30px; }
              .header h1 { color: ${isDocSigned ? '#16a34a' : '#dc2626'}; margin: 0; font-size: 24px; }
              .info-card { background: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0; }
              .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
              .info-row:last-child { border-bottom: none; }
              .label { color: #6b7280; }
              .value { font-weight: 600; }
              .decline-reason { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 15px; margin: 20px 0; }
              .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #666; text-align: center; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>${isDocSigned ? '✅ Document Signed!' : '❌ Document Declined'}</h1>
            </div>
            <div class="content">
              <p>${isDocSigned 
                ? `${signerName} has signed your document.` 
                : `${signerName} has declined your document.`}</p>
              <div class="info-card">
                <div class="info-row">
                  <span class="label">Document</span>
                  <span class="value">${docName}</span>
                </div>
                <div class="info-row">
                  <span class="label">Signer</span>
                  <span class="value">${signerName}</span>
                </div>
                ${recipientEmail ? `
                <div class="info-row">
                  <span class="label">Email</span>
                  <span class="value">${recipientEmail}</span>
                </div>
                ` : ''}
                ${signedAt ? `
                <div class="info-row">
                  <span class="label">Date</span>
                  <span class="value">${new Date(signedAt).toLocaleString()}</span>
                </div>
                ` : ''}
              </div>
              ${!isDocSigned && declineReason ? `
              <div class="decline-reason">
                <h4 style="color: #dc2626; margin: 0 0 10px 0;">Reason for Decline:</h4>
                <p>${declineReason}</p>
              </div>
              ` : ''}
            </div>
            <div class="footer">
              <p>This notification was sent by ${companyName} CRM</p>
            </div>
          </body>
        </html>
      `;
    } else {
      // Handle estimate/proposal notifications
      if (!estimateId) {
        throw new Error("estimateId is required for proposal notifications");
      }

      const { data: estimate, error: estError } = await supabase
        .from("estimates")
        .select("*")
        .eq("id", estimateId)
        .single();

      if (estError || !estimate) {
        throw new Error("Estimate not found");
      }

      const isAccepted = action === 'accepted';
      subject = isAccepted 
        ? `🎉 Proposal Accepted: ${estimate.estimate_title}` 
        : `❌ Proposal Declined: ${estimate.estimate_title}`;

      htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${subject}</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { text-align: center; padding: 20px 0; border-bottom: 2px solid ${isAccepted ? '#22c55e' : '#ef4444'}; margin-bottom: 30px; }
              .header h1 { color: ${isAccepted ? '#16a34a' : '#dc2626'}; margin: 0; font-size: 24px; }
              .info-card { background: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0; }
              .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
              .info-row:last-child { border-bottom: none; }
              .label { color: #6b7280; }
              .value { font-weight: 600; }
              .decline-reason { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 15px; margin: 20px 0; }
              .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #666; text-align: center; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>${isAccepted ? '🎉 Proposal Accepted!' : '❌ Proposal Declined'}</h1>
            </div>
            <div class="content">
              <p>${isAccepted 
                ? `Great news! ${customerName || estimate.customer_name} has accepted and signed your proposal.` 
                : `${customerName || estimate.customer_name} has declined your proposal.`}</p>
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
                ${isAccepted && estimate.signed_at ? `
                <div class="info-row">
                  <span class="label">Date Signed</span>
                  <span class="value">${new Date(estimate.signed_at).toLocaleString()}</span>
                </div>
                ` : ''}
                ${!isAccepted && estimate.declined_at ? `
                <div class="info-row">
                  <span class="label">Date Declined</span>
                  <span class="value">${new Date(estimate.declined_at).toLocaleString()}</span>
                </div>
                ` : ''}
              </div>
              ${!isAccepted && declineReason ? `
              <div class="decline-reason">
                <h4 style="color: #dc2626; margin: 0 0 10px 0;">Reason for Decline:</h4>
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
    }

    // Send email
    console.log(`Sending notification to: ${recipients.join(', ')}`);
    
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

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Failed to send email:", errorText);
      throw new Error(`Failed to send email: ${errorText}`);
    }

    const resData = await res.json();
    console.log("Notification email sent successfully:", resData);

    return new Response(JSON.stringify({ success: true, data: resData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error sending notification:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    // Return 200 so the main operation doesn't fail
    return new Response(
      JSON.stringify({ success: false, error: message }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
