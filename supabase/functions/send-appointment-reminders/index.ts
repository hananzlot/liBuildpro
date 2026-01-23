import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getResendApiKey } from "../_shared/get-resend-key.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

interface Appointment {
  id: string;
  ghl_id: string;
  title: string | null;
  start_time: string | null;
  contact_id: string | null;
  assigned_user_id: string | null;
  appointment_status: string | null;
  company_id: string | null;
}

interface Contact {
  ghl_id: string;
  contact_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
}

interface GHLUser {
  ghl_id: string;
  name: string | null;
  email: string | null;
}

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Los_Angeles",
  });
};

const sendEmail = async (
  resendApiKey: string,
  to: string,
  subject: string,
  html: string,
  fromEmail: string,
  fromName: string
) => {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [to],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Email send error:", error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Email exception:", error);
    return false;
  }
};

const createNotification = async (
  ghlUserId: string,
  title: string,
  message: string,
  appointmentGhlId: string
) => {
  const { error } = await supabase.from("notifications").insert({
    ghl_user_id: ghlUserId,
    title,
    message,
    type: "reminder",
    appointment_ghl_id: appointmentGhlId,
  });
  if (error) {
    console.error("Notification insert error:", error);
  }
};

const checkAndSendReminders = async () => {
  const now = new Date();
  const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  
  // Buffer windows for checking (30 minutes before and after target time)
  const oneDayWindowStart = new Date(oneDayFromNow.getTime() - 30 * 60 * 1000);
  const oneDayWindowEnd = new Date(oneDayFromNow.getTime() + 30 * 60 * 1000);
  const twoHoursWindowStart = new Date(twoHoursFromNow.getTime() - 30 * 60 * 1000);
  const twoHoursWindowEnd = new Date(twoHoursFromNow.getTime() + 30 * 60 * 1000);

  console.log("Checking reminders at:", now.toISOString());
  console.log("1-day window:", oneDayWindowStart.toISOString(), "-", oneDayWindowEnd.toISOString());
  console.log("2-hour window:", twoHoursWindowStart.toISOString(), "-", twoHoursWindowEnd.toISOString());

  // Fetch appointments in both windows (including company_id)
  const { data: appointments, error: apptError } = await supabase
    .from("appointments")
    .select("*, company_id")
    .or(`and(start_time.gte.${oneDayWindowStart.toISOString()},start_time.lte.${oneDayWindowEnd.toISOString()}),and(start_time.gte.${twoHoursWindowStart.toISOString()},start_time.lte.${twoHoursWindowEnd.toISOString()})`)
    .neq("appointment_status", "cancelled");

  if (apptError) {
    console.error("Error fetching appointments:", apptError);
    return { error: apptError.message };
  }

  console.log("Found", appointments?.length || 0, "appointments in reminder windows");

  if (!appointments || appointments.length === 0) {
    return { sent: 0, message: "No appointments in reminder windows" };
  }

  // Fetch contacts and users for email details
  const contactIds = [...new Set(appointments.map(a => a.contact_id).filter(Boolean))];
  const userIds = [...new Set(appointments.map(a => a.assigned_user_id).filter(Boolean))];

  const { data: contacts } = await supabase
    .from("contacts")
    .select("ghl_id, contact_name, first_name, last_name, email, phone")
    .in("ghl_id", contactIds);

  const { data: users } = await supabase
    .from("ghl_users")
    .select("ghl_id, name, email")
    .in("ghl_id", userIds);

  const contactMap = new Map<string, Contact>();
  contacts?.forEach(c => contactMap.set(c.ghl_id, c));

  const userMap = new Map<string, GHLUser>();
  users?.forEach(u => userMap.set(u.ghl_id, u));

  // Cache for Resend API keys and settings by company_id
  const resendKeyCache: Record<string, string | null> = {};
  const settingsCache: Record<string, { fromEmail: string; fromName: string; companyName: string }> = {};

  // Helper to get settings for a company
  const getCompanyEmailSettings = async (companyId: string | null): Promise<{ fromEmail: string; fromName: string; companyName: string }> => {
    const cacheKey = companyId || '_global';
    if (settingsCache[cacheKey]) return settingsCache[cacheKey];

    const settingKeys = ["resend_from_email", "resend_from_name", "company_name"];
    let settings: Record<string, string> = {};

    // Get company-specific settings if companyId provided
    if (companyId) {
      const { data: companySettings } = await supabase
        .from("company_settings")
        .select("setting_key, setting_value")
        .eq("company_id", companyId)
        .in("setting_key", settingKeys);
      
      for (const s of companySettings || []) {
        if (s.setting_value) settings[s.setting_key] = s.setting_value;
      }
    }

    // Fallback to app_settings
    const { data: appSettings } = await supabase
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", settingKeys);
    
    for (const s of appSettings || []) {
      if (s.setting_value && !settings[s.setting_key]) {
        settings[s.setting_key] = s.setting_value;
      }
    }

    settingsCache[cacheKey] = {
      fromEmail: settings.resend_from_email || "reminders@resend.dev",
      fromName: settings.resend_from_name || settings.company_name || "CA Pro Builders",
      companyName: settings.company_name || "CA Pro Builders",
    };

    return settingsCache[cacheKey];
  };

  let sentCount = 0;

  for (const appt of appointments as Appointment[]) {
    const startTime = new Date(appt.start_time!);
    const contact = appt.contact_id ? contactMap.get(appt.contact_id) : null;
    const user = appt.assigned_user_id ? userMap.get(appt.assigned_user_id) : null;
    
    const contactName = contact?.contact_name || 
      `${contact?.first_name || ""} ${contact?.last_name || ""}`.trim() || 
      "Customer";
    const userName = user?.name || "Team Member";
    const formattedTime = formatDate(appt.start_time!);

    // Get company-specific Resend API key (with caching)
    const companyId = appt.company_id || '_global';
    if (!(companyId in resendKeyCache)) {
      resendKeyCache[companyId] = await getResendApiKey(supabase, appt.company_id);
    }
    const resendApiKey = resendKeyCache[companyId];
    
    if (!resendApiKey) {
      console.log(`Skipping appointment ${appt.ghl_id}: No Resend API key for company ${appt.company_id || 'global'}`);
      continue;
    }

    // Get company email settings
    const emailSettings = await getCompanyEmailSettings(appt.company_id);

    // Determine which reminder type based on time difference
    const timeDiff = startTime.getTime() - now.getTime();
    const isOneDayReminder = timeDiff >= 23 * 60 * 60 * 1000 && timeDiff <= 25 * 60 * 60 * 1000;
    const isTwoHourReminder = timeDiff >= 1.5 * 60 * 60 * 1000 && timeDiff <= 2.5 * 60 * 60 * 1000;

    const reminderTypes: Array<{ type: string; label: string }> = [];
    if (isOneDayReminder) reminderTypes.push({ type: "1_day", label: "tomorrow" });
    if (isTwoHourReminder) reminderTypes.push({ type: "2_hours", label: "in 2 hours" });

    for (const reminder of reminderTypes) {
      // Send to sales rep
      if (user?.email) {
        // Check if already sent
        const { data: existing } = await supabase
          .from("appointment_reminders")
          .select("id")
          .eq("appointment_ghl_id", appt.ghl_id)
          .eq("reminder_type", reminder.type)
          .eq("recipient_type", "sales_rep")
          .maybeSingle();

        if (!existing) {
          const subject = `Reminder: Appointment ${reminder.label} with ${contactName}`;
          const html = `
            <h2>Appointment Reminder</h2>
            <p>Hi ${userName},</p>
            <p>This is a reminder that you have an appointment <strong>${reminder.label}</strong>:</p>
            <ul>
              <li><strong>Title:</strong> ${appt.title || "Appointment"}</li>
              <li><strong>With:</strong> ${contactName}</li>
              <li><strong>When:</strong> ${formattedTime}</li>
              ${contact?.phone ? `<li><strong>Phone:</strong> ${contact.phone}</li>` : ""}
            </ul>
            <p>Best regards,<br>${emailSettings.companyName}</p>
          `;

          const sent = await sendEmail(resendApiKey, user.email, subject, html, emailSettings.fromEmail, emailSettings.fromName);
          if (sent) {
            await supabase.from("appointment_reminders").insert({
              appointment_id: appt.id,
              appointment_ghl_id: appt.ghl_id,
              reminder_type: reminder.type,
              recipient_type: "sales_rep",
              recipient_email: user.email,
              company_id: appt.company_id || null,
            });
            sentCount++;
            console.log(`Sent ${reminder.type} reminder to sales rep:`, user.email);
          }

          // Create in-app notification
          await createNotification(
            appt.assigned_user_id!,
            `Appointment ${reminder.label}`,
            `You have an appointment with ${contactName} ${reminder.label} at ${formattedTime}`,
            appt.ghl_id
          );
        }
      }

      // Send to contact
      if (contact?.email) {
        const { data: existing } = await supabase
          .from("appointment_reminders")
          .select("id")
          .eq("appointment_ghl_id", appt.ghl_id)
          .eq("reminder_type", reminder.type)
          .eq("recipient_type", "contact")
          .maybeSingle();

        if (!existing) {
          const subject = `Reminder: Your Appointment ${reminder.label} with ${emailSettings.companyName}`;
          const html = `
            <h2>Appointment Reminder</h2>
            <p>Hi ${contactName},</p>
            <p>This is a friendly reminder about your upcoming appointment <strong>${reminder.label}</strong>:</p>
            <ul>
              <li><strong>Title:</strong> ${appt.title || "Appointment"}</li>
              <li><strong>When:</strong> ${formattedTime}</li>
              <li><strong>With:</strong> ${userName}</li>
            </ul>
            <p>We look forward to seeing you!</p>
            <p>Best regards,<br>${emailSettings.companyName} Team</p>
          `;

          const sent = await sendEmail(resendApiKey, contact.email, subject, html, emailSettings.fromEmail, emailSettings.fromName);
          if (sent) {
            await supabase.from("appointment_reminders").insert({
              appointment_id: appt.id,
              appointment_ghl_id: appt.ghl_id,
              reminder_type: reminder.type,
              recipient_type: "contact",
              recipient_email: contact.email,
              company_id: appt.company_id || null,
            });
            sentCount++;
            console.log(`Sent ${reminder.type} reminder to contact:`, contact.email);
          }
        }
      }
    }
  }

  return { sent: sentCount, checked: appointments.length };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting appointment reminder check...");
    const result = await checkAndSendReminders();
    console.log("Reminder check complete:", result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in send-appointment-reminders:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
