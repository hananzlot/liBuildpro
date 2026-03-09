import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    // Accept bucket and path as query params
    const bucket = url.searchParams.get("bucket");
    const path = url.searchParams.get("path");
    // Or accept a full Supabase storage URL to parse
    const fileUrl = url.searchParams.get("url");

    let targetBucket: string;
    let targetPath: string;

    if (bucket && path) {
      targetBucket = bucket;
      targetPath = path;
    } else if (fileUrl) {
      // Parse a full Supabase public storage URL
      // Format: https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
      const match = fileUrl.match(
        /\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/
      );
      if (!match) {
        return new Response(
          JSON.stringify({ error: "Invalid storage URL format" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      targetBucket = match[1];
      targetPath = decodeURIComponent(match[2]);
    } else {
      return new Response(
        JSON.stringify({ error: "Missing bucket/path or url parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Only allow known public buckets
    const allowedBuckets = [
      "project-attachments",
      "contracts",
      "signature-documents",
      "compliance-templates",
    ];
    if (!allowedBuckets.includes(targetBucket)) {
      return new Response(
        JSON.stringify({ error: "Bucket not allowed" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data, error } = await supabase.storage
      .from(targetBucket)
      .download(targetPath);

    if (error || !data) {
      console.error("Storage download error:", error);
      return new Response(
        JSON.stringify({ error: "File not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine content type from file extension
    const ext = targetPath.split(".").pop()?.toLowerCase();
    const contentTypes: Record<string, string> = {
      pdf: "application/pdf",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
    };
    const contentType = contentTypes[ext || ""] || "application/octet-stream";

    // Extract filename from path
    const fileName = targetPath.split("/").pop() || "document";

    return new Response(data, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("Proxy error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
