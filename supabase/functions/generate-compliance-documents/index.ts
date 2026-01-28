import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerateComplianceDocsRequest {
  estimateId: string;
  companyId: string;
}

interface ComplianceTemplate {
  id: string;
  name: string;
  template_file_url: string;
  template_file_name: string;
  requires_separate_signature: boolean;
}

interface FieldPosition {
  field_key: string;
  page_number: number;
  x_position: number;
  y_position: number;
  width: number;
  font_size: number;
  font_color: string;
  text_align: string;
}

interface PlaceholderData {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  project_name: string;
  project_address: string;
  estimate_total: string;
  deposit_amount: string;
  scope_description: string;
  salesperson_name: string;
  company_name: string;
  company_address: string;
  company_phone: string;
  company_license: string;
  current_date: string;
  expiration_date: string;
  line_items: string;
  payment_schedule: string;
  terms_and_conditions: string;
  notes: string;
}

const formatCurrency = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

const formatDate = (date: Date): string => {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

// Parse hex color to RGB values (0-1 range)
const parseHexColor = (hex: string): { r: number; g: number; b: number } => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return {
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255,
    };
  }
  return { r: 0, g: 0, b: 0 }; // Default to black
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { estimateId, companyId }: GenerateComplianceDocsRequest = await req.json();

    if (!estimateId || !companyId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing estimateId or companyId" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Generating compliance documents for estimate ${estimateId}`);

    // Get all active compliance templates for this company
    const { data: templates, error: templatesError } = await supabase
      .from("compliance_document_templates")
      .select("*")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("display_order");

    if (templatesError) {
      console.error("Error fetching templates:", templatesError);
      throw templatesError;
    }

    if (!templates || templates.length === 0) {
      console.log("No active compliance templates found");
      return new Response(
        JSON.stringify({ success: true, message: "No active compliance templates", documents: [] }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get estimate with full details - use explicit FK names to avoid ambiguity
    const { data: estimate, error: estimateError } = await supabase
      .from("estimates")
      .select(`
        *,
        contacts:contact_uuid!estimates_contact_uuid_fkey (
          contact_name,
          first_name,
          last_name,
          email,
          phone
        ),
        opportunities:opportunity_uuid!estimates_opportunity_uuid_fkey (
          name,
          monetary_value
        )
      `)
      .eq("id", estimateId)
      .single();

    if (estimateError || !estimate) {
      console.error("Error fetching estimate:", estimateError);
      throw new Error("Estimate not found");
    }

    // Get company settings
    const { data: companySettings } = await supabase
      .from("company_settings")
      .select("setting_key, setting_value")
      .eq("company_id", companyId);

    const settingsMap: Record<string, string> = {};
    (companySettings || []).forEach((s: { setting_key: string; setting_value: string | null }) => {
      if (s.setting_value) settingsMap[s.setting_key] = s.setting_value;
    });

    // Get line items
    const { data: lineItems } = await supabase
      .from("estimate_line_items")
      .select("*")
      .eq("estimate_id", estimateId)
      .order("display_order");

    // Get payment phases
    const { data: paymentPhases } = await supabase
      .from("estimate_payment_phases")
      .select("*")
      .eq("estimate_id", estimateId)
      .order("phase_order");

    // Get salesperson info if assigned
    let salespersonName = "";
    if (estimate.salesperson_id) {
      const { data: salesperson } = await supabase
        .from("salespeople")
        .select("first_name, last_name")
        .eq("id", estimate.salesperson_id)
        .single();
      
      if (salesperson) {
        salespersonName = [salesperson.first_name, salesperson.last_name].filter(Boolean).join(" ");
      }
    }

    // Build placeholder data
    const contact = estimate.contacts as any;
    const customerName = contact?.contact_name || 
      [contact?.first_name, contact?.last_name].filter(Boolean).join(" ") ||
      estimate.customer_name || "";

    const lineItemsText = (lineItems || [])
      .map((item: any) => `• ${item.title}: ${formatCurrency(item.total_price)}`)
      .join("\n");

    const paymentScheduleText = (paymentPhases || [])
      .map((phase: any) => `• ${phase.phase_name}: ${formatCurrency(phase.amount)} (${phase.percentage}%)`)
      .join("\n");

    const placeholderData: PlaceholderData = {
      customer_name: customerName,
      customer_email: contact?.email || estimate.customer_email || "",
      customer_phone: contact?.phone || "",
      project_name: estimate.project_name || "",
      project_address: estimate.job_address || "",
      estimate_total: formatCurrency(estimate.estimate_total),
      deposit_amount: formatCurrency(estimate.deposit_amount),
      scope_description: estimate.work_scope || "",
      salesperson_name: salespersonName,
      company_name: settingsMap.company_name || "",
      company_address: settingsMap.company_address || "",
      company_phone: settingsMap.company_phone || "",
      company_license: settingsMap.license_number || "",
      current_date: formatDate(new Date()),
      expiration_date: estimate.valid_until ? formatDate(new Date(estimate.valid_until)) : "",
      line_items: lineItemsText,
      payment_schedule: paymentScheduleText,
      terms_and_conditions: estimate.terms_and_conditions || settingsMap.default_terms_and_conditions || "",
      notes: estimate.notes || "",
    };

    // Process each template
    const generatedDocs: any[] = [];

    for (const template of templates as ComplianceTemplate[]) {
      try {
        console.log(`Processing template: ${template.name} (${template.id})`);

        // Check if already generated for this estimate
        const { data: existingDoc } = await supabase
          .from("estimate_compliance_documents")
          .select("*")
          .eq("estimate_id", estimateId)
          .eq("template_id", template.id)
          .maybeSingle();

        if (existingDoc && existingDoc.generated_file_url && existingDoc.generated_file_url !== template.template_file_url) {
          console.log(`Document already generated for template ${template.id}`);
          generatedDocs.push(existingDoc);
          continue;
        }

        // Get field positions for this template
        const { data: fieldPositions, error: fieldsError } = await supabase
          .from("compliance_template_fields")
          .select("*")
          .eq("template_id", template.id);

        if (fieldsError) {
          console.error(`Error fetching field positions for template ${template.id}:`, fieldsError);
        }

        let generatedFileUrl = template.template_file_url;

        // Only process PDF if there are field positions defined
        if (fieldPositions && fieldPositions.length > 0) {
          console.log(`Found ${fieldPositions.length} field positions for template ${template.id}`);

          try {
            // Fetch the original PDF
            const pdfResponse = await fetch(template.template_file_url);
            if (!pdfResponse.ok) {
              throw new Error(`Failed to fetch PDF: ${pdfResponse.status}`);
            }
            const pdfBytes = await pdfResponse.arrayBuffer();

            // Load the PDF document
            const pdfDoc = await PDFDocument.load(pdfBytes);
            const pages = pdfDoc.getPages();
            const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

            // Draw text at each field position
            for (const field of fieldPositions as FieldPosition[]) {
              const pageIndex = field.page_number - 1;
              if (pageIndex < 0 || pageIndex >= pages.length) {
                console.warn(`Invalid page number ${field.page_number} for field ${field.field_key}`);
                continue;
              }

              const page = pages[pageIndex];
              const { height } = page.getSize();

              // Get the value for this field
              const fieldValue = placeholderData[field.field_key as keyof PlaceholderData] || "";
              if (!fieldValue) continue;

              // Parse color
              const color = parseHexColor(field.font_color || "#000000");

              // Calculate Y position (PDF coordinates are from bottom-left)
              // We need to convert from top-left (as stored) to bottom-left
              // The stored y_position is from the top, scaled at 1.5x
              const scaleFactor = 1.5; // The editor uses 1.5x scale
              const actualY = height - (field.y_position / scaleFactor) - (field.font_size || 12);
              const actualX = field.x_position / scaleFactor;

              // Draw the text
              page.drawText(String(fieldValue), {
                x: actualX,
                y: actualY,
                size: field.font_size || 12,
                font: helveticaFont,
                color: rgb(color.r, color.g, color.b),
                maxWidth: (field.width || 200) / scaleFactor,
              });

              console.log(`Drew field ${field.field_key} at (${actualX}, ${actualY}) on page ${field.page_number}`);
            }

            // Save the modified PDF
            const modifiedPdfBytes = await pdfDoc.save();

            // Upload to storage
            // Store generated PDFs in the existing public bucket under a namespaced folder.
            const fileName = `compliance-templates/generated/${estimateId}/${template.id}-${Date.now()}.pdf`;
            const { error: uploadError } = await supabase.storage
              .from("project-attachments")
              .upload(fileName, modifiedPdfBytes, {
                contentType: "application/pdf",
                upsert: true,
              });

            if (uploadError) {
              console.error(`Error uploading generated PDF:`, uploadError);
              throw uploadError;
            }

            // Get the public URL
            const { data: urlData } = supabase.storage
              .from("project-attachments")
              .getPublicUrl(fileName);

            generatedFileUrl = urlData.publicUrl;
            console.log(`Generated PDF uploaded to: ${generatedFileUrl}`);
          } catch (pdfError) {
            console.error(`Error processing PDF for template ${template.id}:`, pdfError);
            // Fall back to using the original template URL
            generatedFileUrl = template.template_file_url;
          }
        } else {
          console.log(`No field positions defined for template ${template.id}, using original PDF`);
        }

        // Create or update the compliance document record
        const docData = {
          company_id: companyId,
          estimate_id: estimateId,
          template_id: template.id,
          generated_file_url: generatedFileUrl,
          status: "generated",
          generated_at: new Date().toISOString(),
        };

        const { data: upsertedDoc, error: upsertError } = await supabase
          .from("estimate_compliance_documents")
          .upsert(docData, { onConflict: "estimate_id,template_id" })
          .select()
          .single();

        if (upsertError) {
          console.error(`Error upserting compliance doc for template ${template.id}:`, upsertError);
          continue;
        }

        // If requires separate signature, create a signature document
        if (template.requires_separate_signature && !existingDoc?.signature_document_id) {
          const { data: sigDoc, error: sigError } = await supabase
            .from("signature_documents")
            .insert({
              company_id: companyId,
              document_name: template.name,
              document_type: "compliance",
              template_id: template.id,
              file_url: generatedFileUrl,
              file_name: template.template_file_name,
              status: "draft",
              recipient_name: customerName,
              recipient_email: contact?.email || estimate.customer_email,
              linked_estimate_id: estimateId,
            })
            .select()
            .single();

          if (sigError) {
            console.error(`Error creating signature document for template ${template.id}:`, sigError);
          } else if (sigDoc) {
            // Link signature document to compliance document
            await supabase
              .from("estimate_compliance_documents")
              .update({ signature_document_id: sigDoc.id })
              .eq("id", upsertedDoc.id);
          }
        }

        generatedDocs.push(upsertedDoc);
        console.log(`Generated compliance document for template ${template.name}`);
      } catch (err) {
        console.error(`Error processing template ${template.id}:`, err);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        documents: generatedDocs,
        placeholderData, // Include for debugging/preview
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error generating compliance documents:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
