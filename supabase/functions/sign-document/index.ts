import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-forwarded-for, x-real-ip',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      documentId,
      signerId,
      signerName,
      signerEmail,
      signatureType,
      signatureData,
      signatureFont,
      userAgent,
      fieldValues,
    } = await req.json();

    if (!documentId || !signerName || !signatureData) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get the client IP address from headers
    const forwardedFor = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    const cfConnectingIp = req.headers.get('cf-connecting-ip');
    
    // Try to get the most accurate IP
    let ipAddress = cfConnectingIp || realIp || (forwardedFor ? forwardedFor.split(',')[0].trim() : null);
    
    // If no IP from headers, try to get from connection (Deno)
    if (!ipAddress) {
      try {
        const connInfo = (req as any).connInfo;
        if (connInfo?.remoteAddr?.hostname) {
          ipAddress = connInfo.remoteAddr.hostname;
        }
      } catch {
        // Ignore errors
      }
    }

    console.log('Signing document with IP:', ipAddress);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const signedAt = new Date().toISOString();

    // Insert signature with IP address
    const { data: signature, error: sigError } = await supabase
      .from('document_signatures')
      .insert({
        document_id: documentId,
        signer_id: signerId || null,
        signer_name: signerName,
        signer_email: signerEmail || null,
        signature_type: signatureType,
        signature_data: signatureData,
        signature_font: signatureFont || null,
        ip_address: ipAddress,
        user_agent: userAgent || null,
        signed_at: signedAt,
        field_values: fieldValues || {},
      })
      .select()
      .single();

    if (sigError) {
      console.error('Error inserting signature:', sigError);
      throw sigError;
    }

    console.log('Signature inserted with ID:', signature.id);

    // Update signer status if we have a signer
    if (signerId) {
      const { error: signerError } = await supabase
        .from('document_signers')
        .update({
          status: 'signed',
          signed_at: signedAt,
          signature_id: signature.id,
        })
        .eq('id', signerId);

      if (signerError) {
        console.error('Error updating signer:', signerError);
      }
    }

    // Check if all signers have signed
    const { data: allSigners } = await supabase
      .from('document_signers')
      .select('status')
      .eq('document_id', documentId);

    const allSigned = allSigners && allSigners.length > 0 
      ? allSigners.every(s => s.status === 'signed')
      : true;

    // Update document status
    const { error: docError } = await supabase
      .from('signature_documents')
      .update({
        status: allSigned ? 'signed' : 'viewed',
        signed_at: allSigned ? signedAt : null,
      })
      .eq('id', documentId);

    if (docError) {
      console.error('Error updating document:', docError);
    }

    // Get document info for notification
    const { data: document } = await supabase
      .from('signature_documents')
      .select('document_name')
      .eq('id', documentId)
      .single();

    // Send notification
    try {
      await supabase.functions.invoke('send-proposal-notification', {
        body: {
          action: 'document_signed',
          documentName: document?.document_name || 'Document',
          recipientName: signerName,
          recipientEmail: signerEmail,
          signedAt: signedAt,
        },
      });
    } catch (notifError) {
      console.error('Error sending notification:', notifError);
      // Don't fail the signing if notification fails
    }

    return new Response(JSON.stringify({ 
      success: true,
      signatureId: signature.id,
      signedAt,
      ipAddress,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error signing document:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
