import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getResendApiKey } from "../_shared/get-resend-key.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log("Starting daily portal update check...");

    // Get global app_settings as base defaults
    const settingKeys = ["resend_from_email", "resend_from_name", "company_name", "daily_portal_email_enabled", "app_base_url"];
    
    const { data: appSettings } = await supabase
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", settingKeys);

    const globalSettingsMap: Record<string, string> = (appSettings || []).reduce((acc, s) => {
      if (s.setting_value) acc[s.setting_key] = s.setting_value;
      return acc;
    }, {} as Record<string, string>);

    // Check global daily email enabled flag first (all companies)
    const dailyEmailEnabled = globalSettingsMap.daily_portal_email_enabled === "true";
    
    // Pre-fetch all company settings for efficiency
    const { data: allCompanySettings } = await supabase
      .from("company_settings")
      .select("company_id, setting_key, setting_value")
      .in("setting_key", settingKeys);

    // Group by company_id
    const companySettingsCache: Record<string, Record<string, string>> = {};
    for (const cs of allCompanySettings || []) {
      if (!cs.company_id) continue;
      if (!companySettingsCache[cs.company_id]) {
        companySettingsCache[cs.company_id] = {};
      }
      if (cs.setting_value) {
        companySettingsCache[cs.company_id][cs.setting_key] = cs.setting_value;
      }
    }

    // Helper to get merged settings for a specific company
    const getCompanySettings = (companyId: string | null): Record<string, string> => {
      if (!companyId) return globalSettingsMap;
      return { ...globalSettingsMap, ...(companySettingsCache[companyId] || {}) };
    };

    // Check if daily emails are enabled (default is disabled)
    if (!dailyEmailEnabled) {
      console.log("Daily portal emails are disabled in settings");
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "Daily portal emails disabled in admin settings" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate 24 hours ago
    const oneDayAgo = new Date();
    oneDayAgo.setHours(oneDayAgo.getHours() - 24);
    const oneDayAgoStr = oneDayAgo.toISOString();
    
    // Also get start of today for checking manual emails
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTodayStr = startOfToday.toISOString();

    // Find projects with active portal tokens that have been updated in the last 24 hours
    // AND haven't been notified in the last 24 hours
    const { data: activePortals, error: portalsError } = await supabase
      .from("client_portal_tokens")
      .select(`
        id,
        token,
        client_email,
        client_name,
        project_id,
        projects!inner (
          id,
          project_number,
          project_name,
          project_address,
          customer_email,
          customer_first_name,
          customer_last_name,
          updated_at,
          company_id
        )
      `)
      .eq("is_active", true)
      .not("project_id", "is", null);

    if (portalsError) {
      console.error("Error fetching portal tokens:", portalsError);
      return new Response(
        JSON.stringify({ success: false, error: portalsError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${activePortals?.length || 0} active portal tokens`);

    let emailsSent = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Cache for Resend API keys by company_id
    const resendKeyCache: Record<string, string | null> = {};

    for (const portal of activePortals || []) {
      const project = portal.projects as any;
      
      if (!project) {
        console.log(`Skipping portal ${portal.id}: no project data`);
        skipped++;
        continue;
      }

      const customerEmail = project.customer_email || portal.client_email;
      if (!customerEmail) {
        console.log(`Skipping project ${project.project_number}: no customer email`);
        skipped++;
        continue;
      }

      // Check if project was updated in the last 24 hours
      const projectUpdatedAt = new Date(project.updated_at);
      if (projectUpdatedAt < oneDayAgo) {
        console.log(`Skipping project ${project.project_number}: no recent updates`);
        skipped++;
        continue;
      }

      // Check if we already sent a notification in the last 24 hours
      const { data: recentNotification } = await supabase
        .from("project_notification_log")
        .select("id")
        .eq("project_id", project.id)
        .eq("notification_type", "portal_update")
        .gte("sent_at", oneDayAgoStr)
        .limit(1)
        .single();

      if (recentNotification) {
        console.log(`Skipping project ${project.project_number}: already notified within 24 hours`);
        skipped++;
        continue;
      }

      // Check if a MANUAL email was sent today (production manager already sent)
      const { data: manualEmailToday } = await supabase
        .from("project_notification_log")
        .select("id")
        .eq("project_id", project.id)
        .eq("notification_type", "portal_update")
        .eq("is_automated", false)
        .gte("sent_at", startOfTodayStr)
        .limit(1)
        .single();

      if (manualEmailToday) {
        console.log(`Skipping project ${project.project_number}: manual email already sent today`);
        skipped++;
        continue;
      }

      // Also check for changes in related tables
      const { data: agreementChanges } = await supabase
        .from("project_agreements")
        .select("id")
        .eq("project_id", project.id)
        .gte("updated_at", oneDayAgoStr)
        .limit(1);

      const { data: invoiceChanges } = await supabase
        .from("project_invoices")
        .select("id")
        .eq("project_id", project.id)
        .gte("updated_at", oneDayAgoStr)
        .limit(1);

      const { data: documentChanges } = await supabase
        .from("project_documents")
        .select("id")
        .eq("project_id", project.id)
        .gte("created_at", oneDayAgoStr)
        .limit(1);

      const { data: chatMessages } = await supabase
        .from("portal_chat_messages")
        .select("id")
        .eq("project_id", project.id)
        .eq("sender_type", "staff")
        .gte("created_at", oneDayAgoStr)
        .limit(1);

      const hasChanges = 
        (agreementChanges && agreementChanges.length > 0) ||
        (invoiceChanges && invoiceChanges.length > 0) ||
        (documentChanges && documentChanges.length > 0) ||
        (chatMessages && chatMessages.length > 0) ||
        projectUpdatedAt >= oneDayAgo;

      if (!hasChanges) {
        console.log(`Skipping project ${project.project_number}: no significant changes`);
        skipped++;
        continue;
      }

      // Get company-specific Resend API key (with caching)
      const companyId = project.company_id || '_global';
      if (!(companyId in resendKeyCache)) {
        resendKeyCache[companyId] = await getResendApiKey(supabase, project.company_id);
      }
      const RESEND_API_KEY = resendKeyCache[companyId];
      
      if (!RESEND_API_KEY) {
        console.log(`Skipping project ${project.project_number}: No Resend API key for company ${project.company_id || 'global'}`);
        skipped++;
        continue;
      }

      // Get company-specific settings for this project
      const projectSettings = getCompanySettings(project.company_id);
      const fromEmail = projectSettings.resend_from_email || "portal@caprobuilders.com";
      const fromName = projectSettings.resend_from_name || "Capro Builders";
      const companyName = projectSettings.company_name || "Capro Builders";
      const appBaseUrl = projectSettings.app_base_url || "https://crm.ca-probuilders.com";

      // Send the email - use query parameter format for portal URL
      const portalUrl = `${appBaseUrl}/portal?token=${portal.token}`;
      const customerName = `${project.customer_first_name || ''} ${project.customer_last_name || ''}`.trim() || portal.client_name || "Valued Customer";

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
              .project-info { background-color: #e0e7ff; padding: 15px; border-radius: 8px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>${companyName}</h1>
              </div>
              <div class="content">
                <h2>Hello ${customerName},</h2>
                <p>There have been updates to your project in the last 24 hours.</p>
                <p>Please visit your customer portal to view the latest information:</p>
                
                <div class="project-info">
                  <strong>Project #${project.project_number}</strong><br>
                  ${project.project_address || project.project_name || ''}
                </div>
                
                <div style="text-align: center;">
                  <a href="${portalUrl}" class="button">View Your Project Portal</a>
                </div>
                
                <p style="font-size: 14px; color: #666;">
                  If the button doesn't work, copy and paste this link into your browser:<br>
                  <a href="${portalUrl}">${portalUrl}</a>
                </p>
              </div>
              <div class="footer">
                <p>This is an automated notification from ${companyName}</p>
                <p>If you have any questions, please don't hesitate to contact us.</p>
              </div>
            </div>
          </body>
        </html>
      `;

      try {
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: `${fromName} <${fromEmail}>`,
            to: [customerEmail],
            subject: `Project Update Available - ${companyName}`,
            html: htmlContent,
          }),
        });

        if (!emailRes.ok) {
          const errorText = await emailRes.text();
          console.error(`Failed to send email to ${customerEmail}:`, errorText);
          errors.push(`Project ${project.project_number}: ${errorText}`);
          continue;
        }

        // Log the notification (mark as automated)
        await supabase.from("project_notification_log").insert({
          project_id: project.id,
          notification_type: "portal_update",
          sent_to_email: customerEmail,
          sent_by: null, // Automated
          is_automated: true,
          company_id: project.company_id || null,
        });

        console.log(`Email sent to ${customerEmail} for project ${project.project_number}`);
        emailsSent++;

      } catch (emailError) {
        console.error(`Error sending email for project ${project.project_number}:`, emailError);
        errors.push(`Project ${project.project_number}: ${emailError}`);
      }
    }

    console.log(`Daily update complete. Sent: ${emailsSent}, Skipped: ${skipped}, Errors: ${errors.length}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailsSent,
        skipped,
        errors: errors.length > 0 ? errors : undefined
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in send-daily-portal-updates:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
