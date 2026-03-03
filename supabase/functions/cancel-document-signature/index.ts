import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getResendApiKey, getCompanyEmailSender } from "../_shared/get-resend-key.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CancelDocumentRequest {
  documentId: string;
  cancellationReason: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { documentId, cancellationReason }: CancelDocumentRequest = await req.json();

    console.log("Processing document cancellation:", { documentId, cancellationReason });

    // Get document details
    const { data: document, error: docError } = await supabase
      .from("signature_documents")
      .select("*, document_signers(*)")
      .eq("id", documentId)
      .single();

    if (docError || !document) {
      console.error("Error fetching document:", docError);
      throw new Error("Document not found");
    }

    const docCompanyId = document.company_id || null;

    // Get company-specific Resend API key
    const resendApiKey = await getResendApiKey(supabase, docCompanyId);
    if (!resendApiKey) {
      console.log("RESEND_API_KEY not configured, skipping cancellation emails");
      // Still update the document status even without email
    }

    // Get company-specific settings first, then fallback to app_settings
    const settingKeys = ["company_name", "resend_from_email", "resend_from_name"];
    
    let companySettingsMap: Record<string, string> = {};
    if (docCompanyId) {
      const { data: companySettings } = await supabase
        .from("company_settings")
        .select("setting_key, setting_value")
        .eq("company_id", docCompanyId)
        .in("setting_key", settingKeys);
      
      companySettingsMap = (companySettings || []).reduce((acc, s) => {
        if (s.setting_value) acc[s.setting_key] = s.setting_value;
        return acc;
      }, {} as Record<string, string>);
    }

    // Fallback to app_settings
    const { data: appSettings } = await supabase
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", settingKeys);

    const appSettingsMap: Record<string, string> = (appSettings || []).reduce((acc, s) => {
      if (s.setting_value) acc[s.setting_key] = s.setting_value;
      return acc;
    }, {} as Record<string, string>);

    // Merge: company settings override app settings
    const settingsMap = { ...appSettingsMap, ...companySettingsMap };

    // Resolve sender from company_email_domains (supports platform domain + custom domain)
    const senderConfig = docCompanyId ? await getCompanyEmailSender(supabase, docCompanyId) : null;
    const companyName = settingsMap.company_name || "CA Pro Builders";
    const fromEmail = senderConfig?.fromEmail || settingsMap.resend_from_email || "onboarding@resend.dev";
    const fromName = senderConfig?.fromName || settingsMap.resend_from_name || companyName;
    const replyTo = senderConfig?.replyTo;

    // Get signers who have been sent the document (status !== 'pending')
    const signersToNotify = document.document_signers?.filter(
      (s: any) => s.status !== 'pending' && s.status !== 'signed'
    ) || [];

    // If no signers in document_signers, check if the document was sent
    const shouldNotifyRecipient = document.sent_at && signersToNotify.length === 0;

    const emailsToSend: { name: string; email: string }[] = [];

    if (shouldNotifyRecipient) {
      emailsToSend.push({
        name: document.recipient_name,
        email: document.recipient_email,
      });
    } else {
      signersToNotify.forEach((signer: any) => {
        emailsToSend.push({
          name: signer.signer_name,
          email: signer.signer_email,
        });
      });
    }

    console.log("Sending cancellation emails to:", emailsToSend);

    // Send cancellation emails if Resend API key is available
    if (resendApiKey) {
      for (let i = 0; i < emailsToSend.length; i++) {
        const recipient = emailsToSend[i];

        // Rate limit: 2 req/sec for Resend
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 600));
        }

        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${fromName} <${fromEmail}>`,
            to: [recipient.email],
            subject: `Document Cancelled: ${document.document_name}`,
            ...(replyTo ? { reply_to: replyTo } : {}),
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #dc2626; color: white; padding: 30px; text-align: center;">
                  <h1 style="margin: 0;">Document Request Cancelled</h1>
                </div>
                <div style="padding: 30px; background: #f9fafb;">
                  <p>Hello ${recipient.name},</p>
                  <p>The signature request for the following document has been cancelled:</p>
                  <p><strong>Document:</strong> ${document.document_name}</p>
                  ${cancellationReason ? `
                    <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0;">
                      <p style="margin: 0; font-weight: 600;">Reason for cancellation:</p>
                      <p style="margin: 10px 0 0 0;">${cancellationReason}</p>
                    </div>
                  ` : ''}
                  <p style="color: #666;">No further action is required from you. Any previous signing links for this document are no longer valid.</p>
                  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
                  <p style="color: #666; font-size: 12px;">
                    If you have any questions, please contact ${companyName}.
                  </p>
                </div>
              </div>
            `,
          }),
        });

        if (!emailResponse.ok) {
          const errorText = await emailResponse.text();
          console.error("Email failed for", recipient.email, ":", errorText);
          // Continue sending to other recipients even if one fails
        } else {
          console.log("Cancellation email sent to:", recipient.email);
        }
      }
    }

    // Update document status
    const { error: updateError } = await supabase
      .from("signature_documents")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancellation_reason: cancellationReason,
      })
      .eq("id", documentId);

    if (updateError) {
      console.error("Error updating document:", updateError);
      throw updateError;
    }

    // Deactivate all portal tokens for this document
    await supabase
      .from("document_portal_tokens")
      .update({ is_active: false })
      .eq("document_id", documentId);

    console.log("Document cancelled successfully");

    return new Response(JSON.stringify({ 
      success: true, 
      emailsSent: resendApiKey ? emailsToSend.length : 0 
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
