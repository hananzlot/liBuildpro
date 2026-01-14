import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DocumentSignatureRequest {
  documentId: string;
  documentName: string;
  recipientName: string;
  recipientEmail: string;
  signerId?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const { documentId, documentName, recipientName, recipientEmail, signerId }: DocumentSignatureRequest = await req.json();

    console.log("Processing document signature request:", { documentId, documentName, recipientName, recipientEmail, signerId });

    // Create portal token
    const { data: tokenData, error: tokenError } = await supabase
      .from("document_portal_tokens")
      .insert({
        document_id: documentId,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (tokenError) {
      console.error("Error creating token:", tokenError);
      throw tokenError;
    }

    console.log("Created portal token:", tokenData.token);

    // Get company settings
    const { data: settings } = await supabase
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["company_name", "resend_from_email", "resend_from_name"]);

    const companyName = settings?.find((s) => s.setting_key === "company_name")?.setting_value || "CA Pro Builders";
    const fromEmail = settings?.find((s) => s.setting_key === "resend_from_email")?.setting_value || "onboarding@resend.dev";
    const fromName = settings?.find((s) => s.setting_key === "resend_from_name")?.setting_value || companyName;

    // Build portal URL with signer info if provided
    let portalUrl = `https://crm-caprobuilders.lovable.app/document-portal?token=${tokenData.token}`;
    if (signerId) {
      portalUrl += `&signer=${signerId}`;
    }

    console.log("Portal URL:", portalUrl);

    // Send email via Resend API
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [recipientEmail],
        subject: `Document Signature Required: ${documentName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #1a1a2e; color: white; padding: 30px; text-align: center;">
              <h1 style="margin: 0;">Document Signature Required</h1>
            </div>
            <div style="padding: 30px; background: #f9fafb;">
              <p>Hello ${recipientName},</p>
              <p>${companyName} has sent you a document that requires your signature.</p>
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
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("Email failed:", errorText);
      throw new Error(`Email failed: ${errorText}`);
    }

    console.log("Email sent successfully");

    // Update document status
    await supabase
      .from("signature_documents")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", documentId);

    // Update signer status if signerId provided
    if (signerId) {
      await supabase
        .from("document_signers")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", signerId);
      
      console.log("Updated signer status:", signerId);
    }

    return new Response(JSON.stringify({ success: true, token: tokenData.token }), {
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
