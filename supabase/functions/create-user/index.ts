import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify the requesting user is an admin
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

    // Check if requesting user is admin or super_admin
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

    // Get request body
    const { email, password, fullName, companyId, corporationId, role } = await req.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email and password are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create the user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: fullName || email.split("@")[0],
      },
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update profile with company_id and/or corporation_id if provided
    if (newUser.user && (companyId || corporationId)) {
      const updateData: { company_id?: string; corporation_id?: string } = {};
      if (companyId) updateData.company_id = companyId;
      if (corporationId) updateData.corporation_id = corporationId;

      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update(updateData)
        .eq("id", newUser.user.id);

      if (profileError) {
        console.error("Error updating profile:", profileError);
        // Don't fail the request, user was created
      }
    }

    // Assign role if provided (e.g., 'admin' for company admins)
    // Use raw SQL to bypass the trigger that checks auth.uid()
    if (newUser.user && role) {
      const { error: roleError } = await supabaseAdmin
        .rpc('admin_assign_role', { 
          target_user_id: newUser.user.id, 
          target_role: role 
        });

      // Fallback to direct insert if RPC doesn't exist
      if (roleError && roleError.message?.includes('function') && roleError.message?.includes('does not exist')) {
        const { error: insertError } = await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: newUser.user.id, role });

        if (insertError) {
          console.error("Error assigning role:", insertError);
        }
      } else if (roleError) {
        console.error("Error assigning role:", roleError);
      }
    }

    return new Response(JSON.stringify({ user: newUser.user }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error creating user:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});