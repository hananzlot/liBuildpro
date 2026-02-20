import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface LogEntry {
  functionName: string;
  companyId?: string | null;
  userId?: string | null;
  requestSummary?: Record<string, unknown>;
  responseSummary?: Record<string, unknown>;
  errorMessage?: string;
  errorDetails?: string;
  status: "success" | "error" | "timeout";
  durationMs: number;
}

export async function logEdgeFunctionRun(entry: LogEntry): Promise<void> {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await supabase.from("edge_function_logs").insert({
      function_name: entry.functionName,
      company_id: entry.companyId || null,
      user_id: entry.userId || null,
      status: entry.status,
      duration_ms: entry.durationMs,
      request_summary: entry.requestSummary || null,
      response_summary: entry.responseSummary || null,
      error_message: entry.errorMessage || null,
      error_details: entry.errorDetails || null,
    });
  } catch (e) {
    // Never let logging failures break the function
    console.error("Failed to write edge function log:", e);
  }
}

/**
 * Wraps an edge function handler with automatic logging.
 * Usage:
 *   serve(withLogging("my-function", async (req) => { ... return Response }));
 */
export function withLogging(
  functionName: string,
  handler: (req: Request) => Promise<Response>,
  options?: {
    extractContext?: (req: Request, body: unknown) => {
      companyId?: string;
      userId?: string;
      requestSummary?: Record<string, unknown>;
    };
  }
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    // Skip logging for CORS preflight
    if (req.method === "OPTIONS") {
      return handler(req);
    }

    const startTime = Date.now();
    let companyId: string | undefined;
    let userId: string | undefined;
    let requestSummary: Record<string, unknown> | undefined;

    try {
      const response = await handler(req);
      const durationMs = Date.now() - startTime;

      // Try to extract context from response clone
      const isError = response.status >= 400;

      // Fire-and-forget log
      logEdgeFunctionRun({
        functionName,
        companyId,
        userId,
        requestSummary,
        status: isError ? "error" : "success",
        durationMs,
        responseSummary: { statusCode: response.status },
        errorMessage: isError ? `HTTP ${response.status}` : undefined,
      });

      return response;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logEdgeFunctionRun({
        functionName,
        companyId,
        userId,
        requestSummary,
        status: "error",
        durationMs,
        errorMessage,
        errorDetails: error instanceof Error ? error.stack : undefined,
      });

      throw error;
    }
  };
}
