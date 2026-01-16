import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { estimateId, projectId, signerName, signedAt } = await req.json();

    console.log('Generating contract PDF for estimate:', estimateId);

    if (!estimateId) {
      throw new Error('Estimate ID is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch estimate data
    const { data: estimate, error: estimateError } = await supabase
      .from('estimates')
      .select('*')
      .eq('id', estimateId)
      .single();

    if (estimateError || !estimate) {
      console.error('Failed to fetch estimate:', estimateError);
      throw new Error('Failed to fetch estimate');
    }

    // Fetch related data
    const [groupsRes, itemsRes, scheduleRes, signatureRes, settingsRes] = await Promise.all([
      supabase.from('estimate_groups').select('*').eq('estimate_id', estimateId).order('sort_order'),
      supabase.from('estimate_line_items').select('*').eq('estimate_id', estimateId).order('sort_order'),
      supabase.from('estimate_payment_schedule').select('*').eq('estimate_id', estimateId).order('sort_order'),
      supabase.from('estimate_signatures').select('*').eq('estimate_id', estimateId).order('signed_at', { ascending: false }).limit(1),
      supabase.from('app_settings').select('setting_key, setting_value').in('setting_key', ['company_name', 'company_address', 'company_phone']),
    ]);

    const groups = groupsRes.data || [];
    const lineItems = itemsRes.data || [];
    const paymentSchedule = scheduleRes.data || [];
    const signature = signatureRes.data?.[0] || null;
    
    const settingsMap: Record<string, string> = {};
    settingsRes.data?.forEach((s: any) => {
      settingsMap[s.setting_key] = s.setting_value || '';
    });

    const companyName = settingsMap['company_name'] || 'Company';
    const companyAddress = settingsMap['company_address'] || '';
    const companyPhone = settingsMap['company_phone'] || '';

    // Format currency helper
    const formatCurrency = (amount: number | null) => {
      if (amount === null || amount === undefined) return '$0.00';
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
      }).format(amount);
    };

    // Format date helper
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    // Create PDF document
    const pdfDoc = await PDFDocument.create();
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    
    let page = pdfDoc.addPage([612, 792]); // Letter size
    const { width, height } = page.getSize();
    
    let yPos = height - 50;
    const margin = 50;
    const contentWidth = width - (margin * 2);
    
    const black = rgb(0, 0, 0);
    const gray = rgb(0.4, 0.4, 0.4);
    const green = rgb(0.13, 0.55, 0.13);
    const lightGray = rgb(0.9, 0.9, 0.9);

    // Helper function to add new page if needed
    const checkNewPage = (neededSpace: number) => {
      if (yPos - neededSpace < 50) {
        page = pdfDoc.addPage([612, 792]);
        yPos = height - 50;
      }
    };

    // Helper to sanitize text for PDF (remove characters that can't be encoded)
    const sanitizeText = (text: string): string => {
      if (!text) return '';
      // Replace newlines, tabs, and other control characters with spaces
      return text.replace(/[\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
    };

    // Helper to draw text with word wrap
    const drawWrappedText = (text: string, x: number, maxWidth: number, fontSize: number, font: any, color = black) => {
      const sanitized = sanitizeText(text);
      const words = sanitized.split(' ');
      let line = '';
      
      for (const word of words) {
        const testLine = line + (line ? ' ' : '') + word;
        const testWidth = font.widthOfTextAtSize(testLine, fontSize);
        
        if (testWidth > maxWidth && line) {
          checkNewPage(fontSize + 4);
          page.drawText(line, { x, y: yPos, size: fontSize, font, color });
          yPos -= fontSize + 4;
          line = word;
        } else {
          line = testLine;
        }
      }
      
      if (line) {
        checkNewPage(fontSize + 4);
        page.drawText(line, { x, y: yPos, size: fontSize, font, color });
        yPos -= fontSize + 4;
      }
    };

    // HEADER
    page.drawText(companyName, {
      x: margin,
      y: yPos,
      size: 24,
      font: helveticaBold,
      color: black,
    });
    yPos -= 20;

    if (companyAddress) {
      page.drawText(companyAddress, { x: margin, y: yPos, size: 10, font: helvetica, color: gray });
      yPos -= 14;
    }
    if (companyPhone) {
      page.drawText(companyPhone, { x: margin, y: yPos, size: 10, font: helvetica, color: gray });
      yPos -= 14;
    }
    yPos -= 10;

    // Contract number
    page.drawText(`Contract #CNT-${estimate.estimate_number}`, {
      x: margin,
      y: yPos,
      size: 14,
      font: helveticaBold,
      color: black,
    });
    yPos -= 30;

    // Horizontal line
    page.drawLine({
      start: { x: margin, y: yPos + 15 },
      end: { x: width - margin, y: yPos + 15 },
      thickness: 2,
      color: black,
    });
    yPos -= 10;

    // CUSTOMER & PROJECT INFO (two columns)
    const colWidth = contentWidth / 2 - 10;
    
    // Customer Info
    page.drawText('CUSTOMER INFORMATION', { x: margin, y: yPos, size: 10, font: helveticaBold, color: gray });
    yPos -= 16;
    page.drawText(estimate.customer_name || '', { x: margin, y: yPos, size: 12, font: helveticaBold, color: black });
    yPos -= 14;
    if (estimate.customer_email) {
      page.drawText(estimate.customer_email, { x: margin, y: yPos, size: 10, font: helvetica, color: gray });
      yPos -= 12;
    }
    if (estimate.customer_phone) {
      page.drawText(estimate.customer_phone, { x: margin, y: yPos, size: 10, font: helvetica, color: gray });
      yPos -= 12;
    }
    if (estimate.billing_address) {
      page.drawText(estimate.billing_address, { x: margin, y: yPos, size: 10, font: helvetica, color: gray });
      yPos -= 12;
    }
    yPos -= 10;

    // Project Details
    page.drawText('PROJECT DETAILS', { x: margin, y: yPos, size: 10, font: helveticaBold, color: gray });
    yPos -= 16;
    page.drawText(estimate.estimate_title || '', { x: margin, y: yPos, size: 12, font: helveticaBold, color: black });
    yPos -= 14;
    if (estimate.job_address) {
      page.drawText(`Address: ${estimate.job_address}`, { x: margin, y: yPos, size: 10, font: helvetica, color: gray });
      yPos -= 12;
    }
    page.drawText(`Date: ${formatDate(estimate.estimate_date)}`, { x: margin, y: yPos, size: 10, font: helvetica, color: gray });
    yPos -= 12;
    if (estimate.signed_at) {
      page.drawText(`Signed: ${formatDate(estimate.signed_at)}`, { x: margin, y: yPos, size: 10, font: helvetica, color: green });
      yPos -= 12;
    }
    yPos -= 20;

    // SCOPE OF WORK
    page.drawText('SCOPE OF WORK', { x: margin, y: yPos, size: 12, font: helveticaBold, color: black });
    yPos -= 5;
    page.drawLine({
      start: { x: margin, y: yPos },
      end: { x: width - margin, y: yPos },
      thickness: 1,
      color: lightGray,
    });
    yPos -= 15;

    if (estimate.work_scope_description) {
      drawWrappedText(estimate.work_scope_description, margin, contentWidth, 10, helvetica, gray);
      yPos -= 10;
    }

    // Line items by group
    for (const group of groups) {
      checkNewPage(60);
      
      // Group header with background
      page.drawRectangle({
        x: margin,
        y: yPos - 5,
        width: contentWidth,
        height: 20,
        color: lightGray,
      });
      page.drawText(group.group_name, { x: margin + 5, y: yPos, size: 11, font: helveticaBold, color: black });
      yPos -= 25;

      const groupItems = lineItems.filter((item: any) => item.group_id === group.id);
      
      // Table header
      page.drawText('Description', { x: margin + 5, y: yPos, size: 9, font: helveticaBold, color: gray });
      page.drawText('Qty', { x: margin + 280, y: yPos, size: 9, font: helveticaBold, color: gray });
      page.drawText('Unit Price', { x: margin + 340, y: yPos, size: 9, font: helveticaBold, color: gray });
      page.drawText('Total', { x: margin + 440, y: yPos, size: 9, font: helveticaBold, color: gray });
      yPos -= 5;
      page.drawLine({
        start: { x: margin, y: yPos },
        end: { x: width - margin, y: yPos },
        thickness: 0.5,
        color: gray,
      });
      yPos -= 12;

      for (const item of groupItems) {
        checkNewPage(20);
        
        // Truncate description if too long
        let desc = item.description || '';
        if (desc.length > 45) desc = desc.substring(0, 42) + '...';
        
        page.drawText(desc, { x: margin + 5, y: yPos, size: 9, font: helvetica, color: black });
        page.drawText(`${item.quantity} ${item.unit || ''}`, { x: margin + 280, y: yPos, size: 9, font: helvetica, color: black });
        page.drawText(formatCurrency(item.unit_price), { x: margin + 340, y: yPos, size: 9, font: helvetica, color: black });
        page.drawText(formatCurrency(item.line_total), { x: margin + 440, y: yPos, size: 9, font: helveticaBold, color: black });
        yPos -= 14;
      }
      yPos -= 10;
    }

    // TOTALS
    checkNewPage(100);
    yPos -= 10;
    
    page.drawRectangle({
      x: margin + 300,
      y: yPos - 80,
      width: contentWidth - 300,
      height: 90,
      color: lightGray,
    });

    const totalsX = margin + 310;
    yPos -= 5;
    
    page.drawText('Subtotal:', { x: totalsX, y: yPos, size: 10, font: helvetica, color: black });
    page.drawText(formatCurrency(estimate.subtotal), { x: totalsX + 130, y: yPos, size: 10, font: helvetica, color: black });
    yPos -= 16;

    if ((estimate.tax_amount || 0) > 0) {
      page.drawText(`Tax (${estimate.tax_rate}%):`, { x: totalsX, y: yPos, size: 10, font: helvetica, color: black });
      page.drawText(formatCurrency(estimate.tax_amount), { x: totalsX + 130, y: yPos, size: 10, font: helvetica, color: black });
      yPos -= 16;
    }

    if ((estimate.discount_amount || 0) > 0) {
      page.drawText('Discount:', { x: totalsX, y: yPos, size: 10, font: helvetica, color: black });
      page.drawText(`-${formatCurrency(estimate.discount_amount)}`, { x: totalsX + 130, y: yPos, size: 10, font: helvetica, color: black });
      yPos -= 16;
    }

    page.drawLine({
      start: { x: totalsX, y: yPos + 5 },
      end: { x: width - margin - 10, y: yPos + 5 },
      thickness: 1,
      color: black,
    });
    yPos -= 5;

    page.drawText('TOTAL:', { x: totalsX, y: yPos, size: 14, font: helveticaBold, color: black });
    page.drawText(formatCurrency(estimate.total), { x: totalsX + 130, y: yPos, size: 14, font: helveticaBold, color: black });
    yPos -= 40;

    // PAYMENT SCHEDULE
    if (paymentSchedule.length > 0) {
      checkNewPage(80);
      
      page.drawText('PAYMENT SCHEDULE', { x: margin, y: yPos, size: 12, font: helveticaBold, color: black });
      yPos -= 5;
      page.drawLine({
        start: { x: margin, y: yPos },
        end: { x: width - margin, y: yPos },
        thickness: 1,
        color: lightGray,
      });
      yPos -= 15;

      for (const phase of paymentSchedule) {
        checkNewPage(20);
        page.drawText(phase.phase_name, { x: margin + 5, y: yPos, size: 10, font: helvetica, color: black });
        page.drawText(`${phase.percent}%`, { x: margin + 300, y: yPos, size: 10, font: helvetica, color: black });
        page.drawText(formatCurrency((estimate.total * phase.percent) / 100), { x: margin + 400, y: yPos, size: 10, font: helveticaBold, color: black });
        yPos -= 14;
      }
      yPos -= 20;
    }

    // TERMS AND CONDITIONS
    if (estimate.terms_and_conditions) {
      checkNewPage(60);
      
      page.drawText('TERMS AND CONDITIONS', { x: margin, y: yPos, size: 12, font: helveticaBold, color: black });
      yPos -= 5;
      page.drawLine({
        start: { x: margin, y: yPos },
        end: { x: width - margin, y: yPos },
        thickness: 1,
        color: lightGray,
      });
      yPos -= 15;

      // Handle terms - split by newlines and draw each paragraph
      const termsText = sanitizeText(estimate.terms_and_conditions);
      drawWrappedText(termsText, margin + 5, contentWidth - 10, 9, helvetica, gray);
      yPos -= 20;
    }

    // SIGNATURE SECTION
    if (signature) {
      checkNewPage(100);
      
      // Green border box for signature
      page.drawRectangle({
        x: margin,
        y: yPos - 80,
        width: contentWidth,
        height: 90,
        borderColor: green,
        borderWidth: 2,
        color: rgb(0.94, 0.99, 0.94),
      });

      yPos -= 10;
      page.drawText('[X] CUSTOMER SIGNATURE', { x: margin + 10, y: yPos, size: 11, font: helveticaBold, color: green });
      yPos -= 20;

      if (signature.signature_type === 'typed') {
        page.drawText(signature.signature_data, { x: margin + 10, y: yPos, size: 24, font: helveticaBold, color: black });
        yPos -= 25;
      } else {
        // For drawn signatures, we can't easily embed the image in pdf-lib without more complex handling
        page.drawText('[Drawn Signature on File]', { x: margin + 10, y: yPos, size: 12, font: helvetica, color: gray });
        yPos -= 20;
      }

      page.drawText(`Signed by: ${signature.signer_name}`, { x: margin + 10, y: yPos, size: 9, font: helvetica, color: gray });
      yPos -= 12;
      if (signature.signer_email) {
        page.drawText(`Email: ${signature.signer_email}`, { x: margin + 10, y: yPos, size: 9, font: helvetica, color: gray });
        yPos -= 12;
      }
      page.drawText(`Date: ${formatDate(signature.signed_at)}`, { x: margin + 10, y: yPos, size: 9, font: helvetica, color: gray });
      yPos -= 30;
    }

    // FOOTER
    checkNewPage(30);
    page.drawLine({
      start: { x: margin, y: yPos + 10 },
      end: { x: width - margin, y: yPos + 10 },
      thickness: 0.5,
      color: lightGray,
    });
    page.drawText(`This is a legally binding contract. Generated on ${formatDate(new Date().toISOString())}`, {
      x: margin,
      y: yPos - 5,
      size: 8,
      font: helvetica,
      color: gray,
    });

    // Serialize PDF to bytes
    const pdfBytes = await pdfDoc.save();
    
    const fileName = `CNT-${estimate.estimate_number}-${Date.now()}.pdf`;
    const filePath = `${projectId || 'general'}/${fileName}`;
    
    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('contracts')
      .upload(filePath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.error('Failed to upload contract:', uploadError);
      throw new Error('Failed to upload contract');
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('contracts')
      .getPublicUrl(filePath);

    const publicUrl = urlData.publicUrl;

    console.log('Contract PDF uploaded successfully:', publicUrl);

    // If projectId provided, update the agreement with the attachment URL
    if (projectId) {
      const contractNumber = `CNT-${estimate.estimate_number}`;
      
      // Update existing agreement or create if doesn't exist
      const { data: existingAgreement } = await supabase
        .from('project_agreements')
        .select('id')
        .eq('project_id', projectId)
        .eq('agreement_number', contractNumber)
        .maybeSingle();

      if (existingAgreement) {
        await supabase
          .from('project_agreements')
          .update({ attachment_url: publicUrl })
          .eq('id', existingAgreement.id);
        
        console.log('Updated existing agreement with PDF attachment');
      } else {
        // Create new agreement with attachment
        await supabase.from('project_agreements').insert({
          project_id: projectId,
          agreement_number: contractNumber,
          agreement_signed_date: new Date().toISOString().split('T')[0],
          agreement_type: 'Contract',
          total_price: estimate.total || 0,
          description_of_work: estimate.work_scope_description || estimate.estimate_title,
          attachment_url: publicUrl,
        });
        
        console.log('Created new agreement with PDF attachment');
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        url: publicUrl,
        fileName,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error generating contract PDF:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});