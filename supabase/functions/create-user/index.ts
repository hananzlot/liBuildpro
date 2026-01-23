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

    const isSuperAdmin = adminRoles.some(r => r.role === "super_admin");

    // Get request body
    const { email, password, fullName, companyId, corporationId, role } = await req.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email and password are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Company access validation for non-super-admins
    let targetCompanyId = companyId;
    if (!isSuperAdmin) {
      // Get requesting user's company
      const { data: requestingProfile } = await supabaseAdmin
        .from("profiles")
        .select("company_id")
        .eq("id", requestingUser.id)
        .single();

      // Non-super-admins can only create users in their own company
      if (companyId && companyId !== requestingProfile?.company_id) {
        console.log(`Access denied: User ${requestingUser.id} (company: ${requestingProfile?.company_id}) tried to create user in company ${companyId}`);
        return new Response(JSON.stringify({ error: "Cannot create users in other companies" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Force the new user to be in the admin's company
      targetCompanyId = requestingProfile?.company_id;

      // Non-super-admins cannot assign super_admin role
      if (role === "super_admin") {
        return new Response(JSON.stringify({ error: "Cannot assign super_admin role" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
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
    if (newUser.user && (targetCompanyId || corporationId)) {
      const updateData: { company_id?: string; corporation_id?: string } = {};
      if (targetCompanyId) updateData.company_id = targetCompanyId;
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
    // Create a client with the requesting user's JWT to call the RPC
    // This allows the RPC to check auth.uid() and verify the caller is a super_admin
    if (newUser.user && role) {
      const supabaseWithUserAuth = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      });

      const { error: roleError } = await supabaseWithUserAuth
        .rpc('admin_assign_role', { 
          target_user_id: newUser.user.id, 
          target_role: role 
        });

      if (roleError) {
        console.error("Error assigning role:", roleError);
        // Don't fail the request, user was created successfully
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