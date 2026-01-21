import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, webhook-id, webhook-timestamp, webhook-signature",
};

interface AuthEmailPayload {
  user: {
    id: string;
    email: string;
    user_metadata?: {
      full_name?: string;
    };
  };
  email_data: {
    token?: string;
    token_hash?: string;
    redirect_to?: string;
    email_action_type: 'signup' | 'recovery' | 'magic_link' | 'email_change' | 'invite';
    site_url?: string;
    confirmation_url?: string;
  };
}

interface PlatformSettings {
  from_email: string | null;
  from_name: string | null;
  support_email: string | null;
  logo_url: string | null;
  enabled: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getPlatformSettings(supabase: any): Promise<PlatformSettings> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('setting_key, setting_value')
    .in('setting_key', [
      'platform_resend_from_email',
      'platform_resend_from_name',
      'platform_support_email',
      'platform_logo_url',
      'platform_auth_emails_enabled'
    ]);

  if (error) {
    console.error('Error fetching platform settings:', error);
    return { from_email: null, from_name: null, support_email: null, logo_url: null, enabled: false };
  }

  const settings: Record<string, string | null> = {};
  if (data) {
    for (const row of data) {
      settings[row.setting_key as string] = row.setting_value;
    }
  }

  return {
    from_email: settings['platform_resend_from_email'] || null,
    from_name: settings['platform_resend_from_name'] || null,
    support_email: settings['platform_support_email'] || null,
    logo_url: settings['platform_logo_url'] || null,
    enabled: settings['platform_auth_emails_enabled'] === 'true'
  };
}

function getEmailSubject(emailType: string): string {
  switch (emailType) {
    case 'signup':
      return 'Confirm your email address';
    case 'recovery':
      return 'Reset your password';
    case 'magic_link':
      return 'Your login link';
    case 'email_change':
      return 'Confirm your new email address';
    case 'invite':
      return "You've been invited";
    default:
      return 'Action required';
  }
}

function generateEmailHtml(
  emailType: string,
  settings: PlatformSettings,
  payload: AuthEmailPayload
): string {
  const userName = payload.user.user_metadata?.full_name || payload.user.email.split('@')[0];
  const token = payload.email_data.token || '';
  const confirmationUrl = payload.email_data.confirmation_url || '';
  const fromName = settings.from_name || 'Our Team';
  const supportEmail = settings.support_email || '';
  
  // Logo section
  const logoHtml = settings.logo_url 
    ? `<img src="${settings.logo_url}" alt="${fromName}" style="max-height: 60px; margin-bottom: 24px;" />`
    : `<h1 style="font-size: 24px; font-weight: bold; color: #1a1a1a; margin-bottom: 24px;">${fromName}</h1>`;

  // Footer
  const footerHtml = supportEmail 
    ? `<p style="margin-top: 32px; font-size: 12px; color: #888;">Questions? Contact us at <a href="mailto:${supportEmail}" style="color: #666;">${supportEmail}</a></p>`
    : '';

  let contentHtml = '';

  switch (emailType) {
    case 'signup':
      contentHtml = `
        <h2 style="font-size: 20px; color: #1a1a1a; margin-bottom: 16px;">Welcome, ${userName}!</h2>
        <p style="font-size: 16px; color: #4a4a4a; margin-bottom: 24px;">
          Thanks for signing up! Please confirm your email address by entering the code below:
        </p>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 24px;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #1a1a1a;">${token}</span>
        </div>
        <p style="font-size: 14px; color: #666;">
          Or click the link below to confirm:
        </p>
        <a href="${confirmationUrl}" style="display: inline-block; background: #1a1a1a; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 12px;">
          Confirm Email
        </a>
      `;
      break;

    case 'recovery':
      contentHtml = `
        <h2 style="font-size: 20px; color: #1a1a1a; margin-bottom: 16px;">Reset Your Password</h2>
        <p style="font-size: 16px; color: #4a4a4a; margin-bottom: 24px;">
          We received a request to reset your password. Click the button below to set a new password:
        </p>
        <a href="${confirmationUrl}" style="display: inline-block; background: #1a1a1a; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
          Reset Password
        </a>
        <p style="font-size: 14px; color: #666; margin-top: 24px;">
          If you didn't request this, you can safely ignore this email.
        </p>
      `;
      break;

    case 'magic_link':
      contentHtml = `
        <h2 style="font-size: 20px; color: #1a1a1a; margin-bottom: 16px;">Your Login Link</h2>
        <p style="font-size: 16px; color: #4a4a4a; margin-bottom: 24px;">
          Click the button below to log in to your account:
        </p>
        <a href="${confirmationUrl}" style="display: inline-block; background: #1a1a1a; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
          Log In
        </a>
        <p style="font-size: 14px; color: #666; margin-top: 24px;">
          This link will expire in 1 hour. If you didn't request this, you can ignore this email.
        </p>
      `;
      break;

    case 'email_change':
      contentHtml = `
        <h2 style="font-size: 20px; color: #1a1a1a; margin-bottom: 16px;">Confirm Your New Email</h2>
        <p style="font-size: 16px; color: #4a4a4a; margin-bottom: 24px;">
          Please confirm your new email address by entering the code below:
        </p>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 24px;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #1a1a1a;">${token}</span>
        </div>
        <p style="font-size: 14px; color: #666;">
          Or click the link below:
        </p>
        <a href="${confirmationUrl}" style="display: inline-block; background: #1a1a1a; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 12px;">
          Confirm New Email
        </a>
      `;
      break;

    case 'invite':
      contentHtml = `
        <h2 style="font-size: 20px; color: #1a1a1a; margin-bottom: 16px;">You've Been Invited!</h2>
        <p style="font-size: 16px; color: #4a4a4a; margin-bottom: 24px;">
          You've been invited to join. Click the button below to accept the invitation and set up your account:
        </p>
        <a href="${confirmationUrl}" style="display: inline-block; background: #1a1a1a; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
          Accept Invitation
        </a>
      `;
      break;

    default:
      contentHtml = `
        <h2 style="font-size: 20px; color: #1a1a1a; margin-bottom: 16px;">Action Required</h2>
        <p style="font-size: 16px; color: #4a4a4a; margin-bottom: 24px;">
          Please click the link below to continue:
        </p>
        <a href="${confirmationUrl}" style="display: inline-block; background: #1a1a1a; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
          Continue
        </a>
      `;
  }

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9f9f9; margin: 0; padding: 40px 20px;">
        <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
          <div style="text-align: center;">
            ${logoHtml}
          </div>
          ${contentHtml}
          ${footerHtml}
        </div>
      </body>
    </html>
  `;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const hookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase credentials");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get platform settings first
    const settings = await getPlatformSettings(supabase);

    // If custom auth emails are disabled, return error to fall back to Supabase default
    if (!settings.enabled) {
      console.log("Custom auth emails disabled, falling back to Supabase default");
      return new Response(
        JSON.stringify({ error: "Custom auth emails disabled" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!settings.from_email) {
      console.error("Platform from_email not configured");
      return new Response(
        JSON.stringify({ error: "Platform email not configured" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!resendApiKey) {
      console.error("Missing RESEND_API_KEY");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Parse the request body
    const body = await req.text();
    let payload: AuthEmailPayload;

    // Verify webhook signature if secret is configured
    if (hookSecret) {
      const webhookId = req.headers.get("webhook-id");
      const webhookTimestamp = req.headers.get("webhook-timestamp");
      const webhookSignature = req.headers.get("webhook-signature");

      if (!webhookId || !webhookTimestamp || !webhookSignature) {
        console.error("Missing webhook headers");
        return new Response(
          JSON.stringify({ error: "Missing webhook headers" }),
          { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      try {
        // The secret from Supabase may have 'whsec_' prefix or be raw base64
        // standardwebhooks expects the raw base64 secret
        const secretForVerification = hookSecret.startsWith('whsec_') 
          ? hookSecret.substring(6) 
          : hookSecret;
        
        const wh = new Webhook(secretForVerification);
        payload = wh.verify(body, {
          "webhook-id": webhookId,
          "webhook-timestamp": webhookTimestamp,
          "webhook-signature": webhookSignature,
        }) as AuthEmailPayload;
      } catch (verifyError) {
        console.error("Webhook verification failed:", verifyError);
        // Log more details for debugging
        console.error("Hook secret length:", hookSecret.length);
        console.error("Hook secret starts with whsec_:", hookSecret.startsWith('whsec_'));
        return new Response(
          JSON.stringify({ error: "Invalid webhook signature" }),
          { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    } else {
      // No secret configured - just parse the body (development mode)
      console.warn("SEND_EMAIL_HOOK_SECRET not configured - running in development mode");
      payload = JSON.parse(body);
    }

    const emailType = payload.email_data.email_action_type;
    const userEmail = payload.user.email;

    console.log(`Processing ${emailType} email for ${userEmail}`);

    // Generate email content
    const subject = getEmailSubject(emailType);
    const html = generateEmailHtml(emailType, settings, payload);

    // Send via Resend
    const resend = new Resend(resendApiKey);
    const fromAddress = settings.from_name 
      ? `${settings.from_name} <${settings.from_email}>`
      : settings.from_email;

    const emailResult = await resend.emails.send({
      from: fromAddress,
      to: [userEmail],
      subject: subject,
      html: html,
    });

    console.log(`Email sent successfully:`, emailResult);

    return new Response(
      JSON.stringify({ success: true, message_id: emailResult.data?.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Error in send-auth-email:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
