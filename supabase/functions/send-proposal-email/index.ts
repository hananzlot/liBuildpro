import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

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

    const { to, subject, message, portalLink, customerName }: EmailRequest = await req.json();

    if (!to || !portalLink) {
      throw new Error("Missing required fields");
    }

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
            <h1>Capro Builders</h1>
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
            <p>This email was sent by Capro Builders</p>
            <p>If you have any questions, please contact us directly.</p>
          </div>
        </body>
      </html>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Capro Builders <proposals@resend.dev>",
        to: [to],
        subject: subject,
        html: htmlContent,
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Failed to send email: ${error}`);
    }

    const data = await res.json();

    return new Response(JSON.stringify({ success: true, data }), {
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
