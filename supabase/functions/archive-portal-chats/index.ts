import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Parse request body to check for archiveAll flag
    let archiveAll = false;
    try {
      const body = await req.json();
      archiveAll = body?.archiveAll === true;
    } catch {
      // No body or invalid JSON, use default behavior
    }

    console.log(`Starting chat archival process... archiveAll: ${archiveAll}`);

    // Build query - either all messages or just older than 24 hours
    let query = supabase.from("portal_chat_messages").select("*");
    
    if (!archiveAll) {
      const oneDayAgo = new Date();
      oneDayAgo.setHours(oneDayAgo.getHours() - 24);
      const cutoffDate = oneDayAgo.toISOString();
      query = query.lt("created_at", cutoffDate);
    }

    // Fetch messages to archive
    const { data: messagesToArchive, error: fetchError } = await query;

    if (fetchError) {
      console.error("Error fetching messages to archive:", fetchError);
      return new Response(
        JSON.stringify({ success: false, error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!messagesToArchive || messagesToArchive.length === 0) {
      console.log("No messages to archive");
      return new Response(
        JSON.stringify({ success: true, archived: 0, message: archiveAll ? "No messages to archive" : "No messages older than 24 hours to archive" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${messagesToArchive.length} messages to archive`);

    // Prepare archived records
    const archivedRecords = messagesToArchive.map((msg) => ({
      original_id: msg.id,
      project_id: msg.project_id,
      sender_type: msg.sender_type,
      sender_name: msg.sender_name,
      sender_email: msg.sender_email,
      sender_user_id: msg.sender_user_id,
      message: msg.message,
      is_read: msg.is_read,
      portal_token_id: msg.portal_token_id,
      original_created_at: msg.created_at,
      original_updated_at: msg.updated_at,
    }));

    // Insert into archive table
    const { error: archiveError } = await supabase
      .from("portal_chat_messages_archived")
      .insert(archivedRecords);

    if (archiveError) {
      console.error("Error archiving messages:", archiveError);
      return new Response(
        JSON.stringify({ success: false, error: archiveError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delete archived messages from main table
    const messageIds = messagesToArchive.map((msg) => msg.id);
    const { error: deleteError } = await supabase
      .from("portal_chat_messages")
      .delete()
      .in("id", messageIds);

    if (deleteError) {
      console.error("Error deleting archived messages:", deleteError);
      return new Response(
        JSON.stringify({ success: false, error: deleteError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Successfully archived ${messagesToArchive.length} messages`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        archived: messagesToArchive.length,
        message: `Archived ${messagesToArchive.length} chat messages`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in archive-portal-chats:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
