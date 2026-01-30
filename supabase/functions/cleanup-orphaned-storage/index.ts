import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { dryRun = true, bucket } = await req.json().catch(() => ({ dryRun: true }));

    const results: {
      bucket: string;
      orphanedFiles: string[];
      deletedFiles: string[];
      errors: string[];
    }[] = [];

    // Define buckets and their reference tables
    const bucketConfigs = [
      {
        bucket: "contracts",
        tables: [
          { table: "project_agreements", column: "attachment_url" },
          { table: "signed_compliance_documents", column: "signed_document_url" },
          { table: "estimate_compliance_documents", column: "generated_document_url" },
        ],
      },
      {
        bucket: "project-attachments",
        tables: [
          { table: "project_documents", column: "file_url" },
          { table: "project_bills", column: "attachment_url" },
          { table: "project_photos", column: "file_url" },
        ],
      },
      {
        bucket: "signature-documents",
        tables: [
          { table: "signature_documents", column: "document_url" },
          { table: "signature_documents", column: "signed_document_url" },
        ],
      },
    ];

    // Filter to specific bucket if requested
    const configsToProcess = bucket 
      ? bucketConfigs.filter(c => c.bucket === bucket)
      : bucketConfigs;

    for (const config of configsToProcess) {
      const bucketResult = {
        bucket: config.bucket,
        orphanedFiles: [] as string[],
        deletedFiles: [] as string[],
        errors: [] as string[],
      };

      // List all files in bucket
      const { data: files, error: listError } = await supabase.storage
        .from(config.bucket)
        .list("", { limit: 1000, sortBy: { column: "created_at", order: "desc" } });

      if (listError) {
        bucketResult.errors.push(`Failed to list ${config.bucket}: ${listError.message}`);
        results.push(bucketResult);
        continue;
      }

      // Recursively get all files (including in folders)
      const allFiles: string[] = [];
      
      async function listRecursive(prefix: string) {
        const { data, error } = await supabase.storage
          .from(config.bucket)
          .list(prefix, { limit: 1000 });
        
        if (error) {
          bucketResult.errors.push(`Failed to list ${prefix}: ${error.message}`);
          return;
        }

        for (const item of data || []) {
          const path = prefix ? `${prefix}/${item.name}` : item.name;
          if (item.id) {
            // It's a file
            allFiles.push(path);
          } else {
            // It's a folder, recurse
            await listRecursive(path);
          }
        }
      }

      // Get top-level items first
      for (const item of files || []) {
        if (item.id) {
          allFiles.push(item.name);
        } else {
          await listRecursive(item.name);
        }
      }

      console.log(`Found ${allFiles.length} files in ${config.bucket}`);

      // Collect all referenced URLs from all tables
      const referencedPaths = new Set<string>();
      
      for (const tableConfig of config.tables) {
        const { data: rows, error: queryError } = await supabase
          .from(tableConfig.table)
          .select(tableConfig.column)
          .not(tableConfig.column, "is", null);

        if (queryError) {
          bucketResult.errors.push(`Failed to query ${tableConfig.table}: ${queryError.message}`);
          continue;
        }

        for (const row of rows || []) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const url = (row as any)[tableConfig.column] as string | null;
          if (url) {
            // Extract path from URL
            const bucketPath = `/${config.bucket}/`;
            const pathIndex = url.indexOf(bucketPath);
            if (pathIndex !== -1) {
              const path = url.substring(pathIndex + bucketPath.length);
              referencedPaths.add(path);
            }
          }
        }
      }

      console.log(`Found ${referencedPaths.size} referenced paths in DB for ${config.bucket}`);

      // Find orphaned files
      for (const filePath of allFiles) {
        if (!referencedPaths.has(filePath)) {
          bucketResult.orphanedFiles.push(filePath);
        }
      }

      console.log(`Found ${bucketResult.orphanedFiles.length} orphaned files in ${config.bucket}`);

      // Delete orphaned files if not dry run
      if (!dryRun && bucketResult.orphanedFiles.length > 0) {
        const { error: deleteError } = await supabase.storage
          .from(config.bucket)
          .remove(bucketResult.orphanedFiles);

        if (deleteError) {
          bucketResult.errors.push(`Failed to delete files: ${deleteError.message}`);
        } else {
          bucketResult.deletedFiles = [...bucketResult.orphanedFiles];
        }
      }

      results.push(bucketResult);
    }

    const summary = {
      dryRun,
      totalOrphaned: results.reduce((sum, r) => sum + r.orphanedFiles.length, 0),
      totalDeleted: results.reduce((sum, r) => sum + r.deletedFiles.length, 0),
      results,
    };

    return new Response(JSON.stringify(summary, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: errMsg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
