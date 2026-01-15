import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Build scope of work HTML
    const groupsHtml = groups.map((group: any) => {
      const items = lineItems.filter((item: any) => item.group_id === group.id);
      const itemsHtml = items.map((item: any) => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.description}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity} ${item.unit || ''}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(item.unit_price)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(item.line_total)}</td>
        </tr>
      `).join('');
      
      return `
        <div style="margin-bottom: 20px;">
          <h4 style="background: #f5f5f5; padding: 10px; margin: 0 0 10px 0; border-radius: 4px;">${group.group_name}</h4>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #fafafa;">
                <th style="padding: 8px; text-align: left; border-bottom: 2px solid #ddd;">Description</th>
                <th style="padding: 8px; text-align: center; border-bottom: 2px solid #ddd;">Qty</th>
                <th style="padding: 8px; text-align: right; border-bottom: 2px solid #ddd;">Unit Price</th>
                <th style="padding: 8px; text-align: right; border-bottom: 2px solid #ddd;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
        </div>
      `;
    }).join('');

    // Payment schedule HTML
    const paymentHtml = paymentSchedule.length > 0 ? `
      <div style="margin-top: 30px;">
        <h3 style="border-bottom: 2px solid #333; padding-bottom: 5px;">Payment Schedule</h3>
        <table style="width: 100%; border-collapse: collapse;">
          ${paymentSchedule.map((phase: any) => `
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #eee;">${phase.phase_name}</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${phase.percent}%</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency((estimate.total * phase.percent) / 100)}</td>
            </tr>
          `).join('')}
        </table>
      </div>
    ` : '';

    // Signature HTML
    const signatureHtml = signature ? `
      <div style="margin-top: 40px; padding: 20px; border: 2px solid #22c55e; border-radius: 8px; background: #f0fdf4;">
        <h4 style="color: #16a34a; margin: 0 0 15px 0;">✓ Customer Signature</h4>
        ${signature.signature_type === 'drawn' 
          ? `<img src="${signature.signature_data}" alt="Customer signature" style="max-height: 80px; margin: 10px 0;" />`
          : `<div style="font-family: ${signature.signature_font || 'cursive'}; font-size: 32px; margin: 10px 0;">${signature.signature_data}</div>`
        }
        <div style="font-size: 12px; color: #666; margin-top: 10px;">
          <div>Signed by: ${signature.signer_name}</div>
          ${signature.signer_email ? `<div>Email: ${signature.signer_email}</div>` : ''}
          <div>Date: ${formatDate(signature.signed_at)}</div>
        </div>
      </div>
    ` : '';

    // Build complete HTML
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Contract CNT-${estimate.estimate_number}</title>
          <style>
            body {
              font-family: 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.5;
              color: #333;
              max-width: 800px;
              margin: 0 auto;
              padding: 40px;
            }
            .header {
              text-align: center;
              margin-bottom: 40px;
              padding-bottom: 20px;
              border-bottom: 3px solid #1a1a2e;
            }
            .header h1 { font-size: 28px; color: #1a1a2e; margin: 0 0 5px 0; }
            .header .subtitle { font-size: 14px; color: #666; }
            .info-grid { display: flex; justify-content: space-between; margin-bottom: 30px; }
            .info-box { width: 48%; }
            .info-box h3 { font-size: 14px; color: #666; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 10px 0; border-bottom: 1px solid #eee; padding-bottom: 5px; }
            .info-box p { margin: 5px 0; font-size: 14px; }
            .totals { margin-top: 20px; padding: 20px; background: #f9f9f9; border-radius: 8px; }
            .total-row { display: flex; justify-content: space-between; padding: 5px 0; }
            .total-row.grand-total { font-size: 18px; font-weight: bold; border-top: 2px solid #1a1a2e; margin-top: 10px; padding-top: 15px; }
            .terms { margin-top: 30px; padding: 20px; background: #f9f9f9; border-radius: 8px; font-size: 12px; color: #666; }
            .terms h4 { color: #333; margin: 0 0 10px 0; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${companyName}</h1>
            ${companyAddress ? `<p class="subtitle">${companyAddress}</p>` : ''}
            ${companyPhone ? `<p class="subtitle">${companyPhone}</p>` : ''}
            <p class="subtitle" style="margin-top: 10px; font-weight: bold;">Contract #CNT-${estimate.estimate_number}</p>
          </div>

          <div class="info-grid">
            <div class="info-box">
              <h3>Customer Information</h3>
              <p><strong>${estimate.customer_name}</strong></p>
              ${estimate.customer_email ? `<p>${estimate.customer_email}</p>` : ''}
              ${estimate.customer_phone ? `<p>${estimate.customer_phone}</p>` : ''}
              ${estimate.billing_address ? `<p>${estimate.billing_address}</p>` : ''}
            </div>
            <div class="info-box">
              <h3>Project Details</h3>
              <p><strong>${estimate.estimate_title}</strong></p>
              ${estimate.job_address ? `<p>${estimate.job_address}</p>` : ''}
              <p>Date: ${formatDate(estimate.estimate_date)}</p>
              ${estimate.signed_at ? `<p style="color: #16a34a;">Signed: ${formatDate(estimate.signed_at)}</p>` : ''}
            </div>
          </div>

          <div>
            <h3 style="border-bottom: 2px solid #333; padding-bottom: 5px;">Scope of Work</h3>
            ${estimate.work_scope_description ? `<p style="margin-bottom: 20px; font-style: italic;">${estimate.work_scope_description}</p>` : ''}
            ${groupsHtml}
          </div>

          <div class="totals">
            <div class="total-row">
              <span>Subtotal</span>
              <span>${formatCurrency(estimate.subtotal)}</span>
            </div>
            ${(estimate.tax_amount || 0) > 0 ? `
              <div class="total-row">
                <span>Tax (${estimate.tax_rate}%)</span>
                <span>${formatCurrency(estimate.tax_amount)}</span>
              </div>
            ` : ''}
            ${(estimate.discount_amount || 0) > 0 ? `
              <div class="total-row">
                <span>Discount</span>
                <span>-${formatCurrency(estimate.discount_amount)}</span>
              </div>
            ` : ''}
            <div class="total-row grand-total">
              <span>Total Contract Amount</span>
              <span>${formatCurrency(estimate.total)}</span>
            </div>
          </div>

          ${paymentHtml}

          ${estimate.terms_and_conditions ? `
            <div class="terms">
              <h4>Terms and Conditions</h4>
              <div style="white-space: pre-wrap;">${estimate.terms_and_conditions}</div>
            </div>
          ` : ''}

          ${signatureHtml}

          ${estimate.notes ? `
            <div style="margin-top: 30px;">
              <h3 style="border-bottom: 2px solid #333; padding-bottom: 5px;">Notes</h3>
              <p style="white-space: pre-wrap;">${estimate.notes}</p>
            </div>
          ` : ''}

          <div style="margin-top: 50px; text-align: center; font-size: 11px; color: #999; border-top: 1px solid #eee; padding-top: 20px;">
            <p>This is a legally binding contract. Generated on ${formatDate(new Date().toISOString())}</p>
          </div>
        </body>
      </html>
    `;

    // Convert HTML to PDF using external service or simple approach
    // For now, we'll store the HTML as a file and let the browser render it
    // In production, you'd use a PDF service like html-pdf-node, Puppeteer, or PDFShift
    
    const fileName = `CNT-${estimate.estimate_number}-${Date.now()}.html`;
    const filePath = `${projectId || 'general'}/${fileName}`;
    
    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('contracts')
      .upload(filePath, html, {
        contentType: 'text/html',
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

    console.log('Contract uploaded successfully:', publicUrl);

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
        
        console.log('Updated existing agreement with attachment');
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
        
        console.log('Created new agreement with attachment');
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