import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentId, includeAuditTrail = true } = await req.json();

    if (!documentId) {
      return new Response(JSON.stringify({ error: 'Document ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch document
    const { data: document, error: docError } = await supabase
      .from('signature_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      console.error('Document fetch error:', docError);
      return new Response(JSON.stringify({ error: 'Document not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch signature fields
    const { data: fields } = await supabase
      .from('document_signature_fields')
      .select('*')
      .eq('document_id', documentId);

    // Fetch signatures
    const { data: signatures } = await supabase
      .from('document_signatures')
      .select('*')
      .eq('document_id', documentId);

    // Fetch signers
    const { data: signers } = await supabase
      .from('document_signers')
      .select('*')
      .eq('document_id', documentId)
      .order('signer_order');

    console.log(`Generating PDF for document: ${document.document_name}`);
    console.log(`Fields: ${fields?.length || 0}, Signatures: ${signatures?.length || 0}`);

    // Fetch the original PDF
    const pdfResponse = await fetch(document.document_url);
    if (!pdfResponse.ok) {
      throw new Error(`Failed to fetch PDF: ${pdfResponse.statusText}`);
    }
    const pdfBytes = await pdfResponse.arrayBuffer();

    // Load the PDF
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Create a signature map for easy lookup by signer_id
    const signatureMap = new Map();
    signatures?.forEach(sig => {
      if (sig.signer_id) {
        signatureMap.set(sig.signer_id, sig);
      }
    });

    console.log('Signature map created with', signatureMap.size, 'entries');
    console.log('Total signatures:', signatures?.length || 0);
    console.log('Processing', fields?.length || 0, 'fields');

    // Overlay signatures and field values on each page
    for (const field of (fields || [])) {
      const pageIndex = field.page_number - 1;
      if (pageIndex < 0 || pageIndex >= pages.length) {
        console.log('Skipping field - invalid page:', field.page_number);
        continue;
      }

      const page = pages[pageIndex];
      const { width: pageWidth, height: pageHeight } = page.getSize();

      // Field coordinates are stored in PDF.js viewport coordinates at scale 1 (top-left origin).
      // pdf-lib uses bottom-left origin, so we convert Y.
      // We also support legacy ratio-based coordinates (0-1) just in case.
      const useRatio =
        field.x_position <= 1 &&
        field.y_position <= 1 &&
        field.width <= 1 &&
        field.height <= 1;

      const x = useRatio ? field.x_position * pageWidth : field.x_position;
      const fieldWidth = useRatio ? field.width * pageWidth : field.width;
      const fieldHeight = useRatio ? field.height * pageHeight : field.height;
      const yFromTop = useRatio ? field.y_position * pageHeight : field.y_position;
      const y = pageHeight - yFromTop - fieldHeight;

      // Find the signature for this field - try by signer_id first, then fallback to first signature
      let signature = null;
      if (field.signer_id) {
        signature = signatureMap.get(field.signer_id);
      }
      // If no signature found by signer_id, use the first available signature
      if (!signature && signatures && signatures.length > 0) {
        signature = signatures[0];
      }
      
      if (!signature) {
        console.log('No signature found for field:', field.id, 'type:', field.field_type);
        continue;
      }
      
      console.log('Processing field:', field.field_type, 'at page', field.page_number, 'with signature from', signature.signer_name);

      const fieldValues = signature.field_values || {};

      if (field.field_type === 'signature' || field.field_type === 'initials') {
        // Draw signature or initials
        if (signature.signature_type === 'drawn' && signature.signature_data) {
          try {
            // Embed the signature image
            const signatureImageBytes = Uint8Array.from(
              atob(signature.signature_data.replace(/^data:image\/\w+;base64,/, '')),
              c => c.charCodeAt(0)
            );
            const signatureImage = await pdfDoc.embedPng(signatureImageBytes);
            
            // Calculate aspect ratio to fit within field bounds
            const imgAspect = signatureImage.width / signatureImage.height;
            const fieldAspect = fieldWidth / fieldHeight;
            
            let drawWidth = fieldWidth;
            let drawHeight = fieldHeight;
            
            if (imgAspect > fieldAspect) {
              drawHeight = fieldWidth / imgAspect;
            } else {
              drawWidth = fieldHeight * imgAspect;
            }

            page.drawImage(signatureImage, {
              x: x + (fieldWidth - drawWidth) / 2,
              y: y + (fieldHeight - drawHeight) / 2,
              width: drawWidth,
              height: drawHeight,
            });
          } catch (imgError) {
            console.error('Error embedding signature image:', imgError);
            // Fallback to text
            const displayText = field.field_type === 'initials' 
              ? (signature.signer_name || 'Signed').split(' ').map((w: string) => w[0]).join('').toUpperCase()
              : signature.signer_name || 'Signed';
            page.drawText(displayText, {
              x: x + 5,
              y: y + fieldHeight / 2 - 6,
              size: 12,
              font: helveticaFont,
              color: rgb(0, 0, 0.5),
            });
          }
        } else if (signature.signature_type === 'typed') {
          // Draw typed signature - for initials, just use first letters
          const fontSize = Math.min(fieldHeight * 0.6, 24);
          const displayText = field.field_type === 'initials'
            ? (signature.signature_data || signature.signer_name || '').split(' ').map((w: string) => w[0]).join('').toUpperCase()
            : signature.signature_data || signature.signer_name || '';
          page.drawText(displayText, {
            x: x + 5,
            y: y + fieldHeight / 2 - fontSize / 3,
            size: fontSize,
            font: helveticaFont,
            color: rgb(0, 0, 0.5),
          });
        }
      } else if (field.field_type === 'date') {
        const dateStr = signature.signed_at 
          ? new Date(signature.signed_at).toLocaleDateString('en-US', { 
              year: 'numeric', month: 'long', day: 'numeric' 
            })
          : '';
        page.drawText(dateStr, {
          x: x + 5,
          y: y + fieldHeight / 2 - 5,
          size: 10,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
      } else if (field.field_type === 'name') {
        page.drawText(signature.signer_name || '', {
          x: x + 5,
          y: y + fieldHeight / 2 - 5,
          size: 10,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
      } else if (field.field_type === 'email') {
        page.drawText(signature.signer_email || '', {
          x: x + 5,
          y: y + fieldHeight / 2 - 5,
          size: 10,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
      } else if (field.field_type === 'text') {
        const textValue = fieldValues[field.id] || '';
        page.drawText(textValue, {
          x: x + 5,
          y: y + fieldHeight / 2 - 5,
          size: 10,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
      }
    }

    // Add audit trail page if requested
    if (includeAuditTrail && signatures && signatures.length > 0) {
      const auditPage = pdfDoc.addPage([612, 792]); // Letter size
      let yPosition = 750;
      const leftMargin = 50;
      const lineHeight = 18;

      // Title
      auditPage.drawText('DIGITAL SIGNATURE CERTIFICATE', {
        x: leftMargin,
        y: yPosition,
        size: 18,
        font: helveticaBold,
        color: rgb(0, 0, 0),
      });
      yPosition -= 30;

      // Document info
      auditPage.drawText('Document Information', {
        x: leftMargin,
        y: yPosition,
        size: 14,
        font: helveticaBold,
        color: rgb(0.2, 0.2, 0.2),
      });
      yPosition -= lineHeight;

      auditPage.drawText(`Document Name: ${document.document_name}`, {
        x: leftMargin,
        y: yPosition,
        size: 10,
        font: helveticaFont,
        color: rgb(0, 0, 0),
      });
      yPosition -= lineHeight;

      auditPage.drawText(`Document ID: ${document.id}`, {
        x: leftMargin,
        y: yPosition,
        size: 10,
        font: helveticaFont,
        color: rgb(0, 0, 0),
      });
      yPosition -= lineHeight;

      auditPage.drawText(`Created: ${new Date(document.created_at).toLocaleString()}`, {
        x: leftMargin,
        y: yPosition,
        size: 10,
        font: helveticaFont,
        color: rgb(0, 0, 0),
      });
      yPosition -= lineHeight;

      if (document.signed_at) {
        auditPage.drawText(`Completed: ${new Date(document.signed_at).toLocaleString()}`, {
          x: leftMargin,
          y: yPosition,
          size: 10,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
        yPosition -= lineHeight;
      }

      yPosition -= 20;

      // Signature details for each signer
      auditPage.drawText('Signature Details', {
        x: leftMargin,
        y: yPosition,
        size: 14,
        font: helveticaBold,
        color: rgb(0.2, 0.2, 0.2),
      });
      yPosition -= lineHeight + 5;

      for (let i = 0; i < signatures.length; i++) {
        const sig = signatures[i];
        const signer = signers?.find(s => s.id === sig.signer_id);

        // Draw a separator line
        auditPage.drawLine({
          start: { x: leftMargin, y: yPosition + 5 },
          end: { x: 562, y: yPosition + 5 },
          thickness: 0.5,
          color: rgb(0.8, 0.8, 0.8),
        });
        yPosition -= 10;

        auditPage.drawText(`Signer ${i + 1}: ${sig.signer_name}`, {
          x: leftMargin,
          y: yPosition,
          size: 11,
          font: helveticaBold,
          color: rgb(0, 0, 0),
        });
        yPosition -= lineHeight;

        auditPage.drawText(`Email: ${sig.signer_email || 'Not provided'}`, {
          x: leftMargin + 20,
          y: yPosition,
          size: 10,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
        yPosition -= lineHeight;

        auditPage.drawText(`Signature Type: ${sig.signature_type === 'drawn' ? 'Hand-drawn' : 'Typed'}`, {
          x: leftMargin + 20,
          y: yPosition,
          size: 10,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
        yPosition -= lineHeight;

        auditPage.drawText(`Signed At: ${sig.signed_at ? new Date(sig.signed_at).toLocaleString() : 'N/A'}`, {
          x: leftMargin + 20,
          y: yPosition,
          size: 10,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
        yPosition -= lineHeight;

        auditPage.drawText(`IP Address: ${sig.ip_address || 'Not recorded'}`, {
          x: leftMargin + 20,
          y: yPosition,
          size: 10,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
        yPosition -= lineHeight;

        // User agent (truncate if too long)
        const userAgent = sig.user_agent || 'Not recorded';
        const truncatedAgent = userAgent.length > 80 ? userAgent.substring(0, 80) + '...' : userAgent;
        auditPage.drawText(`User Agent: ${truncatedAgent}`, {
          x: leftMargin + 20,
          y: yPosition,
          size: 9,
          font: helveticaFont,
          color: rgb(0.3, 0.3, 0.3),
        });
        yPosition -= lineHeight + 10;

        if (yPosition < 100) {
          // Add new page if running out of space
          const newPage = pdfDoc.addPage([612, 792]);
          yPosition = 750;
        }
      }

      // Footer disclaimer
      yPosition = 50;
      auditPage.drawText('This document was electronically signed using a secure digital signature platform.', {
        x: leftMargin,
        y: yPosition,
        size: 8,
        font: helveticaFont,
        color: rgb(0.5, 0.5, 0.5),
      });
      yPosition -= 12;
      auditPage.drawText('The signature(s) are legally binding and comply with electronic signature laws.', {
        x: leftMargin,
        y: yPosition,
        size: 8,
        font: helveticaFont,
        color: rgb(0.5, 0.5, 0.5),
      });
    }

    // Serialize the PDF
    const modifiedPdfBytes = await pdfDoc.save();
    
    // Convert to base64 using chunked approach to avoid stack overflow
    const uint8Array = new Uint8Array(modifiedPdfBytes);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const base64Pdf = btoa(binary);

    console.log('PDF generated successfully, size:', uint8Array.length);

    return new Response(JSON.stringify({ 
      pdf: base64Pdf,
      filename: `${document.document_name.replace(/\.pdf$/i, '')}_signed.pdf`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error generating PDF:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
