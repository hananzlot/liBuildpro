import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Extract ZIP code from address string
function extractZipCode(address: string): string | null {
  const zipMatch = address.match(/\b(\d{5})(?:-\d{4})?\b/);
  return zipMatch ? zipMatch[1] : null;
}

// Get region from ZIP code for pricing adjustments
function getRegionFromZip(zipCode: string): { region: string; costMultiplier: number; description: string } {
  const zip = parseInt(zipCode);
  
  // California ZIP code ranges with cost adjustments
  if (zip >= 90001 && zip <= 91899) {
    return { region: "Los Angeles Metro", costMultiplier: 1.15, description: "Higher labor and material costs due to urban metro area" };
  } else if (zip >= 94000 && zip <= 94699) {
    return { region: "San Francisco Bay Area", costMultiplier: 1.25, description: "Premium market with highest labor rates in California" };
  } else if (zip >= 92000 && zip <= 92899) {
    return { region: "San Diego County", costMultiplier: 1.10, description: "Coastal California pricing" };
  } else if (zip >= 95000 && zip <= 95999) {
    return { region: "Central Valley / Sacramento", costMultiplier: 1.0, description: "Standard California pricing" };
  } else if (zip >= 93000 && zip <= 93999) {
    return { region: "Central Coast / Bakersfield", costMultiplier: 0.95, description: "Slightly below metro pricing" };
  } else if (zip >= 96000 && zip <= 96199) {
    return { region: "Northern California / Rural", costMultiplier: 1.05, description: "Rural area with travel considerations" };
  }
  
  // Default California pricing
  return { region: "California", costMultiplier: 1.0, description: "Standard California market rates" };
}

// Convert buffer to base64 in chunks to avoid memory issues with large files
function bufferToBase64Chunked(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192; // Process 8KB at a time
  let result = '';
  
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    result += String.fromCharCode.apply(null, Array.from(chunk));
  }
  
  return btoa(result);
}

// Convert PDF buffer to base64 data URL for Gemini (which supports native PDF)
function pdfToBase64DataUrl(pdfBuffer: ArrayBuffer): string {
  const base64 = bufferToBase64Chunked(pdfBuffer);
  return `data:application/pdf;base64,${base64}`;
}

// Retry fetch with exponential backoff for transient errors
async function fetchWithRetry(
  url: string, 
  options: RequestInit, 
  maxRetries = 3
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // Retry on transient errors (503, 502, 429)
      if (response.status === 503 || response.status === 502 || response.status === 429) {
        const waitTime = Math.pow(2, attempt) * 2000; // 2s, 4s, 8s
        console.log(`API returned ${response.status}, retrying in ${waitTime}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, waitTime));
        continue;
      }
      
      return response;
    } catch (error) {
      lastError = error as Error;
      // Check if it's an abort error - don't retry those
      if ((error as Error).name === 'AbortError') {
        throw error;
      }
      const waitTime = Math.pow(2, attempt) * 2000;
      console.log(`Network error, retrying in ${waitTime}ms (attempt ${attempt + 1}/${maxRetries}): ${(error as Error).message}`);
      await new Promise(r => setTimeout(r, waitTime));
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectType, projectDescription, workScopeDescription, jobAddress, existingGroups, defaultMarkupPercent, companyId, plansFileUrl } = await req.json();

    console.log('Generating estimate scope for:', { projectType, workScopeDescription, jobAddress, defaultMarkupPercent, companyId, hasPlans: !!plansFileUrl });

    // Fetch AI settings from company_settings
    let aiTemperature = 0.3;
    let customInstructions = '';
    let openaiApiKey = '';
    let aiModel = '';
    let aiProvider = 'gemini'; // Default to Gemini
    
    if (companyId) {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      // Fetch company settings including OpenAI API key and provider preference
      const { data: settings } = await supabase
        .from('company_settings')
        .select('setting_key, setting_value')
        .eq('company_id', companyId)
        .in('setting_key', ['ai_estimate_variability', 'ai_estimate_instructions', 'openai_api_key', 'ai_estimate_model', 'ai_estimate_provider']);
      
      if (settings) {
        const variabilitySetting = settings.find((s: any) => s.setting_key === 'ai_estimate_variability');
        const instructionsSetting = settings.find((s: any) => s.setting_key === 'ai_estimate_instructions');
        const openaiKeySetting = settings.find((s: any) => s.setting_key === 'openai_api_key');
        const modelSetting = settings.find((s: any) => s.setting_key === 'ai_estimate_model');
        const providerSetting = settings.find((s: any) => s.setting_key === 'ai_estimate_provider');
        
        if (variabilitySetting?.setting_value) {
          const parsed = parseFloat(variabilitySetting.setting_value);
          if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
            aiTemperature = parsed;
          }
        }
        
        if (instructionsSetting?.setting_value) {
          customInstructions = instructionsSetting.setting_value;
        }
        
        if (openaiKeySetting?.setting_value) {
          openaiApiKey = openaiKeySetting.setting_value;
        }
        
        if (modelSetting?.setting_value) {
          aiModel = modelSetting.setting_value;
        }
        
        if (providerSetting?.setting_value) {
          aiProvider = providerSetting.setting_value;
        }
      }
      
      // If no company-specific OpenAI key, check app_settings for platform default
      if (!openaiApiKey) {
        const { data: appSettings } = await supabase
          .from('app_settings')
          .select('setting_value')
          .eq('setting_key', 'openai_api_key')
          .maybeSingle();
        
        if (appSettings?.setting_value) {
          openaiApiKey = appSettings.setting_value;
        }
      }
      
      console.log('Using AI temperature:', aiTemperature);
      console.log('Has custom instructions:', !!customInstructions);
      console.log('Has OpenAI API key:', !!openaiApiKey);
      console.log('AI model preference:', aiModel || 'default');
      console.log('AI provider preference:', aiProvider);
    }

    // Determine which API to use based on provider setting
    // Use OpenAI only if: provider is set to "openai" AND we have an API key
    const useOpenAI = aiProvider === 'openai' && !!openaiApiKey;
    
    // Fall back to Lovable API if no OpenAI key
    if (!useOpenAI) {
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      if (!LOVABLE_API_KEY) {
        throw new Error('No AI API key configured. Please add your OpenAI API key in company settings.');
      }
    }

    // Parse uploaded plans file if provided
    // parsedPlansContent can be:
    // - { type: 'pdf_base64', value: string } for PDFs (Gemini can read these natively)
    // - { type: 'image_url', value: string } for base64 images
    // - { type: 'text', value: string } for fallback text descriptions
    // - null if no plans file
    let parsedPlansContent: { type: 'pdf_base64' | 'image_url' | 'text'; value: string } | null = null;
    let forceLovableAI = false; // Flag to force Lovable AI for PDF support
    
    // Max PDF size for Gemini API (20MB raw = ~27MB base64)
    const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024; // 20MB limit
    let pdfTooLarge = false;
    
    if (plansFileUrl) {
      console.log('Fetching and parsing plans file...');
      console.log('Original URL:', plansFileUrl);
      try {
        // Convert Google Drive view links to direct download links
        let downloadUrl = plansFileUrl;
        let isGoogleDrive = false;
        const googleDriveViewMatch = plansFileUrl.match(/drive\.google\.com\/file\/d\/([^\/]+)/);
        if (googleDriveViewMatch) {
          const fileId = googleDriveViewMatch[1];
          // Use the confirm=t parameter to bypass the virus scan confirmation page
          downloadUrl = `https://drive.google.com/uc?export=download&confirm=t&id=${fileId}`;
          isGoogleDrive = true;
          console.log('Converted Google Drive link to direct download URL with confirm bypass');
        }
        
        // Fetch the file content
        const plansResponse = await fetch(downloadUrl, {
          headers: {
            // Some servers require a User-Agent
            'User-Agent': 'Mozilla/5.0 (compatible; EstimateBot/1.0)',
          },
        });
        
        console.log('Plans fetch response status:', plansResponse.status);
        const contentType = plansResponse.headers.get('content-type') || '';
        console.log('Plans fetch content-type:', contentType);
        
        if (plansResponse.ok) {
          // Check if Google Drive returned an HTML confirmation page instead of the file
          if (isGoogleDrive && contentType.includes('text/html')) {
            console.warn('Google Drive returned HTML instead of file - file may be too large or require sign-in');
            console.warn('Please ensure the file is shared publicly with "Anyone with the link"');
            // Don't fail - continue without plans
          } else if (contentType.includes('application/pdf') || (isGoogleDrive && contentType.includes('octet-stream'))) {
            // PDFs: Convert to base64 and use Gemini (Lovable AI) which supports native PDF
            console.log('PDF plans file detected - converting to base64 for Gemini...');
            const pdfBuffer = await plansResponse.arrayBuffer();
            console.log('PDF buffer size:', pdfBuffer.byteLength, 'bytes');
            
            // Check file size before processing
            if (pdfBuffer.byteLength > MAX_PDF_SIZE_BYTES) {
              console.warn(`PDF too large for AI processing: ${(pdfBuffer.byteLength / (1024 * 1024)).toFixed(1)}MB (max ${MAX_PDF_SIZE_BYTES / (1024 * 1024)}MB)`);
              pdfTooLarge = true;
              // Continue without PDF - will generate estimate from description only
            } else {
              const base64Pdf = pdfToBase64DataUrl(pdfBuffer);
              parsedPlansContent = { type: 'pdf_base64', value: base64Pdf };
              forceLovableAI = true; // Force Lovable AI since OpenAI doesn't support PDF in Chat Completions
              console.log(`PDF converted to base64, size: ${base64Pdf.length} chars`);
            }
          } else if (contentType.includes('image/')) {
            // For images, convert to base64 for vision model using chunked encoding
            const imageBuffer = await plansResponse.arrayBuffer();
            const base64Image = bufferToBase64Chunked(imageBuffer);
            const mimeType = contentType.split(';')[0];
            parsedPlansContent = { type: 'image_url', value: `data:${mimeType};base64,${base64Image}` };
            console.log('Image plans file detected - will send to vision model');
          } else {
            console.warn('Unknown content type for plans file:', contentType);
          }
        } else {
          console.warn('Failed to fetch plans file:', plansResponse.status);
        }
      } catch (plansError) {
        console.error('Error parsing plans file:', plansError);
        // Continue without plans - don't fail the entire request
      }
    }

    // Extract ZIP code and get regional pricing info
    const zipCode = extractZipCode(jobAddress || '');
    const regionInfo = zipCode ? getRegionFromZip(zipCode) : { region: "California", costMultiplier: 1.0, description: "Standard rates" };

    // Build system prompt - enhanced for PDF analysis
    let systemPrompt: string;
    
    const hasPdfAttachment = parsedPlansContent?.type === 'pdf_base64';
    const hasImageAttachment = parsedPlansContent?.type === 'image_url';
    
    if (customInstructions) {
      // Use custom instructions but enhance for PDF if attached
      if (hasPdfAttachment) {
        systemPrompt = `${customInstructions}

CRITICAL PDF ANALYSIS REQUIREMENTS:
- You MUST extract actual data from the attached construction plans PDF
- Never generate generic estimates when plans are provided
- If you cannot read a detail, explicitly state "Unable to determine from plans"
- Quote specific page numbers when referencing plan details
- All quantities and dimensions MUST come from the PDF, not assumptions`;
      } else {
        systemPrompt = customInstructions;
      }
    } else {
      // Default system prompt
      if (hasPdfAttachment) {
        systemPrompt = `You are an expert construction estimator with exceptional plan-reading skills.

CRITICAL: Construction plans PDF is attached. You MUST:
1. READ and ANALYZE every page of the attached PDF thoroughly
2. EXTRACT actual room names, dimensions, and square footages from floor plans
3. IDENTIFY specific materials, finishes, and specifications from schedules
4. NOTE structural details (foundation type, framing specs, roofing materials)
5. FIND MEP specifications (plumbing fixtures, electrical, HVAC requirements)

STRICT RULES:
- All quantities MUST come from the PDF measurements, not generic assumptions
- If you cannot read a specific detail, say "Unable to determine from plans"
- Reference specific sheets/pages when possible (e.g., "per Sheet A-1")
- NEVER generate a generic cookie-cutter estimate when PDF plans are provided

Return COST values (what the contractor pays), not selling prices. Markup will be applied separately.`;
      } else {
        systemPrompt = `You are an expert construction estimator for a home improvement contractor in California. 
Create detailed, accurate estimates for residential construction projects.

Return COST values (what the contractor pays), not selling prices. Markup will be applied separately.
Use realistic California market rates for labor and materials (2024-2025 pricing).
Include all necessary line items: demolition, materials, labor, permits, cleanup.
Group items logically by work area.

Always return valid JSON matching the exact schema requested.`;
      }
    }

    // Build the base user prompt
    const baseUserPrompt = `Generate a HIGHLY DETAILED estimate scope for the following project.

CRITICAL: Create maximum granularity - break every task into its smallest components. Aim for 50+ line items.

Project Type: ${projectType || 'Home Improvement'}
Job Location: ${jobAddress || 'California'}
${zipCode ? `ZIP Code: ${zipCode} (${regionInfo.region} - apply ${regionInfo.costMultiplier}x cost multiplier)` : ''}
Default Markup: ${defaultMarkupPercent || 35}%

DETAILED WORK SCOPE FROM CUSTOMER:
${workScopeDescription || projectDescription || 'General home improvement project'}
${parsedPlansContent?.type === 'text' ? parsedPlansContent.value : ''}

${existingGroups?.length > 0 ? `\nExisting scope areas (already added): ${existingGroups.join(', ')}` : ''}

**CRITICAL - COST FIELD RULES (READ CAREFULLY):**
- "labor_cost" = RATE PER UNIT (e.g., $50/hour, NOT $500 for 10 hours)
- "material_cost" = PRICE PER UNIT (e.g., $8/sqft, NOT $800 for 100 sqft)
- NEVER multiply costs by quantity - return the UNIT RATE only
- The system will calculate totals by multiplying quantity × unit cost

CORRECT EXAMPLES:
- 2000 board feet of lumber at $2/bf → quantity: 2000, unit: "bf", material_cost: 2
- 10 hours of framing labor at $65/hr → quantity: 10, unit: "hours", labor_cost: 65
- 500 sqft drywall install at $1.50/sqft labor → quantity: 500, unit: "sqft", labor_cost: 1.5

WRONG EXAMPLES (DO NOT DO THIS):
- material_cost: 4000 for 2000 board feet (this is the total, not per-unit!)
- labor_cost: 650 for 10 hours of work (this is the total, not per-unit!)

Return a JSON object with this EXACT structure (labor_cost and material_cost are REQUIRED and separate):
{
  "project_understanding": ["bullet 1", "bullet 2"],
  "assumptions": ["assumption 1", "assumption 2"],
  "inclusions": ["included item 1", "included item 2"],
  "exclusions": ["excluded item 1", "excluded item 2"],
  "missing_info": ["question 1", "question 2"],
  ${hasPdfAttachment || hasImageAttachment ? `"pdf_extracted_data": {
    "rooms_identified": ["Room Name - WxL dimensions"],
    "total_sqft_from_plans": number,
    "specifications_found": ["specific material/finish from plans"],
    "unable_to_determine": ["items that could not be read from plans"]
  },` : ''}
  "groups": [
    {
      "group_name": "Phase - Trade (e.g., Demolition - Haul-off, Interior - Drywall)",
      "description": "Brief description of work in this area",
      "items": [
        {
          "item_type": "labor|material|equipment|permit|assembly",
          "description": "SPECIFIC item description (e.g., 'Drywall - 1/2 inch sheets' not just 'Drywall')",
          "quantity": number,
          "unit": "hours|sqft|linear ft|each|set|LS",
          "labor_cost": number (PER UNIT labor cost, 0 if material-only),
          "material_cost": number (PER UNIT material cost, 0 if labor-only),
          "markup_percent": number,
          "is_taxable": boolean,
          "notes": "what this covers, allowance details if applicable"
        }
      ]
    }
  ],
  "payment_schedule": [
    {
      "phase_name": "Phase name based on project work",
      "percent": number,
      "due_type": "on_approval|milestone|date",
      "description": "When this payment is due"
    }
  ],
  "suggested_deposit_percent": number,
  "suggested_tax_rate": 9.5,
  "notes": "Any important notes",
  "first_payment_name": "Name for initial payment (not 'Deposit')"
}

GRANULARITY RULES:
- Break each trade into 5-15 separate line items minimum
- Example: "Flooring" becomes: "Flooring - Remove existing", "Flooring - Subfloor prep", "Flooring - Underlayment material", "Flooring - Underlayment install labor", "Flooring - Hardwood material", "Flooring - Hardwood install labor", "Flooring - Transition strips", "Flooring - Baseboards remove/replace"
- Every line MUST have both labor_cost and material_cost fields (use 0 if not applicable)
- Include often-forgotten items: mobilization, protection, dust control, daily cleanup, dumpsters, permits, inspections, final cleaning, punch list`;

    // Build final user prompt - prioritize PDF analysis if attached
    let userPrompt: string;
    
    if (hasPdfAttachment) {
      userPrompt = `**CRITICAL: YOU MUST ANALYZE THE ATTACHED PDF CONSTRUCTION PLANS FIRST**

I have attached construction plans as a PDF file. Before generating ANY estimate values, you MUST:

1. **READ EVERY PAGE** of the attached PDF thoroughly
2. **EXTRACT ALL ROOM NAMES** with their exact dimensions (e.g., "Master Bedroom - 14'-6" x 12'-0"")
3. **CALCULATE TOTAL SQUARE FOOTAGE** from the floor plan dimensions
4. **IDENTIFY ALL SPECIFICATIONS** including:
   - Roofing material and area from elevation drawings
   - Foundation type from structural drawings  
   - Door and window schedules
   - Finish schedules (flooring, paint, fixtures)
   - Electrical panel size and circuit requirements
   - Plumbing fixture counts and specifications
   - HVAC tonnage and ductwork requirements

**DO NOT GENERATE A GENERIC ESTIMATE.** Every quantity and specification MUST come from what you actually read in the PDF.

---

${baseUserPrompt}

---

**MANDATORY PDF EXTRACTION CHECKLIST** (you must address ALL of these):
- [ ] List EVERY room from the floor plan with its WIDTH x LENGTH dimensions
- [ ] Calculate and state the total conditioned square footage
- [ ] Identify the roofing material type and calculate roof area
- [ ] Note the foundation type (slab, crawl, basement)
- [ ] Count all doors and windows from schedules or plans
- [ ] List specific finishes mentioned in the plans
- [ ] Note any structural specifications (beam sizes, framing details)

If you CANNOT read something from the PDF, you MUST explicitly state it in "unable_to_determine" array. 
DO NOT make up values - use the actual data from the attached plans.`;
    } else if (hasImageAttachment) {
      userPrompt = `**ANALYZE THE ATTACHED CONSTRUCTION PLANS IMAGE CAREFULLY**

I have attached construction plans as an image. Extract all visible dimensions, room layouts, and specifications before generating the estimate.

${baseUserPrompt}`;
    } else {
      userPrompt = baseUserPrompt;
    }

    // Build messages array based on content type
    const messages: any[] = [
      { role: 'system', content: systemPrompt },
    ];

    // Build user message content based on what we have
    // For PDFs, we use Gemini via Lovable AI which supports native PDF input
    if (parsedPlansContent?.type === 'pdf_base64') {
      // PDF attachment for Gemini - use inline_data format
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: userPrompt },
          { 
            type: 'image_url', 
            image_url: { url: parsedPlansContent.value }
          }
        ]
      });
      console.log('Using Gemini with PDF attachment');
    } else if (parsedPlansContent?.type === 'image_url') {
      // Vision model message with image - this works on both OpenAI and Gemini
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: userPrompt },
          { 
            type: 'image_url', 
            image_url: { url: parsedPlansContent.value }
          }
        ]
      });
      console.log('Using vision model with image attachment');
    } else {
      // Text-only message
      messages.push({ role: 'user', content: userPrompt });
      console.log('Using text-only prompt');
    }

    let response!: Response;
    let apiProvider: string;
    
    // All requests go through Lovable AI Gateway
    // - Gemini models for PDFs (native PDF support)
    // - OpenAI GPT-5.2 when user selects OpenAI provider (via gateway)
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('No AI API key configured. Please contact support.');
    }
    
    // Determine which model to use
    // NOTE: OpenAI models reject PDFs when sent as `image_url` content ("Invalid MIME type").
    // Until we support a proper "file" payload, PDFs must be handled by Gemini.
    let modelToUse: string;
    
    if (hasPdfAttachment) {
      // PDFs: Gemini only (OpenAI rejects PDF MIME type when passed as image_url)
      modelToUse = 'google/gemini-2.5-pro';
      apiProvider = 'Gemini (PDF)';
    } else if (useOpenAI) {
      // Text/images: GPT-5.2 via Lovable AI Gateway
      modelToUse = 'openai/gpt-5.2';
      apiProvider = 'OpenAI (GPT-5.2)';
    } else if (hasImageAttachment) {
      // For Gemini with attachments, use Pro model for better vision capabilities
      modelToUse = 'google/gemini-2.5-pro';
      apiProvider = 'Gemini (Pro)';
    } else {
      // Default: Gemini Flash for text-only (faster)
      modelToUse = 'google/gemini-3-flash-preview';
      apiProvider = 'Gemini (Flash)';
    }
    
    console.log(`Using Lovable AI Gateway with model: ${modelToUse} (provider: ${apiProvider})`);

    // Add timeout protection - OpenAI models need more time for complex reasoning
    const isOpenAIModel = modelToUse.startsWith('openai/');
    const timeoutMs = isOpenAIModel ? 150000 : 90000; // 150s for OpenAI, 90s for Gemini
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // Build request body - OpenAI models use max_completion_tokens, Gemini uses max_tokens
      const requestBody: Record<string, unknown> = {
        model: modelToUse,
        messages,
        temperature: aiTemperature,
        response_format: { type: "json_object" },
      };
      
      // Use correct token parameter based on model
      if (isOpenAIModel) {
        requestBody.max_completion_tokens = 12000;
      } else {
        requestBody.max_tokens = 12000;
      }
      
      response = await fetchWithRetry('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (error) {
      clearTimeout(timeoutId);
      if ((error as Error).name === 'AbortError') {
        throw new Error('AI processing timed out. Try with a smaller file or simpler work scope description.');
      }
      throw error;
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`${apiProvider} API error:`, response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'AI service rate limited. Please wait a moment and try again.' 
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 503 || response.status === 502) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'AI service temporarily unavailable. Please try again in a few moments.' 
        }), {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402 || response.status === 401) {
        const errorMessage = useOpenAI 
          ? "OpenAI API key is invalid or has insufficient credits. Please check your API key in company settings."
          : "AI credits exhausted. Please add credits to continue using AI features.";
        return new Response(JSON.stringify({ 
          success: false, 
          error: errorMessage
        }), {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`${apiProvider} API error: ${response.status}`);
    }

    const data = await response.json();
    const generatedContent = data.choices[0].message.content;

    if (!generatedContent) {
      throw new Error('AI returned an empty response. Please try again.');
    }

    // IMPORTANT: do not log the full AI output (can be extremely large and slow to flush)
    console.log(`AI response received from ${apiProvider} (${generatedContent.length} chars)`);

    let parsedScope;
    try {
      // Try to extract JSON from the response (handle markdown code blocks)
      let jsonStr = generatedContent;
      
      // Check for markdown code blocks - use a more robust regex
      const jsonMatch = generatedContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      } else {
        // Try to find JSON object directly (starts with { and ends with })
        const directJsonMatch = generatedContent.match(/\{[\s\S]*\}/);
        if (directJsonMatch) {
          jsonStr = directJsonMatch[0];
        }
      }
      
      // Check if the JSON appears to be truncated
      const openBraces = (jsonStr.match(/\{/g) || []).length;
      const closeBraces = (jsonStr.match(/\}/g) || []).length;
      if (openBraces > closeBraces) {
        console.error('JSON appears truncated - unbalanced braces:', { openBraces, closeBraces });
        console.error('Response length:', generatedContent.length);
        throw new Error('AI response was truncated - estimate is too complex. Try simplifying the work scope description.');
      }
      
      parsedScope = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.error('Raw response (first 500 chars):', generatedContent.substring(0, 500));
      console.error('Raw response (last 500 chars):', generatedContent.substring(generatedContent.length - 500));
      
      if (parseError instanceof Error && parseError.message.includes('truncated')) {
        throw parseError;
      }
      throw new Error('Failed to parse AI response as JSON. The AI may have returned an incomplete response.');
    }

    // Add region info to the response
    parsedScope.regionInfo = {
      region: regionInfo.region,
      zipCode: zipCode,
      costMultiplier: regionInfo.costMultiplier,
    };

    // Add info about which API was used
    parsedScope.apiProvider = apiProvider;
    
    // Add warning if PDF was too large to process
    if (pdfTooLarge) {
      parsedScope.warning = 'The uploaded PDF was too large to analyze (max 20MB). The estimate was generated from the work description only. For better results, please upload a smaller PDF or compress the file.';
      // If the model included PDF-extracted fields anyway, strip them to keep payload smaller.
      if (parsedScope.pdf_extracted_data) {
        delete parsedScope.pdf_extracted_data;
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      scope: parsedScope,
      warning: pdfTooLarge ? 'PDF too large - estimate generated from description only' : undefined
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-estimate-scope:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
