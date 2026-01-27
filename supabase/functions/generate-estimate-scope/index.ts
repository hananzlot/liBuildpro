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

// Upload a file to OpenAI's Files API and return the file_id
async function uploadFileToOpenAI(
  fileBuffer: ArrayBuffer, 
  filename: string,
  apiKey: string
): Promise<string> {
  console.log(`Uploading file to OpenAI: ${filename} (${fileBuffer.byteLength} bytes)`);
  
  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: 'application/pdf' });
  formData.append('file', blob, filename);
  formData.append('purpose', 'user_data');
  
  const response = await fetchWithRetry('https://api.openai.com/v1/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData,
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI file upload failed:', response.status, errorText);
    throw new Error(`Failed to upload file to OpenAI: ${response.status}`);
  }
  
  const result = await response.json();
  console.log('OpenAI file upload successful, file_id:', result.id);
  return result.id;
}

// Call OpenAI Responses API with file input
async function callOpenAIResponsesAPI(
  systemPrompt: string,
  userPrompt: string,
  fileId: string | null,
  apiKey: string,
  temperature: number
): Promise<{ content: string; model: string }> {
  console.log('Calling OpenAI Responses API with gpt-5.2...');
  
  // Build the input array for Responses API
  const userContent: any[] = [
    { type: 'input_text', text: userPrompt }
  ];
  
  // Add file input if we have one
  if (fileId) {
    userContent.push({ type: 'input_file', file_id: fileId });
    console.log('Including file_id in request:', fileId);
  }
  
  const requestBody = {
    model: 'gpt-5.2',
    input: [
      {
        role: 'system',
        content: [{ type: 'input_text', text: systemPrompt }]
      },
      {
        role: 'user',
        content: userContent
      }
    ],
    temperature,
    text: {
      format: {
        type: 'json_object'
      }
    }
  };
  
  // Timeout: 180 seconds for complex PDF analysis
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 180000);
  
  try {
    const response = await fetchWithRetry('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI Responses API error:', response.status, errorText);
      
      if (response.status === 429) {
        throw new Error('OpenAI rate limited. Please wait and try again.');
      }
      if (response.status === 401 || response.status === 403) {
        throw new Error('OpenAI API key is invalid or does not have access to gpt-5.2.');
      }
      if (response.status === 402) {
        throw new Error('OpenAI account has insufficient credits.');
      }
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Responses API returns output_text directly
    const outputText = data.output_text || data.output?.[0]?.content?.[0]?.text;
    
    if (!outputText) {
      console.error('No output_text in OpenAI response:', JSON.stringify(data).substring(0, 1000));
      throw new Error('OpenAI returned empty response');
    }
    
    return { content: outputText, model: 'gpt-5.2' };
  } catch (error) {
    clearTimeout(timeoutId);
    if ((error as Error).name === 'AbortError') {
      throw new Error('OpenAI request timed out. The PDF may be too large or complex.');
    }
    throw error;
  }
}

// Call Lovable AI Gateway (Gemini) for fallback or when OpenAI not configured
async function callLovableAIGateway(
  messages: any[],
  modelToUse: string,
  temperature: number,
  lovableApiKey: string
): Promise<{ content: string; model: string }> {
  console.log(`Calling Lovable AI Gateway with model: ${modelToUse}`);
  
  const isOpenAIModel = modelToUse.startsWith('openai/');
  const timeoutMs = isOpenAIModel ? 150000 : 90000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const requestBody: Record<string, unknown> = {
      model: modelToUse,
      messages,
      response_format: { type: "json_object" },
    };
    
    // gpt-5-mini and gpt-5-nano don't support custom temperature (only default 1)
    // Only include temperature for models that support it
    const modelsWithoutTemperatureSupport = ['openai/gpt-5-mini', 'openai/gpt-5-nano'];
    if (!modelsWithoutTemperatureSupport.includes(modelToUse)) {
      requestBody.temperature = temperature;
    }
    
    // Increase output budget to reduce truncated JSON responses on large/complex PDFs.
    // Note: upstream providers may still enforce a hard cap per model.
    const VERY_LARGE_OUTPUT_TOKENS = 32000;
    if (isOpenAIModel) {
      requestBody.max_completion_tokens = VERY_LARGE_OUTPUT_TOKENS;
    } else {
      requestBody.max_tokens = VERY_LARGE_OUTPUT_TOKENS;
    }
    
    const response = await fetchWithRetry('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        throw new Error('AI service rate limited. Please wait a moment and try again.');
      }
      if (response.status === 503 || response.status === 502) {
        throw new Error('AI service temporarily unavailable. Please try again in a few moments.');
      }
      if (response.status === 402 || response.status === 401) {
        throw new Error('AI credits exhausted. Please add credits to continue using AI features.');
      }
      throw new Error(`AI Gateway error: ${response.status}`);
    }
    
    const responseText = await response.text();
    if (!responseText || responseText.trim() === '') {
      throw new Error('AI returned an empty response.');
    }
    
    const data = JSON.parse(responseText);
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('AI returned an empty response.');
    }
    
    return { content, model: modelToUse };
  } catch (error) {
    clearTimeout(timeoutId);
    if ((error as Error).name === 'AbortError') {
      throw new Error('AI processing timed out. Try with a smaller file or simpler work scope.');
    }
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let body: any = null; // Declare at outer scope for error handling
  
  try {
    // Robust request parsing
    const bodyText = await req.text();
    if (!bodyText || bodyText.trim() === '') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Request body is required.',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      body = JSON.parse(bodyText);
    } catch {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid JSON in request body.',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const {
      projectType,
      projectDescription,
      workScopeDescription,
      jobAddress,
      existingGroups,
      defaultMarkupPercent,
      companyId,
      plansFileUrl,
      jobId, // Optional job ID for background processing
    } = body;

    console.log('Generating estimate scope for:', { projectType, workScopeDescription, jobAddress, defaultMarkupPercent, companyId, hasPlans: !!plansFileUrl, jobId: jobId || 'none' });
    
    // Helper to update job status in database
    const updateJobStatus = async (
      targetJobId: string,
      status: 'processing' | 'completed' | 'failed',
      resultJson?: any,
      errorMessage?: string
    ) => {
      try {
        const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        const updateData: any = { status };
        
        if (status === 'processing') {
          updateData.started_at = new Date().toISOString();
        }
        
        if (status === 'completed' || status === 'failed') {
          updateData.completed_at = new Date().toISOString();
        }
        
        if (resultJson !== undefined) {
          updateData.result_json = resultJson;
        }
        
        if (errorMessage) {
          updateData.error_message = errorMessage;
        }
        
        const { error } = await supabase
          .from('estimate_generation_jobs')
          .update(updateData)
          .eq('id', targetJobId);
          
        if (error) {
          console.error(`Failed to update job ${targetJobId} status:`, error);
        } else {
          console.log(`Job ${targetJobId} updated to status: ${status}`);
        }
      } catch (updateError) {
        console.error(`Exception updating job ${targetJobId}:`, updateError);
      }
    };
    
    // If jobId provided, run AI in background and return immediately
    if (jobId) {
      console.log(`Background job mode: ${jobId} - returning immediately and processing in background`);
      
      // Mark as processing first
      await updateJobStatus(jobId, 'processing');
      
      // Start background processing with EdgeRuntime.waitUntil
      // This ensures the function keeps running even if client disconnects
      // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
      EdgeRuntime.waitUntil((async () => {
        try {
          console.log(`Background job ${jobId}: Starting AI processing...`);
          
          // Call the main processing logic (defined below in processEstimateGeneration)
          const result = await processEstimateGeneration({
            projectType,
            projectDescription,
            workScopeDescription,
            jobAddress,
            existingGroups,
            defaultMarkupPercent,
            companyId,
            plansFileUrl,
          });
          
          console.log(`Background job ${jobId}: AI processing completed successfully`);
          await updateJobStatus(jobId, 'completed', {
            scope: result.scope,
            warning: result.warning
          });
        } catch (bgError) {
          const errorMessage = bgError instanceof Error ? bgError.message : 'Unknown error in background processing';
          console.error(`Background job ${jobId}: Processing failed:`, errorMessage);
          await updateJobStatus(jobId, 'failed', null, errorMessage);
        }
      })());
      
      // Return immediately - client will get updates via Realtime subscription
      return new Response(JSON.stringify({ 
        success: true, 
        jobId,
        message: 'AI generation started in background. You will be notified when complete.',
        backgroundMode: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Synchronous mode (no jobId) - run processing directly
    const result = await processEstimateGeneration({
      projectType,
      projectDescription,
      workScopeDescription,
      jobAddress,
      existingGroups,
      defaultMarkupPercent,
      companyId,
      plansFileUrl,
    });
    
    return new Response(JSON.stringify({ 
      success: true,
      scope: result.scope,
      warning: result.warning
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-estimate-scope:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // If jobId provided in body, save error to database
    if (body?.jobId) {
      try {
        const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        await supabase
          .from('estimate_generation_jobs')
          .update({ 
            status: 'failed', 
            error_message: errorMessage,
            completed_at: new Date().toISOString()
          })
          .eq('id', body.jobId);
      } catch (updateError) {
        console.error('Failed to update job with error status:', updateError);
      }
    }
    
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Main AI processing function - extracted for both sync and background modes
async function processEstimateGeneration(params: {
  projectType: string;
  projectDescription?: string;
  workScopeDescription: string;
  jobAddress: string;
  existingGroups?: any[];
  defaultMarkupPercent: number;
  companyId?: string;
  plansFileUrl?: string;
}): Promise<{ scope: any; warning?: string }> {
  const {
    projectType,
    projectDescription,
    workScopeDescription,
    jobAddress,
    existingGroups,
    defaultMarkupPercent,
    companyId,
    plansFileUrl,
  } = params;

    // Fetch AI settings from company_settings
    let aiTemperature = 0.3;
    let customInstructions = '';
    let openaiApiKey = '';
    let aiModel = '';
    let aiProvider = 'gemini'; // Default to Gemini
    let maxPdfSizeMb = 50; // Default 50MB
    
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
        .in('setting_key', ['ai_estimate_variability', 'ai_estimate_instructions', 'openai_api_key', 'ai_estimate_model', 'ai_estimate_provider', 'estimate_plans_max_size_mb']);
      
      if (settings) {
        const variabilitySetting = settings.find((s: any) => s.setting_key === 'ai_estimate_variability');
        const instructionsSetting = settings.find((s: any) => s.setting_key === 'ai_estimate_instructions');
        const openaiKeySetting = settings.find((s: any) => s.setting_key === 'openai_api_key');
        const modelSetting = settings.find((s: any) => s.setting_key === 'ai_estimate_model');
        const providerSetting = settings.find((s: any) => s.setting_key === 'ai_estimate_provider');
        const pdfSizeSetting = settings.find((s: any) => s.setting_key === 'estimate_plans_max_size_mb');
        
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
        
        if (pdfSizeSetting?.setting_value) {
          maxPdfSizeMb = parseInt(pdfSizeSetting.setting_value) || 50;
          console.log('PDF size limit from company_settings:', maxPdfSizeMb, 'MB');
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
      
      // If no company-specific PDF size limit, check app_settings for platform default
      if (maxPdfSizeMb === 50) {
        const { data: appPdfSetting } = await supabase
          .from('app_settings')
          .select('setting_value')
          .eq('setting_key', 'estimate_plans_max_size_mb')
          .maybeSingle();
        
        if (appPdfSetting?.setting_value) {
          maxPdfSizeMb = parseInt(appPdfSetting.setting_value) || 50;
          console.log('PDF size limit from app_settings:', maxPdfSizeMb, 'MB');
        }
      }
      
      console.log('Using AI temperature:', aiTemperature);
      console.log('Has custom instructions:', !!customInstructions);
      console.log('Has OpenAI API key:', !!openaiApiKey);
      console.log('AI model preference:', aiModel || 'default');
      console.log('AI provider preference:', aiProvider);
      console.log('Max PDF size:', maxPdfSizeMb, 'MB');
    }

    // Strictly honor the company's AI provider setting - no silent fallbacks
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (aiProvider === 'openai' && !LOVABLE_API_KEY) {
      throw new Error('OpenAI is selected as your AI provider, but the platform AI gateway is not configured. Please contact support or switch to Gemini in AI Settings.');
    }
    
    if (aiProvider === 'gemini' && !LOVABLE_API_KEY) {
      throw new Error('Gemini is selected as your AI provider, but the platform AI gateway is not configured. Please contact support.');
    }
    
    if (!aiProvider) {
      aiProvider = 'gemini'; // Default only if not set at all
    }
    
    console.log(`Strictly using AI provider: ${aiProvider}`);
    
    const MAX_PDF_SIZE_BYTES = maxPdfSizeMb * 1024 * 1024;

    // Fetch and process plans file if provided
    let pdfBuffer: ArrayBuffer | null = null;
    let imageBase64: string | null = null;
    let pdfTooLarge = false;
    
    if (plansFileUrl) {
      console.log('Fetching plans file:', plansFileUrl);
      try {
        // Convert Google Drive view links to direct download links
        let downloadUrl = plansFileUrl;
        let isGoogleDrive = false;
        const googleDriveViewMatch = plansFileUrl.match(/drive\.google\.com\/file\/d\/([^\/]+)/);
        if (googleDriveViewMatch) {
          const fileId = googleDriveViewMatch[1];
          downloadUrl = `https://drive.google.com/uc?export=download&confirm=t&id=${fileId}`;
          isGoogleDrive = true;
          console.log('Converted Google Drive link to direct download URL');
        }
        
        const plansResponse = await fetch(downloadUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EstimateBot/1.0)' },
        });
        
        console.log('Plans fetch response status:', plansResponse.status);
        const contentType = plansResponse.headers.get('content-type') || '';
        console.log('Plans fetch content-type:', contentType);
        
        if (plansResponse.ok) {
          if (isGoogleDrive && contentType.includes('text/html')) {
            console.warn('Google Drive returned HTML - file may require sign-in or be too large');
          } else if (contentType.includes('application/pdf') || (isGoogleDrive && contentType.includes('octet-stream'))) {
            const buffer = await plansResponse.arrayBuffer();
            console.log('PDF buffer size:', buffer.byteLength, 'bytes');
            
            if (buffer.byteLength > MAX_PDF_SIZE_BYTES) {
              console.warn(`PDF too large: ${(buffer.byteLength / (1024 * 1024)).toFixed(1)}MB (max ${maxPdfSizeMb}MB from company settings)`);
              pdfTooLarge = true;
            } else {
              pdfBuffer = buffer;
              console.log('PDF fetched successfully');
            }
          } else if (contentType.includes('image/')) {
            const imageBuffer = await plansResponse.arrayBuffer();
            imageBase64 = bufferToBase64Chunked(imageBuffer);
            const mimeType = contentType.split(';')[0];
            imageBase64 = `data:${mimeType};base64,${imageBase64}`;
            console.log('Image plans file detected');
          } else {
            console.warn('Unknown content type:', contentType);
          }
        } else {
          console.warn('Failed to fetch plans file:', plansResponse.status);
        }
      } catch (plansError) {
        console.error('Error fetching plans file:', plansError);
      }
    }

    // Extract ZIP code and get regional pricing info
    const zipCode = extractZipCode(jobAddress || '');
    const regionInfo = zipCode ? getRegionFromZip(zipCode) : { region: "California", costMultiplier: 1.0, description: "Standard rates" };

    const hasPdf = !!pdfBuffer;
    const hasImage = !!imageBase64;

    // Build system prompt
    let systemPrompt: string;
    
    if (customInstructions) {
      if (hasPdf) {
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
      if (hasPdf) {
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

${(existingGroups && existingGroups.length > 0) ? `\nExisting scope areas (already added): ${existingGroups.join(', ')}` : ''}

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

OUTPUT COMPACTNESS RULES (VERY IMPORTANT):
- Return ONLY raw JSON (no markdown fences, no commentary).
- Keep these arrays short to avoid truncation: project_understanding<=5, assumptions<=8, inclusions<=8, exclusions<=8, missing_info<=8.
- Keep each line item description <= 90 characters.
- Keep notes short (<= 140 characters) or omit notes when not needed.
- Do not include long prose anywhere.

Return a JSON object with this EXACT structure (labor_cost and material_cost are REQUIRED and separate):
{
  "project_understanding": ["bullet 1", "bullet 2"],
  "assumptions": ["assumption 1", "assumption 2"],
  "inclusions": ["included item 1", "included item 2"],
  "exclusions": ["excluded item 1", "excluded item 2"],
  "missing_info": ["question 1", "question 2"],
  ${hasPdf || hasImage ? `"pdf_extracted_data": {
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

    // Build the final user prompt
    let userPrompt: string;
    
    if (hasPdf) {
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
    } else if (hasImage) {
      userPrompt = `**ANALYZE THE ATTACHED CONSTRUCTION PLANS IMAGE CAREFULLY**

I have attached construction plans as an image. Extract all visible dimensions, room layouts, and specifications before generating the estimate.

${baseUserPrompt}`;
    } else {
      userPrompt = baseUserPrompt;
    }

    // ===== CALL AI (Strictly honor provider setting - no silent fallbacks) =====
    let aiResponse: { content: string; model: string };
    let apiProvider: string;

    if (aiProvider === 'openai') {
      // ========== OPENAI PROVIDER ==========
      if (hasPdf) {
        // OpenAI with PDF - use Responses API with file upload
        console.log('Using OpenAI Responses API with PDF file upload...');
        apiProvider = 'OpenAI (GPT-5.2 + File)';
        
        const fileId = await uploadFileToOpenAI(pdfBuffer!, 'construction-plans.pdf', openaiApiKey);
        aiResponse = await callOpenAIResponsesAPI(
          systemPrompt,
          userPrompt,
          fileId,
          openaiApiKey,
          aiTemperature
        );
      } else if (hasImage) {
        // OpenAI with image via gateway
        console.log('Using OpenAI via Lovable AI Gateway with image...');
        apiProvider = 'OpenAI (GPT-5.2)';
        
        const messages = [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userPrompt },
              { type: 'image_url', image_url: { url: imageBase64 } }
            ]
          }
        ];
        
        aiResponse = await callLovableAIGateway(messages, 'openai/gpt-5.2', aiTemperature, LOVABLE_API_KEY!);
      } else {
        // OpenAI text-only - use GPT-5.2 to honor user's provider choice
        console.log('Using OpenAI GPT-5.2 (text-only)...');
        apiProvider = 'OpenAI (GPT-5.2)';
        
        const messages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ];
        
        aiResponse = await callLovableAIGateway(messages, 'openai/gpt-5.2', aiTemperature, LOVABLE_API_KEY!);
      }
    } else {
      // ========== GEMINI PROVIDER (default) ==========
      if (hasPdf) {
        // Gemini with PDF (native support)
        console.log('Using Gemini with native PDF support...');
        apiProvider = 'Gemini (PDF)';
        const pdfBase64 = `data:application/pdf;base64,${bufferToBase64Chunked(pdfBuffer!)}`;
        
        const messages = [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userPrompt },
              { type: 'image_url', image_url: { url: pdfBase64 } }
            ]
          }
        ];
        
        aiResponse = await callLovableAIGateway(messages, 'google/gemini-2.5-pro', aiTemperature, LOVABLE_API_KEY!);
      } else if (hasImage) {
        // Gemini with image
        console.log('Using Gemini with image...');
        apiProvider = 'Gemini (Pro)';
        
        const messages = [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userPrompt },
              { type: 'image_url', image_url: { url: imageBase64 } }
            ]
          }
        ];
        
        aiResponse = await callLovableAIGateway(messages, 'google/gemini-2.5-pro', aiTemperature, LOVABLE_API_KEY!);
      } else {
        // Gemini text-only - use Flash (fastest)
        console.log('Using Gemini Flash (text-only)...');
        apiProvider = 'Gemini (Flash)';
        
        const messages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ];
        
        aiResponse = await callLovableAIGateway(messages, 'google/gemini-3-flash-preview', aiTemperature, LOVABLE_API_KEY!);
      }
    }

    console.log(`AI response received from ${apiProvider} (${aiResponse.content.length} chars)`);

    // Parse the AI response
    let parsedScope;
    try {
      let jsonStr = aiResponse.content;
      
      // Check for markdown code blocks
      const jsonMatch = aiResponse.content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      } else {
        const directJsonMatch = aiResponse.content.match(/\{[\s\S]*\}/);
        if (directJsonMatch) {
          jsonStr = directJsonMatch[0];
        }
      }
      
      if (!jsonStr || jsonStr.trim() === '' || jsonStr.trim() === '{}') {
        throw new Error('AI returned an incomplete response. Try simplifying the work scope or using a smaller PDF.');
      }
      
      // Check for truncated JSON (unbalanced braces indicate incomplete response)
      const openBraces = (jsonStr.match(/\{/g) || []).length;
      const closeBraces = (jsonStr.match(/\}/g) || []).length;
      if (openBraces > closeBraces) {
        console.error('JSON appears truncated:', { openBraces, closeBraces, responseLength: jsonStr.length });
        throw new Error('TOKEN_LIMIT_EXCEEDED: The AI response was cut off because the estimate is too complex. Please try one of the following:\n\n• Simplify the work scope description\n• Remove or use a smaller PDF file\n• Break the project into smaller phases and generate estimates separately');
      }
      
      parsedScope = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.error('Raw response (first 500 chars):', aiResponse.content.substring(0, 500));
      console.error('Raw response (last 500 chars):', aiResponse.content.substring(Math.max(0, aiResponse.content.length - 500)));
      
      // Re-throw token limit errors with the clear message
      if (parseError instanceof Error && parseError.message.includes('TOKEN_LIMIT_EXCEEDED')) {
        throw new Error('The AI response was cut off because the estimate is too complex. Please try one of the following:\n\n• Simplify the work scope description\n• Remove or use a smaller PDF file\n• Break the project into smaller phases and generate estimates separately');
      }
      
      // Re-throw other truncation/incomplete errors
      if (parseError instanceof Error && (parseError.message.includes('truncated') || parseError.message.includes('incomplete'))) {
        throw parseError;
      }
      throw new Error('Failed to parse AI response as JSON. Try simplifying the work scope or using a smaller PDF file.');
    }

    // Add metadata to response
    parsedScope.regionInfo = {
      region: regionInfo.region,
      zipCode: zipCode,
      costMultiplier: regionInfo.costMultiplier,
    };
    parsedScope.apiProvider = apiProvider;
    
    if (pdfTooLarge) {
      parsedScope.warning = 'The uploaded PDF was too large to analyze (max 20MB). The estimate was generated from the work description only.';
      if (parsedScope.pdf_extracted_data) {
        delete parsedScope.pdf_extracted_data;
      }
    }

    // Return the parsed scope - the caller handles Response creation and job updates
    return {
      scope: parsedScope,
      warning: pdfTooLarge ? 'PDF too large - estimate generated from description only' : undefined
    };
}
