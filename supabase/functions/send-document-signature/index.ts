import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DocumentSignatureRecipient {
  recipientName: string;
  recipientEmail: string;
  signerId?: string | null;
}

interface DocumentSignatureRequest {
  documentId: string;
  documentName: string;
  isReminder?: boolean;

  // Single-recipient mode (backwards compatible)
  recipientName?: string;
  recipientEmail?: string;
  signerId?: string | null;

  // Batch mode
  recipients?: DocumentSignatureRecipient[];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      throw new Error("Missing RESEND_API_KEY");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: DocumentSignatureRequest = await req.json();

    const {
      documentId,
      documentName,
      isReminder,
      recipientName,
      recipientEmail,
      signerId,
    } = body;

    if (!documentId || !documentName) {
      return new Response(JSON.stringify({ success: false, error: "Missing documentId or documentName" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const recipients: DocumentSignatureRecipient[] =
      Array.isArray(body.recipients) && body.recipients.length > 0
        ? body.recipients
        : [{ recipientName: recipientName || "", recipientEmail: recipientEmail || "", signerId }];

    const invalid = recipients.find((r) => !r.recipientName || !r.recipientEmail);
    if (invalid) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Each recipient must include recipientName and recipientEmail",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    console.log("Processing document signature request:", {
      documentId,
      documentName,
      recipients: recipients.map((r) => ({
        recipientName: r.recipientName,
        recipientEmail: r.recipientEmail,
        signerId: r.signerId,
      })),
      isReminder,
    });

    // Get document to find company_id
    const { data: documentData } = await supabase
      .from("signature_documents")
      .select("company_id")
      .eq("id", documentId)
      .single();
    
    const docCompanyId = documentData?.company_id || null;

    // Get company settings
    const { data: settings } = await supabase
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["company_name", "resend_from_email", "resend_from_name", "app_base_url"]);

    const companyName =
      settings?.find((s) => s.setting_key === "company_name")?.setting_value ||
      "CA Pro Builders";
    const fromEmail =
      settings?.find((s) => s.setting_key === "resend_from_email")?.setting_value ||
      "onboarding@resend.dev";
    const fromName =
      settings?.find((s) => s.setting_key === "resend_from_name")?.setting_value ||
      companyName;
    const appBaseUrl =
      settings?.find((s) => s.setting_key === "app_base_url")?.setting_value ||
      "https://crm.ca-probuilders.com";

    const emailSubject = isReminder
      ? `Reminder: Document Signature Required - ${documentName}`
      : `Document Signature Required: ${documentName}`;

    const emailIntro = isReminder
      ? `<p>This is a friendly reminder that ${companyName} has sent you a document that still requires your signature.</p>`
      : `<p>${companyName} has sent you a document that requires your signature.</p>`;

    // Create a portal token per recipient (preserves existing behavior)
    const tokenResults: Array<{
      recipientEmail: string;
      recipientName: string;
      signerId?: string | null;
      token: string;
      portalUrl: string;
    }> = [];

    const emailsToSend: Array<{
      from: string;
      to: string[];
      subject: string;
      html: string;
    }> = [];

    for (const r of recipients) {
      const { data: tokenData, error: tokenError } = await supabase
        .from("document_portal_tokens")
        .insert({
          document_id: documentId,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          company_id: docCompanyId,
        })
        .select()
        .single();

      if (tokenError) {
        console.error("Error creating token:", tokenError);
        throw tokenError;
      }

      // Build portal URL with signer info if provided
      let portalUrl =
        `${appBaseUrl}/document-portal?token=${tokenData.token}`;
      if (r.signerId) {
        portalUrl += `&signer=${r.signerId}`;
      }

      tokenResults.push({
        recipientEmail: r.recipientEmail,
        recipientName: r.recipientName,
        signerId: r.signerId,
        token: tokenData.token,
        portalUrl,
      });

      emailsToSend.push({
        from: `${fromName} <${fromEmail}>`,
        to: [r.recipientEmail],
        subject: emailSubject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #1a1a2e; color: white; padding: 30px; text-align: center;">
              <h1 style="margin: 0;">${isReminder ? "Reminder: " : ""}Document Signature Required</h1>
            </div>
            <div style="padding: 30px; background: #f9fafb;">
              <p>Hello ${r.recipientName},</p>
              ${emailIntro}
              <p><strong>Document:</strong> ${documentName}</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${portalUrl}" style="background: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">Review & Sign Document</a>
              </div>
              <p style="color: #666; font-size: 14px;">This link expires in 30 days.</p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
              <p style="color: #666; font-size: 12px;">
                By signing this document, your signature, name, email, date, and IP address will be recorded for verification purposes.
              </p>
            </div>
          </div>
        `,
      });
    }

    const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

    const sendWithRetry = async (url: string, payload: unknown, maxRetries = 6) => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const text = await res.text();
          try {
            return text ? JSON.parse(text) : {};
          } catch {
            return { raw: text };
          }
        }

        const errorText = await res.text();
        const isRateLimited = res.status === 429 || errorText.includes("rate_limit_exceeded");

        if (isRateLimited && attempt < maxRetries) {
          const retryAfter = res.headers.get("retry-after");
          const retryAfterMs =
            retryAfter && !Number.isNaN(Number(retryAfter))
              ? Math.max(0, Number(retryAfter) * 1000)
              : 0;

          // 0.5s, 1s, 2s, 4s, 8s, 15s (capped) + jitter
          const expBackoffMs = Math.min(15000, 500 * Math.pow(2, attempt - 1));
          const jitterMs = Math.floor(Math.random() * 500);
          const waitTime = Math.max(retryAfterMs, expBackoffMs) + jitterMs;

          console.log(
            `Rate limited from Resend (attempt ${attempt}/${maxRetries}), waiting ${waitTime}ms before retry...`,
          );
          await sleep(waitTime);
          continue;
        }

        console.error("Email failed:", errorText);

        if (isRateLimited) {
          throw new Error(`RATE_LIMIT_EXCEEDED: ${errorText}`);
        }

        throw new Error(`Email failed: ${errorText}`);
      }
    };

    // Use Resend batch endpoint when sending multiple signers (reduces rate limit pressure)
    const useBatch = emailsToSend.length > 1;
    const resendUrl = useBatch
      ? "https://api.resend.com/emails/batch"
      : "https://api.resend.com/emails";

    // For single email, Resend expects `to` as a string, not array
    const resendPayload = useBatch
      ? emailsToSend
      : { ...emailsToSend[0], to: emailsToSend[0].to[0] };

    const resendResult = await sendWithRetry(resendUrl, resendPayload);

    // Update document status (even for reminders, preserve existing behavior)
    await supabase
      .from("signature_documents")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", documentId);

    // Update signer statuses (if signer ids were provided)
    const signerIds = Array.from(
      new Set(
        recipients
          .map((r) => r.signerId)
          .filter((id): id is string => typeof id === "string" && id.length > 0),
      ),
    );

    if (signerIds.length > 0) {
      await supabase
        .from("document_signers")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .in("id", signerIds);

      console.log("Updated signer status for:", signerIds);
    }

    return new Response(
      JSON.stringify({
        success: true,
        tokens: tokenResults,
        resend: resendResult,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (error: any) {
    console.error("Error:", error);

    const msg = typeof error?.message === "string" ? error.message : String(error);
    const isRateLimited = msg.includes("RATE_LIMIT_EXCEEDED") || msg.includes("rate_limit_exceeded");

    // Important: return 200 for rate-limit failures so the frontend can show a friendly message
    // without Supabase throwing a FunctionsHttpError.
    if (isRateLimited) {
      return new Response(
        JSON.stringify({
          success: false,
          error: msg.replace(/^RATE_LIMIT_EXCEEDED:\s*/, ""),
          rate_limited: true,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
