import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface InviteRequest {
  email: string;
  fullName: string;
  companyId: string;
  companyName: string;
}

function generateTempPassword(length = 12): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
  let password = "";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    password += chars[array[i] % chars.length];
  }
  return password;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify caller is a super admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !caller) {
      throw new Error("Unauthorized");
    }

    // Check if caller is super admin
    const { data: callerRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "super_admin")
      .single();

    if (!callerRoles) {
      throw new Error("Only super admins can send company invites");
    }

    const { email, fullName, companyId, companyName }: InviteRequest = await req.json();

    if (!email || !fullName || !companyId || !companyName) {
      throw new Error("Missing required fields");
    }

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    let userId: string;
    let tempPassword: string | null = null;
    let isExistingUser = false;

    if (existingUser) {
      // User exists - reassign to new company
      isExistingUser = true;
      userId = existingUser.id;

      // Update profile with new company_id
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({ 
          company_id: companyId,
          full_name: fullName || existingUser.user_metadata?.full_name
        })
        .eq("id", userId);

      if (profileError) {
        console.error("Profile update error:", profileError);
        throw new Error("Failed to update user profile");
      }

      // Ensure admin role exists
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });

      if (roleError) {
        console.error("Role assignment error:", roleError);
      }
    } else {
      // Create new user
      tempPassword = generateTempPassword();

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          requires_password_change: true,
          is_new_company_admin: true,
        },
      });

      if (createError || !newUser.user) {
        console.error("Create user error:", createError);
        throw new Error(createError?.message || "Failed to create user");
      }

      userId = newUser.user.id;

      // Update profile with company_id
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({ 
          company_id: companyId,
          full_name: fullName 
        })
        .eq("id", userId);

      if (profileError) {
        console.error("Profile update error:", profileError);
      }

      // Assign admin role
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, role: "admin" });

      if (roleError) {
        console.error("Role assignment error:", roleError);
      }
    }

    // Get Resend API key (platform default)
    const resendKey = Deno.env.get("RESEND_API_KEY");
    
    if (resendKey) {
      const resend = new Resend(resendKey);

      // Get app URL from settings or use default
      const { data: appUrlSetting } = await supabaseAdmin
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "app_url")
        .single();

      const appUrl = appUrlSetting?.setting_value || "https://leadlover-insights.lovable.app";

      const { error: emailError } = await resend.emails.send({
        from: "LeadLover <noreply@resend.dev>",
        to: [email],
        subject: `Welcome to ${companyName} - Your Admin Account`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to ${companyName}!</h1>
            </div>
            
            <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
              <p style="font-size: 16px; margin-bottom: 20px;">Hi ${fullName},</p>
              
              <p style="font-size: 16px; margin-bottom: 20px;">
                You've been invited to join <strong>${companyName}</strong> as an administrator. 
                Your account has been created and you're ready to get started!
              </p>
              
              <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <p style="margin: 0 0 10px 0; font-weight: 600; color: #374151;">Your Login Credentials:</p>
                <p style="margin: 5px 0; font-size: 14px;"><strong>Email:</strong> ${email}</p>
                <p style="margin: 5px 0; font-size: 14px;"><strong>Temporary Password:</strong> <code style="background: #e5e7eb; padding: 2px 8px; border-radius: 4px; font-family: monospace;">${tempPassword}</code></p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${appUrl}/auth" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Login to Your Account
                </a>
              </div>
              
              <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 25px 0; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; font-size: 14px; color: #92400e;">
                  <strong>Important:</strong> For security, please change your password after your first login.
                </p>
              </div>
              
              <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
                After logging in, you'll be guided through setting up your company's account with our onboarding wizard.
              </p>
              
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
              
              <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
                This is an automated message. If you didn't expect this invitation, please ignore this email.
              </p>
            </div>
          </body>
          </html>
        `,
      });

      if (emailError) {
        console.error("Email send error:", emailError);
        // Don't fail the whole operation if email fails
      }
    } else {
      console.log("No RESEND_API_KEY configured, skipping email send");
    }

    return new Response(
      JSON.stringify({
        success: true,
        userId,
        tempPassword,
        isExistingUser,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-company-invite:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
