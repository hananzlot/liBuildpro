import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PortalUpdateEmailRequest {
  projectId: string;
  customMessage?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!RESEND_API_KEY) {
      console.log("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { projectId, customMessage }: PortalUpdateEmailRequest = await req.json();

    if (!projectId) {
      return new Response(
        JSON.stringify({ success: false, error: "Project ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Sending portal update email for project: ${projectId}`);

    // Get project details
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, project_number, project_name, customer_first_name, customer_last_name, customer_email, project_address")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      console.error("Project not found:", projectError);
      return new Response(
        JSON.stringify({ success: false, error: "Project not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!project.customer_email) {
      return new Response(
        JSON.stringify({ success: false, error: "Customer email not available for this project" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get or create portal token
    let portalToken: string | null = null;
    
    // Check for existing active token
    const { data: existingToken } = await supabase
      .from("client_portal_tokens")
      .select("token")
      .eq("project_id", projectId)
      .eq("is_active", true)
      .single();

    if (existingToken?.token) {
      portalToken = existingToken.token;
    } else {
      // Create a new token
      const newToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
      const { data: createdToken, error: tokenError } = await supabase
        .from("client_portal_tokens")
        .insert({
          project_id: projectId,
          token: newToken,
          client_name: `${project.customer_first_name || ''} ${project.customer_last_name || ''}`.trim(),
          client_email: project.customer_email,
          is_active: true,
        })
        .select("token")
        .single();

      if (tokenError) {
        console.error("Error creating portal token:", tokenError);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to create portal access" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      portalToken = createdToken?.token;
    }

    // Get company settings and email template
    const { data: settings } = await supabase
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["resend_from_email", "resend_from_name", "company_name", "email_template_daily_portal_update"]);

    const settingsMap: Record<string, string> = (settings || []).reduce((acc, s) => {
      acc[s.setting_key] = s.setting_value || "";
      return acc;
    }, {} as Record<string, string>);

    const fromEmail = settingsMap.resend_from_email || "portal@caprobuilders.com";
    const fromName = settingsMap.resend_from_name || "Capro Builders";
    const companyName = settingsMap.company_name || "Capro Builders";

    // Parse email template if exists
    let emailSubject = "Project Update Available - {{company_name}}";
    let emailBody = `Hello {{customer_name}},

There have been updates to your project.

**Project Details:**
- Project #: {{project_number}}
- Address: {{project_address}}

Please visit your customer portal to view the latest information.

Best regards,
The {{company_name}} Team`;

    if (settingsMap.email_template_daily_portal_update) {
      try {
        const template = JSON.parse(settingsMap.email_template_daily_portal_update);
        emailSubject = template.subject || emailSubject;
        emailBody = template.body || emailBody;
      } catch (e) {
        console.log("Could not parse email template, using defaults");
      }
    }

    // Build portal URL - use query parameter format
    const portalUrl = `https://crm-caprobuilders.lovable.app/portal?token=${portalToken}`;

    const customerName = `${project.customer_first_name || ''} ${project.customer_last_name || ''}`.trim() || "Valued Customer";

    // Replace template variables
    const templateVars: Record<string, string> = {
      customer_name: customerName,
      company_name: companyName,
      project_number: String(project.project_number),
      project_address: project.project_address || project.project_name || '',
    };

    let finalSubject = emailSubject;
    let finalBody = emailBody;
    
    Object.entries(templateVars).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, "g");
      finalSubject = finalSubject.replace(regex, value);
      finalBody = finalBody.replace(regex, value);
    });

    // Convert markdown-style bold to HTML
    finalBody = finalBody.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    finalBody = finalBody.replace(/\n/g, '<br />');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #1a365d; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px 20px; background-color: #f9fafb; }
            .button { display: inline-block; background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }
            .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${companyName}</h1>
            </div>
            <div class="content">
              ${finalBody}
              
              <div style="text-align: center; margin-top: 20px;">
                <a href="${portalUrl}" class="button">View Your Customer Portal</a>
              </div>
              
              <p style="font-size: 14px; color: #666; margin-top: 20px;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${portalUrl}">${portalUrl}</a>
              </p>
            </div>
            <div class="footer">
              <p>This email was sent by ${companyName}</p>
              <p>If you have any questions, please don't hesitate to contact us.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send email
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [project.customer_email],
        subject: finalSubject,
        html: htmlContent,
      }),
    });

    if (!emailRes.ok) {
      const errorText = await emailRes.text();
      console.error("Failed to send email:", errorText);
      return new Response(
        JSON.stringify({ success: false, error: `Email send failed: ${errorText}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailData = await emailRes.json();
    console.log("Email sent successfully:", emailData);

    // Log the notification
    const authHeader = req.headers.get("authorization");
    let userId = null;
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
      userId = user?.id;
    }

    await supabase.from("project_notification_log").insert({
      project_id: projectId,
      notification_type: "portal_update",
      sent_to_email: project.customer_email,
      sent_by: userId,
      is_automated: false, // Manual send
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Email sent to ${project.customer_email}`,
        emailId: emailData.id 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in send-portal-update-email:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
