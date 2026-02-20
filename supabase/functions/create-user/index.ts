import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logEdgeFunctionRun } from "../_shared/edge-function-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let requestSummary: Record<string, unknown> = {};
  let requestingUserId: string | null = null;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !requestingUser) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    requestingUserId = requestingUser.id;

    const { data: adminRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", requestingUser.id)
      .in("role", ["admin", "super_admin"]);

    if (!adminRoles || adminRoles.length === 0) {
      return new Response(JSON.stringify({ error: "Unauthorized - admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isSuperAdmin = adminRoles.some(r => r.role === "super_admin");

    const { email, password, fullName, companyId, corporationId, role } = await req.json();
    requestSummary = { email, fullName, companyId, role };

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email and password are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let targetCompanyId = companyId;
    if (!isSuperAdmin) {
      const { data: requestingProfile } = await supabaseAdmin
        .from("profiles")
        .select("company_id")
        .eq("id", requestingUser.id)
        .single();

      if (companyId && companyId !== requestingProfile?.company_id) {
        console.log(`Access denied: User ${requestingUser.id} (company: ${requestingProfile?.company_id}) tried to create user in company ${companyId}`);
        return new Response(JSON.stringify({ error: "Cannot create users in other companies" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      targetCompanyId = requestingProfile?.company_id;

      if (role === "super_admin") {
        return new Response(JSON.stringify({ error: "Cannot assign super_admin role" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName || email.split("@")[0],
      },
    });

    let userId: string | undefined;

    if (createError) {
      if (createError.message?.includes("already been registered")) {
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(
          (u) => u.email?.toLowerCase() === email.toLowerCase()
        );
        if (existingUser) {
          userId = existingUser.id;
          console.log(`User ${email} already exists (${userId}), proceeding with role/company assignment`);
        } else {
          return new Response(JSON.stringify({ error: "User exists but could not be found" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      userId = newUser.user?.id;
    }

    if (userId && (targetCompanyId || corporationId)) {
      const updateData: { company_id?: string; corporation_id?: string } = {};
      if (targetCompanyId) updateData.company_id = targetCompanyId;
      if (corporationId) updateData.corporation_id = corporationId;

      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update(updateData)
        .eq("id", userId);

      if (profileError) {
        console.error("Error updating profile:", profileError);
      }
    }

    if (userId && role) {
      const supabaseWithUserAuth = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: authHeader } },
      });

      const { error: roleError } = await supabaseWithUserAuth
        .rpc('admin_assign_role', { 
          target_user_id: userId, 
          target_role: role 
        });

      if (roleError) {
        console.error("Error assigning role:", roleError);
      }
    }

    // Log success
    logEdgeFunctionRun({
      functionName: 'create-user',
      companyId: targetCompanyId,
      userId: requestingUserId,
      requestSummary,
      responseSummary: { createdUserId: userId, email },
      status: 'success',
      durationMs: Date.now() - startTime,
    });

    return new Response(JSON.stringify({ user: { id: userId, email } }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error creating user:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    logEdgeFunctionRun({
      functionName: 'create-user',
      userId: requestingUserId,
      requestSummary,
      status: 'error',
      durationMs: Date.now() - startTime,
      errorMessage,
      errorDetails: error instanceof Error ? error.stack : undefined,
    });

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
