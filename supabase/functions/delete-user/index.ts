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

    const { userId } = await req.json();
    requestSummary = { targetUserId: userId };

    if (!userId) {
      return new Response(JSON.stringify({ error: "User ID is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (userId === requestingUser.id) {
      return new Response(JSON.stringify({ error: "Cannot delete your own account" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let targetCompanyId: string | null = null;

    if (!isSuperAdmin) {
      const { data: requestingProfile } = await supabaseAdmin
        .from("profiles")
        .select("company_id")
        .eq("id", requestingUser.id)
        .single();

      const { data: targetProfile } = await supabaseAdmin
        .from("profiles")
        .select("company_id")
        .eq("id", userId)
        .single();

      if (!targetProfile) {
        return new Response(JSON.stringify({ error: "Target user not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      targetCompanyId = targetProfile.company_id;

      const { data: targetRoles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "super_admin");

      if (targetRoles && targetRoles.length > 0) {
        return new Response(JSON.stringify({ error: "Cannot delete super admin users" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (requestingProfile?.company_id !== targetProfile.company_id) {
        console.log(`Access denied: User ${requestingUser.id} (company: ${requestingProfile?.company_id}) tried to delete user ${userId} (company: ${targetProfile.company_id})`);
        return new Response(JSON.stringify({ error: "Cannot delete users from other companies" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Nullify audit_logs references to avoid FK constraint violation
    await supabaseAdmin
      .from("audit_logs")
      .update({ user_id: null })
      .eq("user_id", userId);

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
      logEdgeFunctionRun({
        functionName: 'delete-user',
        companyId: targetCompanyId,
        userId: requestingUserId,
        requestSummary,
        status: 'error',
        durationMs: Date.now() - startTime,
        errorMessage: deleteError.message,
      });

      return new Response(JSON.stringify({ error: deleteError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logEdgeFunctionRun({
      functionName: 'delete-user',
      companyId: targetCompanyId,
      userId: requestingUserId,
      requestSummary,
      responseSummary: { deletedUserId: userId },
      status: 'success',
      durationMs: Date.now() - startTime,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    logEdgeFunctionRun({
      functionName: 'delete-user',
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
