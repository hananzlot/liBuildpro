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
    const settingKeys = ['company_name', 'company_address', 'company_phone', 'license_number', 'license_type', 'license_holder_name', 'app_base_url'];
    
    const [groupsRes, itemsRes, scheduleRes, signaturesRes, companySettingsRes, appSettingsRes] = await Promise.all([
      supabase.from('estimate_groups').select('*').eq('estimate_id', estimateId).order('sort_order'),
      supabase.from('estimate_line_items').select('*').eq('estimate_id', estimateId).order('sort_order'),
      supabase.from('estimate_payment_schedule').select('*').eq('estimate_id', estimateId).order('sort_order'),
      supabase.from('estimate_signatures').select('*').eq('estimate_id', estimateId).order('signed_at'),
      // Try company_settings first using estimate's company_id
      estimate.company_id 
        ? supabase.from('company_settings').select('setting_key, setting_value')
            .eq('company_id', estimate.company_id).in('setting_key', settingKeys)
        : Promise.resolve({ data: [] }),
      // Fall back to app_settings
      supabase.from('app_settings').select('setting_key, setting_value').in('setting_key', settingKeys),
    ]);

    const groups = groupsRes.data || [];
    const lineItems = itemsRes.data || [];
    const paymentSchedule = scheduleRes.data || [];
    const signatures = signaturesRes.data || [];
    
    // Merge settings: company_settings override app_settings
    const settingsMap: Record<string, string> = {};
    appSettingsRes.data?.forEach((s: any) => {
      if (s.setting_value) settingsMap[s.setting_key] = s.setting_value;
    });
    companySettingsRes.data?.forEach((s: any) => {
      if (s.setting_value) settingsMap[s.setting_key] = s.setting_value;
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

    // Helper to sanitize text for PDF (WinAnsi encoding can't handle certain Unicode characters)
    // This removes emoji, variation selectors, and other characters outside the WinAnsi range
    const sanitizeForPdf = (text: string): string => {
      if (!text) return '';
      // WinAnsi (Windows-1252) can encode ASCII + some extended Latin characters
      // Remove characters that can't be encoded: emoji, variation selectors (0xfe0f), etc.
      // Keep printable ASCII (0x20-0x7E) and common extended Latin (0xA0-0xFF)
      return text
        .replace(/[\u{FE00}-\u{FE0F}]/gu, '') // Variation selectors
        .replace(/[\u{1F000}-\u{1FFFF}]/gu, '') // Emoji ranges
        .replace(/[\u{2600}-\u{26FF}]/gu, '') // Miscellaneous symbols
        .replace(/[\u{2700}-\u{27BF}]/gu, '') // Dingbats
        .replace(/[\u{E000}-\u{F8FF}]/gu, '') // Private use area
        .replace(/[\u{200B}-\u{200D}]/gu, '') // Zero-width characters
        .replace(/[\u{2028}-\u{2029}]/gu, '') // Line/paragraph separators
        .replace(/[^\x20-\x7E\xA0-\xFF\n\r\t]/g, '') // Keep only WinAnsi-compatible chars + newlines
        .replace(/\t/g, ' ') // Replace tabs with spaces
        .replace(/\r/g, '') // Remove carriage returns
        .replace(/  +/g, ' '); // Collapse multiple spaces
    };

    // Helper to sanitize a single line of text for PDF (removes newlines too)
    const sanitizeLine = (text: string): string => {
      if (!text) return '';
      return sanitizeForPdf(text).replace(/\n/g, ' ').trim();
    };

    // Helper to draw text with word wrap (handles a single paragraph)
    const drawWrappedParagraph = (text: string, x: number, maxWidth: number, fontSize: number, font: any, color = black) => {
      const sanitized = sanitizeLine(text);
      if (!sanitized) return;
      
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

    // Helper to draw multi-line text preserving paragraph breaks
    const drawWrappedText = (text: string, x: number, maxWidth: number, fontSize: number, font: any, color = black) => {
      if (!text) return;
      // First sanitize the entire text block
      const sanitized = sanitizeForPdf(text);
      // Split by newlines to preserve paragraph structure
      const paragraphs = sanitized.split(/\n/);
      
      for (const paragraph of paragraphs) {
        if (paragraph.trim()) {
          drawWrappedParagraph(paragraph, x, maxWidth, fontSize, font, color);
        } else {
          // Empty line = paragraph break, add extra spacing
          yPos -= fontSize + 2;
        }
      }
    };

    // HEADER
    page.drawText(sanitizeLine(companyName), {
      x: margin,
      y: yPos,
      size: 24,
      font: helveticaBold,
      color: black,
    });
    yPos -= 20;

    if (companyAddress) {
      page.drawText(sanitizeLine(companyAddress), { x: margin, y: yPos, size: 10, font: helvetica, color: gray });
      yPos -= 14;
    }
    if (companyPhone) {
      page.drawText(sanitizeLine(companyPhone), { x: margin, y: yPos, size: 10, font: helvetica, color: gray });
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
    page.drawText(sanitizeLine(estimate.customer_name || ''), { x: margin, y: yPos, size: 12, font: helveticaBold, color: black });
    yPos -= 14;
    if (estimate.customer_email) {
      page.drawText(sanitizeLine(estimate.customer_email), { x: margin, y: yPos, size: 10, font: helvetica, color: gray });
      yPos -= 12;
    }
    if (estimate.customer_phone) {
      page.drawText(sanitizeLine(estimate.customer_phone), { x: margin, y: yPos, size: 10, font: helvetica, color: gray });
      yPos -= 12;
    }
    if (estimate.billing_address) {
      page.drawText(sanitizeLine(estimate.billing_address), { x: margin, y: yPos, size: 10, font: helvetica, color: gray });
      yPos -= 12;
    }
    yPos -= 10;

    // Project Details
    page.drawText('PROJECT DETAILS', { x: margin, y: yPos, size: 10, font: helveticaBold, color: gray });
    yPos -= 16;
    page.drawText(sanitizeLine(estimate.estimate_title || ''), { x: margin, y: yPos, size: 12, font: helveticaBold, color: black });
    yPos -= 14;
    if (estimate.job_address) {
      page.drawText(sanitizeLine(`Address: ${estimate.job_address}`), { x: margin, y: yPos, size: 10, font: helvetica, color: gray });
      yPos -= 12;
    }
    page.drawText(`Date: ${formatDate(estimate.estimate_date)}`, { x: margin, y: yPos, size: 10, font: helvetica, color: gray });
    yPos -= 12;
    if (estimate.salesperson_name) {
      page.drawText(sanitizeLine(`Sales Rep: ${estimate.salesperson_name}`), { x: margin, y: yPos, size: 10, font: helvetica, color: gray });
      yPos -= 12;
    }
    if (estimate.signed_at) {
      page.drawText(`Signed: ${formatDate(estimate.signed_at)}`, { x: margin, y: yPos, size: 10, font: helvetica, color: green });
      yPos -= 12;
    }
    yPos -= 20;

    // AI ANALYSIS SECTIONS (Project Understanding, Assumptions, Inclusions/Exclusions)
    const aiAnalysis = estimate.ai_analysis as {
      project_understanding?: string[];
      assumptions?: string[];
      inclusions?: string[];
      exclusions?: string[];
    } | null;

    if (aiAnalysis) {
      // Project Understanding
      if (aiAnalysis.project_understanding && aiAnalysis.project_understanding.length > 0) {
        checkNewPage(60);
        page.drawText('PROJECT UNDERSTANDING', { x: margin, y: yPos, size: 12, font: helveticaBold, color: black });
        yPos -= 5;
        page.drawLine({
          start: { x: margin, y: yPos },
          end: { x: width - margin, y: yPos },
          thickness: 1,
          color: lightGray,
        });
        yPos -= 15;

        for (const item of aiAnalysis.project_understanding) {
          checkNewPage(20);
          const bulletText = `• ${sanitizeLine(item)}`;
          drawWrappedParagraph(bulletText, margin + 5, contentWidth - 10, 10, helvetica, gray);
          yPos -= 2;
        }
        yPos -= 15;
      }

      // Assumptions
      if (aiAnalysis.assumptions && aiAnalysis.assumptions.length > 0) {
        checkNewPage(60);
        page.drawText('ASSUMPTIONS', { x: margin, y: yPos, size: 12, font: helveticaBold, color: black });
        yPos -= 5;
        page.drawLine({
          start: { x: margin, y: yPos },
          end: { x: width - margin, y: yPos },
          thickness: 1,
          color: lightGray,
        });
        yPos -= 15;

        for (const item of aiAnalysis.assumptions) {
          checkNewPage(20);
          const bulletText = `• ${sanitizeLine(item)}`;
          drawWrappedParagraph(bulletText, margin + 5, contentWidth - 10, 10, helvetica, gray);
          yPos -= 2;
        }
        yPos -= 15;
      }

      // Inclusions & Exclusions (side by side if both exist, otherwise full width)
      const hasInclusions = aiAnalysis.inclusions && aiAnalysis.inclusions.length > 0;
      const hasExclusions = aiAnalysis.exclusions && aiAnalysis.exclusions.length > 0;

      if (hasInclusions || hasExclusions) {
        checkNewPage(80);
        
        // Section header
        page.drawText('INCLUSIONS & EXCLUSIONS', { x: margin, y: yPos, size: 12, font: helveticaBold, color: black });
        yPos -= 5;
        page.drawLine({
          start: { x: margin, y: yPos },
          end: { x: width - margin, y: yPos },
          thickness: 1,
          color: lightGray,
        });
        yPos -= 15;

        // Draw inclusions
        if (hasInclusions) {
          page.drawText('Included:', { x: margin + 5, y: yPos, size: 10, font: helveticaBold, color: green });
          yPos -= 14;
          for (const item of aiAnalysis.inclusions!) {
            checkNewPage(16);
            const bulletText = `+ ${sanitizeLine(item)}`;
            drawWrappedParagraph(bulletText, margin + 10, contentWidth - 15, 9, helvetica, gray);
            yPos -= 2;
          }
          yPos -= 10;
        }

        // Draw exclusions
        if (hasExclusions) {
          const red = rgb(0.8, 0.2, 0.2);
          page.drawText('Excluded:', { x: margin + 5, y: yPos, size: 10, font: helveticaBold, color: red });
          yPos -= 14;
          for (const item of aiAnalysis.exclusions!) {
            checkNewPage(16);
            const bulletText = `- ${sanitizeLine(item)}`;
            drawWrappedParagraph(bulletText, margin + 10, contentWidth - 15, 9, helvetica, gray);
            yPos -= 2;
          }
          yPos -= 10;
        }
        yPos -= 10;
      }
    }

    // SCOPE OF WORK DESCRIPTION (if enabled)
    if (estimate.show_scope_to_customer && estimate.work_scope_description) {
      page.drawText('SCOPE OF WORK', { x: margin, y: yPos, size: 12, font: helveticaBold, color: black });
      yPos -= 5;
      page.drawLine({
        start: { x: margin, y: yPos },
        end: { x: width - margin, y: yPos },
        thickness: 1,
        color: lightGray,
      });
      yPos -= 15;

      drawWrappedText(estimate.work_scope_description, margin, contentWidth, 10, helvetica, gray);
      yPos -= 20;
    }

    // Check if we should show line items and details
    const showLineItems = estimate.show_line_items_to_customer ?? false;
    const showDetails = estimate.show_details_to_customer ?? false;

    // Line items by group - only if show_line_items_to_customer is true
    if (showLineItems) {
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
        page.drawText(sanitizeLine(group.group_name), { x: margin + 5, y: yPos, size: 11, font: helveticaBold, color: black });
        yPos -= 25;

        const groupItems = lineItems.filter((item: any) => item.group_id === group.id);
        
        // Table header - conditionally show Qty and Unit Price columns
        const rightEdge = width - margin;
        const totalColWidth = 80;
        const unitPriceColWidth = 80;
        const qtyColWidth = 50;
        
        page.drawText('Description', { x: margin + 5, y: yPos, size: 9, font: helveticaBold, color: gray });
        if (showDetails) {
          page.drawText('Qty', { x: rightEdge - totalColWidth - unitPriceColWidth - qtyColWidth, y: yPos, size: 9, font: helveticaBold, color: gray });
          // Right-align "Unit Price" header
          const unitPriceHeader = 'Unit Price';
          const unitPriceHeaderWidth = helveticaBold.widthOfTextAtSize(unitPriceHeader, 9);
          page.drawText(unitPriceHeader, { x: rightEdge - totalColWidth - unitPriceColWidth + (unitPriceColWidth - unitPriceHeaderWidth), y: yPos, size: 9, font: helveticaBold, color: gray });
        }
        if (showDetails) {
          // Right-align "Total" header
          const totalHeader = 'Total';
          const totalHeaderWidth = helveticaBold.widthOfTextAtSize(totalHeader, 9);
          page.drawText(totalHeader, { x: rightEdge - totalColWidth + (totalColWidth - totalHeaderWidth), y: yPos, size: 9, font: helveticaBold, color: gray });
        }
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
          
          // Truncate description if too long - allow longer desc if not showing details
          let desc = sanitizeLine(item.description || '');
          const maxDescLength = showDetails ? 45 : 70;
          if (desc.length > maxDescLength) desc = desc.substring(0, maxDescLength - 3) + '...';
          
          page.drawText(desc, { x: margin + 5, y: yPos, size: 9, font: helvetica, color: black });
          if (showDetails) {
            page.drawText(sanitizeLine(`${item.quantity} ${item.unit || ''}`), { x: rightEdge - totalColWidth - unitPriceColWidth - qtyColWidth, y: yPos, size: 9, font: helvetica, color: black });
            // Right-align unit price
            const unitPriceText = formatCurrency(item.unit_price);
            const unitPriceWidth = helvetica.widthOfTextAtSize(unitPriceText, 9);
            page.drawText(unitPriceText, { x: rightEdge - totalColWidth - unitPriceColWidth + (unitPriceColWidth - unitPriceWidth), y: yPos, size: 9, font: helvetica, color: black });
            // Right-align line total (only when showing details)
            const lineTotalText = formatCurrency(item.line_total);
            const lineTotalWidth = helveticaBold.widthOfTextAtSize(lineTotalText, 9);
            page.drawText(lineTotalText, { x: rightEdge - totalColWidth + (totalColWidth - lineTotalWidth), y: yPos, size: 9, font: helveticaBold, color: black });
          }
          yPos -= 14;
        }
        
        // Phase subtotal - only show when details are visible
        if (showDetails && groupItems.length > 0) {
          const groupTotal = groupItems.reduce((sum: number, item: any) => sum + (item.line_total || 0), 0);
          checkNewPage(20);
          
          // Dashed line separator
          page.drawLine({
            start: { x: margin + 5, y: yPos + 5 },
            end: { x: width - margin, y: yPos + 5 },
            thickness: 0.5,
            color: gray,
            dashArray: [3, 3],
          });
          yPos -= 5;
          
          // Subtotal label and value
          const subtotalLabel = `${sanitizeLine(group.group_name)} Subtotal`;
          page.drawText(subtotalLabel, { x: margin + 5, y: yPos, size: 9, font: helvetica, color: gray });
          
          // Right-align group subtotal
          const groupTotalText = formatCurrency(groupTotal);
          const groupTotalWidth = helveticaBold.widthOfTextAtSize(groupTotalText, 9);
          page.drawText(groupTotalText, { x: rightEdge - totalColWidth + (totalColWidth - groupTotalWidth), y: yPos, size: 9, font: helveticaBold, color: black });
          yPos -= 14;
        }
        yPos -= 10;
      }
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
    const totalsRightEdge = width - margin - 10;
    yPos -= 5;
    
    // Right-align subtotal
    const subtotalText = formatCurrency(estimate.subtotal);
    const subtotalWidth = helvetica.widthOfTextAtSize(subtotalText, 10);
    page.drawText('Subtotal:', { x: totalsX, y: yPos, size: 10, font: helvetica, color: black });
    page.drawText(subtotalText, { x: totalsRightEdge - subtotalWidth, y: yPos, size: 10, font: helvetica, color: black });
    yPos -= 16;

    if ((estimate.tax_amount || 0) > 0) {
      const taxText = formatCurrency(estimate.tax_amount);
      const taxWidth = helvetica.widthOfTextAtSize(taxText, 10);
      page.drawText(`Tax (${estimate.tax_rate}%):`, { x: totalsX, y: yPos, size: 10, font: helvetica, color: black });
      page.drawText(taxText, { x: totalsRightEdge - taxWidth, y: yPos, size: 10, font: helvetica, color: black });
      yPos -= 16;
    }

    if ((estimate.discount_amount || 0) > 0) {
      const discountText = `-${formatCurrency(estimate.discount_amount)}`;
      const discountWidth = helvetica.widthOfTextAtSize(discountText, 10);
      page.drawText('Discount:', { x: totalsX, y: yPos, size: 10, font: helvetica, color: black });
      page.drawText(discountText, { x: totalsRightEdge - discountWidth, y: yPos, size: 10, font: helvetica, color: black });
      yPos -= 16;
    }

    page.drawLine({
      start: { x: totalsX, y: yPos + 5 },
      end: { x: width - margin - 10, y: yPos + 5 },
      thickness: 1,
      color: black,
    });
    yPos -= 5;

    // Right-align grand total
    const totalText = formatCurrency(estimate.total);
    const totalWidth = helveticaBold.widthOfTextAtSize(totalText, 14);
    page.drawText('TOTAL:', { x: totalsX, y: yPos, size: 14, font: helveticaBold, color: black });
    page.drawText(totalText, { x: totalsRightEdge - totalWidth, y: yPos, size: 14, font: helveticaBold, color: black });
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

      const paymentRightEdge = width - margin;
      for (const phase of paymentSchedule) {
        checkNewPage(20);
        page.drawText(sanitizeLine(phase.phase_name), { x: margin + 5, y: yPos, size: 10, font: helvetica, color: black });
        page.drawText(`${phase.percent}%`, { x: margin + 300, y: yPos, size: 10, font: helvetica, color: black });
        // Right-align payment amount
        const paymentAmtText = formatCurrency((estimate.total * phase.percent) / 100);
        const paymentAmtWidth = helveticaBold.widthOfTextAtSize(paymentAmtText, 10);
        page.drawText(paymentAmtText, { x: paymentRightEdge - paymentAmtWidth, y: yPos, size: 10, font: helveticaBold, color: black });
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

      // Draw terms preserving paragraph structure - skip if first line is just the title repeated
      let termsText = estimate.terms_and_conditions;
      const firstLine = termsText.split('\n')[0]?.trim().toUpperCase();
      if (firstLine === 'TERMS AND CONDITIONS') {
        termsText = termsText.split('\n').slice(1).join('\n').trim();
      }
      drawWrappedText(termsText, margin + 5, contentWidth - 10, 9, helvetica, gray);
      yPos -= 20;
    }

    // SIGNATURE SECTION
    if (signatures.length > 0) {
      checkNewPage(120);
      
      page.drawText('SIGNATURES', { x: margin, y: yPos, size: 12, font: helveticaBold, color: black });
      yPos -= 5;
      page.drawLine({
        start: { x: margin, y: yPos },
        end: { x: width - margin, y: yPos },
        thickness: 1,
        color: lightGray,
      });
      yPos -= 15;

      for (let i = 0; i < signatures.length; i++) {
        const sig = signatures[i];
        checkNewPage(110);
        
        // Green border box for signature
        page.drawRectangle({
          x: margin,
          y: yPos - 85,
          width: contentWidth,
          height: 95,
          borderColor: green,
          borderWidth: 2,
          color: rgb(0.94, 0.99, 0.94),
        });

        yPos -= 10;
        page.drawText(`[X] SIGNER ${i + 1}`, { x: margin + 10, y: yPos, size: 11, font: helveticaBold, color: green });
        yPos -= 20;

        if (sig.signature_type === 'typed') {
          page.drawText(sanitizeLine(sig.signature_data), { x: margin + 10, y: yPos, size: 24, font: helveticaBold, color: black });
          yPos -= 25;
        } else if (sig.signature_type === 'drawn' && sig.signature_data) {
          // Embed the actual drawn signature image
          try {
            // signature_data is a base64 data URL (e.g., "data:image/png;base64,...")
            const base64Data = sig.signature_data.split(',')[1];
            if (base64Data) {
              const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
              const pngImage = await pdfDoc.embedPng(imageBytes);
              const imgDims = pngImage.scale(0.5);
              const maxHeight = 40;
              const scaleFactor = maxHeight / imgDims.height;
              const scaledWidth = imgDims.width * scaleFactor;
              const scaledHeight = maxHeight;
              
              page.drawImage(pngImage, {
                x: margin + 10,
                y: yPos - scaledHeight + 5,
                width: scaledWidth,
                height: scaledHeight,
              });
              yPos -= scaledHeight + 5;
            } else {
              page.drawText('[Signature on File]', { x: margin + 10, y: yPos, size: 12, font: helvetica, color: gray });
              yPos -= 20;
            }
          } catch (imgError) {
            console.error('Failed to embed signature image:', imgError);
            page.drawText('[Signature on File]', { x: margin + 10, y: yPos, size: 12, font: helvetica, color: gray });
            yPos -= 20;
          }
        } else {
          page.drawText('[Signature on File]', { x: margin + 10, y: yPos, size: 12, font: helvetica, color: gray });
          yPos -= 20;
        }

        page.drawText(sanitizeLine(`Signed by: ${sig.signer_name}`), { x: margin + 10, y: yPos, size: 9, font: helvetica, color: gray });
        yPos -= 12;
        if (sig.signer_email) {
          page.drawText(sanitizeLine(`Email: ${sig.signer_email}`), { x: margin + 10, y: yPos, size: 9, font: helvetica, color: gray });
          yPos -= 12;
        }
        page.drawText(`Date: ${formatDate(sig.signed_at)}`, { x: margin + 10, y: yPos, size: 9, font: helvetica, color: gray });
        yPos -= 25;
      }
    }

    // FOOTER - different message based on status
    checkNewPage(30);
    page.drawLine({
      start: { x: margin, y: yPos + 10 },
      end: { x: width - margin, y: yPos + 10 },
      thickness: 0.5,
      color: lightGray,
    });
    const footerText = estimate.status === 'accepted' 
      ? `This is a legally binding contract. Generated on ${formatDate(new Date().toISOString())}`
      : `This is a non-binding proposal prepared for your review and approval. Generated on ${formatDate(new Date().toISOString())}`;
    page.drawText(footerText, {
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