import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Stage types for multi-stage generation
type StageType = 'PLAN_DIGEST' | 'ESTIMATE_PLAN' | 'GROUP_ITEMS' | 'FINAL_ASSEMBLY';

// Token limits per stage to prevent timeouts
const STAGE_TOKEN_LIMITS: Record<StageType, number> = {
  PLAN_DIGEST: 2500,
  ESTIMATE_PLAN: 1800,
  GROUP_ITEMS: 3500,
  FINAL_ASSEMBLY: 3000,
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
  
  return { region: "California", costMultiplier: 1.0, description: "Standard California market rates" };
}

// Convert buffer to base64 in chunks to avoid memory issues with large files
function bufferToBase64Chunked(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
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
      
      if (response.status === 503 || response.status === 502 || response.status === 429) {
        const waitTime = Math.pow(2, attempt) * 2000;
        console.log(`API returned ${response.status}, retrying in ${waitTime}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, waitTime));
        continue;
      }
      
      return response;
    } catch (error) {
      lastError = error as Error;
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

// Call Lovable AI Gateway with stage-specific settings
async function callAIStage(
  stage: StageType,
  messages: any[],
  modelToUse: string,
  temperature: number,
  lovableApiKey: string,
  maxTokens?: number
): Promise<{ content: string; model: string }> {
  console.log(`[${stage}] Calling AI Gateway with model: ${modelToUse}`);
  
  const tokenLimit = maxTokens || STAGE_TOKEN_LIMITS[stage];
  const isOpenAIModel = modelToUse.startsWith('openai/');
  const timeoutMs = stage === 'PLAN_DIGEST' ? 120000 : 60000; // Longer timeout for PDF analysis
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const requestBody: Record<string, unknown> = {
      model: modelToUse,
      messages,
      response_format: { type: "json_object" },
      temperature,
    };
    
    // Set token limit based on model type
    if (isOpenAIModel) {
      requestBody.max_completion_tokens = tokenLimit;
    } else {
      requestBody.max_tokens = tokenLimit;
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
      console.error(`[${stage}] AI Gateway error:`, response.status, errorText);
      
      if (response.status === 429) {
        throw new Error('AI service rate limited. Please wait a moment and try again.');
      }
      if (response.status === 503 || response.status === 502) {
        throw new Error('AI service temporarily unavailable. Please try again in a few moments.');
      }
      throw new Error(`AI Gateway error: ${response.status}`);
    }
    
    const responseText = await response.text();
    if (!responseText || responseText.trim() === '') {
      throw new Error(`[${stage}] AI returned an empty response.`);
    }
    
    const data = JSON.parse(responseText);
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error(`[${stage}] AI returned an empty response.`);
    }
    
    console.log(`[${stage}] AI response received (${content.length} chars)`);
    return { content, model: modelToUse };
  } catch (error) {
    clearTimeout(timeoutId);
    if ((error as Error).name === 'AbortError') {
      throw new Error(`[${stage}] AI processing timed out.`);
    }
    throw error;
  }
}

// Parse JSON from AI response
function parseAIResponse(content: string, stage: string): any {
  let jsonStr = content;
  
  // Check for markdown code blocks
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  } else {
    const directJsonMatch = content.match(/\{[\s\S]*\}/);
    if (directJsonMatch) {
      jsonStr = directJsonMatch[0];
    }
  }
  
  if (!jsonStr || jsonStr.trim() === '' || jsonStr.trim() === '{}') {
    throw new Error(`[${stage}] AI returned an incomplete response.`);
  }
  
  // Check for truncated JSON
  const openBraces = (jsonStr.match(/\{/g) || []).length;
  const closeBraces = (jsonStr.match(/\}/g) || []).length;
  if (openBraces > closeBraces) {
    console.error(`[${stage}] JSON appears truncated:`, { openBraces, closeBraces });
    throw new Error(`[${stage}] Response was truncated. Try simplifying the scope.`);
  }
  
  return JSON.parse(jsonStr);
}

// Create Supabase client for job updates
function createSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(supabaseUrl, supabaseServiceKey);
}

// Update job progress with stage info
async function updateJobProgress(
  jobId: string,
  currentStage: string,
  stageNumber: number,
  totalStages: number,
  stageResults?: Record<string, any>
) {
  const supabase = createSupabaseClient();
  
  const updateData: Record<string, any> = {
    current_stage: currentStage,
    total_stages: totalStages,
  };
  
  if (stageResults) {
    updateData.stage_results = stageResults;
  }
  
  const { error } = await supabase
    .from('estimate_generation_jobs')
    .update(updateData)
    .eq('id', jobId);
    
  if (error) {
    console.error(`Failed to update job progress:`, error);
  } else {
    console.log(`Job ${jobId}: Stage ${stageNumber}/${totalStages} - ${currentStage}`);
  }
}

// Update job status
async function updateJobStatus(
  jobId: string,
  status: 'processing' | 'completed' | 'failed',
  resultJson?: any,
  errorMessage?: string
) {
  const supabase = createSupabaseClient();
  
  const updateData: Record<string, any> = { status };
  
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
    .eq('id', jobId);
    
  if (error) {
    console.error(`Failed to update job ${jobId} status:`, error);
  } else {
    console.log(`Job ${jobId} updated to status: ${status}`);
  }
}

// Queue management functions
async function addToQueue(jobId: string, companyId: string, userId: string | null): Promise<number> {
  const supabase = createSupabaseClient();
  
  // Get next position using the database function
  const { data: positionData } = await supabase.rpc('get_next_queue_position', { p_company_id: companyId });
  const position = positionData || 1;
  
  const { error } = await supabase
    .from('estimate_generation_queue')
    .insert({
      job_id: jobId,
      company_id: companyId,
      user_id: userId,
      position,
      status: 'waiting',
    });
  
  if (error) {
    console.error('Failed to add job to queue:', error);
    throw new Error('Failed to add job to queue');
  }
  
  console.log(`Job ${jobId} added to queue at position ${position}`);
  return position;
}

async function updateQueueStatus(jobId: string, status: 'waiting' | 'processing' | 'completed' | 'failed' | 'cancelled') {
  const supabase = createSupabaseClient();
  
  const updateData: Record<string, any> = { status };
  
  if (status === 'processing') {
    updateData.started_at = new Date().toISOString();
  }
  if (status === 'completed' || status === 'failed' || status === 'cancelled') {
    updateData.completed_at = new Date().toISOString();
  }
  
  const { error } = await supabase
    .from('estimate_generation_queue')
    .update(updateData)
    .eq('job_id', jobId);
    
  if (error) {
    console.error(`Failed to update queue status for job ${jobId}:`, error);
  }
}

async function waitForQueueTurn(jobId: string, companyId: string): Promise<void> {
  const supabase = createSupabaseClient();
  const maxWaitTime = 5 * 60 * 1000; // 5 minutes max wait
  const pollInterval = 2000; // 2 seconds
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    // Check if any job ahead of us is still processing
    const { data: processingJobs } = await supabase
      .from('estimate_generation_queue')
      .select('id, position')
      .eq('company_id', companyId)
      .eq('status', 'processing')
      .neq('job_id', jobId);
    
    // Get our current position
    const { data: ourEntry } = await supabase
      .from('estimate_generation_queue')
      .select('position')
      .eq('job_id', jobId)
      .maybeSingle();
    
    if (!ourEntry) {
      console.log(`Job ${jobId} not found in queue, proceeding`);
      return;
    }
    
    // If no one is processing or we're in position 1, we can start
    if (!processingJobs || processingJobs.length === 0 || ourEntry.position === 1) {
      console.log(`Job ${jobId} is ready to start (position: ${ourEntry.position})`);
      return;
    }
    
    console.log(`Job ${jobId} waiting at position ${ourEntry.position}, ${processingJobs.length} jobs ahead`);
    await new Promise(r => setTimeout(r, pollInterval));
  }
  
  console.warn(`Job ${jobId} waited too long in queue, proceeding anyway`);
}

// Fetch company settings
async function fetchCompanySettings(companyId: string) {
  const supabase = createSupabaseClient();
  
  let aiTemperature = 0.2;
  let customInstructions = '';
  let aiProvider = 'gemini';
  let maxPdfSizeMb = 50;
  
  const { data: settings } = await supabase
    .from('company_settings')
    .select('setting_key, setting_value')
    .eq('company_id', companyId)
    .in('setting_key', ['ai_estimate_variability', 'ai_estimate_instructions', 'ai_estimate_provider', 'estimate_plans_max_size_mb']);
  
  if (settings) {
    const variabilitySetting = settings.find((s: any) => s.setting_key === 'ai_estimate_variability');
    const instructionsSetting = settings.find((s: any) => s.setting_key === 'ai_estimate_instructions');
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
    
    if (providerSetting?.setting_value) {
      aiProvider = providerSetting.setting_value;
    }
    
    if (pdfSizeSetting?.setting_value) {
      maxPdfSizeMb = parseInt(pdfSizeSetting.setting_value) || 50;
    }
  }
  
  // Fallback to app_settings for PDF size
  if (maxPdfSizeMb === 50) {
    const { data: appPdfSetting } = await supabase
      .from('app_settings')
      .select('setting_value')
      .eq('setting_key', 'estimate_plans_max_size_mb')
      .maybeSingle();
    
    if (appPdfSetting?.setting_value) {
      maxPdfSizeMb = parseInt(appPdfSetting.setting_value) || 50;
    }
  }
  
  return { aiTemperature, customInstructions, aiProvider, maxPdfSizeMb };
}

// Fetch and process plans file
async function fetchPlansFile(plansFileUrl: string, maxPdfSizeMb: number): Promise<{
  pdfBuffer: ArrayBuffer | null;
  imageBase64: string | null;
  pdfTooLarge: boolean;
}> {
  let pdfBuffer: ArrayBuffer | null = null;
  let imageBase64: string | null = null;
  let pdfTooLarge = false;
  
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
    
    const contentType = plansResponse.headers.get('content-type') || '';
    console.log('Plans fetch response:', plansResponse.status, contentType);
    
    if (plansResponse.ok) {
      if (isGoogleDrive && contentType.includes('text/html')) {
        console.warn('Google Drive returned HTML - file may require sign-in');
      } else if (contentType.includes('application/pdf') || (isGoogleDrive && contentType.includes('octet-stream'))) {
        const buffer = await plansResponse.arrayBuffer();
        console.log('PDF buffer size:', buffer.byteLength, 'bytes');
        
        const MAX_PDF_SIZE_BYTES = maxPdfSizeMb * 1024 * 1024;
        if (buffer.byteLength > MAX_PDF_SIZE_BYTES) {
          console.warn(`PDF too large: ${(buffer.byteLength / (1024 * 1024)).toFixed(1)}MB (max ${maxPdfSizeMb}MB)`);
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
      }
    } else {
      console.warn('Failed to fetch plans file:', plansResponse.status);
    }
  } catch (plansError) {
    console.error('Error fetching plans file:', plansError);
  }
  
  return { pdfBuffer, imageBase64, pdfTooLarge };
}

// ===== MULTI-STAGE PROCESSING =====

// Stage 1: PLAN_DIGEST - Extract data from PDF plans
async function processPlanDigestStage(
  pdfBuffer: ArrayBuffer,
  scopeText: string,
  jobAddress: string,
  regionInfo: { region: string; costMultiplier: number },
  systemPrompt: string,
  aiTemperature: number,
  lovableApiKey: string,
  aiProvider: string
): Promise<any> {
  console.log('=== STAGE 1: PLAN_DIGEST ===');
  
  const pdfBase64 = `data:application/pdf;base64,${bufferToBase64Chunked(pdfBuffer)}`;
  
  const userMessage = `mode: "PLAN_DIGEST"

Job Location: ${jobAddress}
Region: ${regionInfo.region} (${regionInfo.costMultiplier}x cost multiplier)

WORK SCOPE:
${scopeText}

Extract high-signal estimating inputs from the attached construction plans PDF.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: [
        { type: 'text', text: userMessage },
        { type: 'image_url', image_url: { url: pdfBase64 } }
      ]
    }
  ];
  
  // Use Gemini for PDF analysis (native support)
  const model = 'google/gemini-2.5-pro';
  const response = await callAIStage('PLAN_DIGEST', messages, model, aiTemperature, lovableApiKey);
  
  return parseAIResponse(response.content, 'PLAN_DIGEST');
}

// Stage 2: ESTIMATE_PLAN - Create outline with groups and payment schedule
async function processEstimatePlanStage(
  scopeText: string,
  projectType: string,
  jobAddress: string,
  defaultMarkupPercent: number,
  regionInfo: { region: string; costMultiplier: number },
  planDigest: any | null,
  systemPrompt: string,
  aiTemperature: number,
  lovableApiKey: string,
  aiProvider: string
): Promise<any> {
  console.log('=== STAGE 2: ESTIMATE_PLAN ===');
  
  let userMessage = `mode: "ESTIMATE_PLAN"

Project Type: ${projectType || 'Home Improvement'}
Job Location: ${jobAddress}
Region: ${regionInfo.region} (${regionInfo.costMultiplier}x cost multiplier)
Default Markup: ${defaultMarkupPercent}%

WORK SCOPE:
${scopeText}`;

  if (planDigest) {
    userMessage += `

PLAN DIGEST (from PDF analysis):
${JSON.stringify(planDigest, null, 2)}`;
  }
  
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage }
  ];
  
  // Use provider preference for text-only
  const model = aiProvider === 'openai' ? 'openai/gpt-5.2' : 'google/gemini-3-flash-preview';
  const response = await callAIStage('ESTIMATE_PLAN', messages, model, aiTemperature, lovableApiKey);
  
  return parseAIResponse(response.content, 'ESTIMATE_PLAN');
}

// Stage 3: GROUP_ITEMS - Generate items for one group
async function processGroupItemsStage(
  groupName: string,
  groupDescription: string,
  targetItemCount: number,
  scopeText: string,
  jobAddress: string,
  defaultMarkupPercent: number,
  regionInfo: { region: string; costMultiplier: number },
  planDigest: any | null,
  systemPrompt: string,
  aiTemperature: number,
  lovableApiKey: string,
  aiProvider: string
): Promise<any> {
  console.log(`=== STAGE 3: GROUP_ITEMS (${groupName}) ===`);
  
  let userMessage = `mode: "GROUP_ITEMS"

group_name: "${groupName}"
group_description: "${groupDescription}"
target_item_count: ${targetItemCount}

Job Location: ${jobAddress}
Region: ${regionInfo.region} (${regionInfo.costMultiplier}x cost multiplier)
Default Markup: ${defaultMarkupPercent}%

WORK SCOPE:
${scopeText}`;

  if (planDigest) {
    userMessage += `

PLAN DIGEST (from PDF analysis):
${JSON.stringify(planDigest, null, 2)}`;
  }
  
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage }
  ];
  
  // Use provider preference for text-only
  const model = aiProvider === 'openai' ? 'openai/gpt-5.2' : 'google/gemini-3-flash-preview';
  const response = await callAIStage('GROUP_ITEMS', messages, model, aiTemperature, lovableApiKey);
  
  return parseAIResponse(response.content, 'GROUP_ITEMS');
}

// Stage 4: FINAL_ASSEMBLY - Merge all results programmatically (no AI call needed)
function processFinalAssemblyStage(
  estimatePlan: any,
  groupResults: any[]
): any {
  console.log('=== STAGE 4: FINAL_ASSEMBLY (programmatic merge) ===');
  
  // Merge all missing_info from groups
  const allMissingInfo: string[] = [...(estimatePlan.missing_info || [])];
  
  // Build final groups array with items
  const finalGroups = groupResults.map((gr, idx) => {
    // Collect missing_info from each group
    if (gr.missing_info && Array.isArray(gr.missing_info)) {
      allMissingInfo.push(...gr.missing_info);
    }
    
    return {
      group_name: gr.group_name,
      description: gr.description || '',
      sort_order: idx,
      items: (gr.items || []).map((item: any, itemIdx: number) => ({
        item_type: item.item_type || 'material',
        description: item.description || 'Line item',
        quantity: item.quantity ?? 1,
        unit: item.unit || 'each',
        labor_cost: item.labor_cost ?? 0,
        material_cost: item.material_cost ?? 0,
        markup_percent: item.markup_percent ?? estimatePlan.default_markup ?? 50,
        is_taxable: item.is_taxable ?? true,
        sort_order: itemIdx,
      })),
    };
  });
  
  // Build final result
  const finalResult = {
    project_understanding: estimatePlan.project_understanding || [],
    assumptions: estimatePlan.assumptions || [],
    inclusions: estimatePlan.inclusions || [],
    exclusions: estimatePlan.exclusions || [],
    missing_info: [...new Set(allMissingInfo)], // Deduplicate
    groups: finalGroups,
    payment_schedule: estimatePlan.payment_schedule || [],
    suggested_deposit_percent: estimatePlan.suggested_deposit_percent ?? 20,
    suggested_tax_rate: estimatePlan.suggested_tax_rate ?? 9.5,
    notes: estimatePlan.notes || '',
    first_payment_name: estimatePlan.first_payment_name || 'Deposit',
  };
  
  console.log(`FINAL_ASSEMBLY: ${finalGroups.length} groups, ${finalGroups.reduce((sum: number, g: any) => sum + g.items.length, 0)} total items`);
  
  return finalResult;
}

// Main staged processing pipeline
async function processEstimateGenerationStaged(params: {
  projectType: string;
  projectDescription?: string;
  workScopeDescription: string;
  jobAddress: string;
  existingGroups?: any[];
  defaultMarkupPercent: number;
  companyId?: string;
  plansFileUrl?: string;
  jobId?: string;
}): Promise<{ scope: any; warning?: string }> {
  const {
    projectType,
    workScopeDescription,
    jobAddress,
    defaultMarkupPercent,
    companyId,
    plansFileUrl,
    jobId,
  } = params;

  // Fetch settings
  const settings = companyId 
    ? await fetchCompanySettings(companyId)
    : { aiTemperature: 0.2, customInstructions: '', aiProvider: 'gemini', maxPdfSizeMb: 50 };
  
  const { aiTemperature, customInstructions, aiProvider, maxPdfSizeMb } = settings;
  
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    throw new Error('AI gateway is not configured. Please contact support.');
  }
  
  console.log('Settings:', { aiTemperature, aiProvider, hasCustomInstructions: !!customInstructions });

  // Fetch plans if provided
  let pdfBuffer: ArrayBuffer | null = null;
  let imageBase64: string | null = null;
  let pdfTooLarge = false;
  
  if (plansFileUrl) {
    const plansResult = await fetchPlansFile(plansFileUrl, maxPdfSizeMb);
    pdfBuffer = plansResult.pdfBuffer;
    imageBase64 = plansResult.imageBase64;
    pdfTooLarge = plansResult.pdfTooLarge;
  }

  const hasPdf = !!pdfBuffer;
  const zipCode = extractZipCode(jobAddress || '');
  const regionInfo = zipCode ? getRegionFromZip(zipCode) : { region: "California", costMultiplier: 1.0, description: "Standard rates" };
  
  // Use custom instructions as system prompt (they contain the multi-stage mode instructions)
  const systemPrompt = customInstructions || getDefaultSystemPrompt();
  
  // Calculate total stages
  // PLAN_DIGEST (if PDF) + ESTIMATE_PLAN + GROUP_ITEMS (up to 14) + FINAL_ASSEMBLY
  const baseStages = hasPdf ? 4 : 3; // PLAN_DIGEST only if PDF
  
  // ===== STAGE 1: PLAN_DIGEST (only if PDF) =====
  let planDigest: any = null;
  let stageResults: Record<string, any> = {};
  let currentStageNum = 1;
  
  if (hasPdf && pdfBuffer) {
    if (jobId) {
      await updateJobProgress(jobId, 'PLAN_DIGEST', currentStageNum, baseStages, stageResults);
    }
    
    planDigest = await processPlanDigestStage(
      pdfBuffer,
      workScopeDescription,
      jobAddress,
      regionInfo,
      systemPrompt,
      aiTemperature,
      LOVABLE_API_KEY,
      aiProvider
    );
    
    stageResults.plan_digest = planDigest;
    currentStageNum++;
  }
  
  // ===== STAGE 2: ESTIMATE_PLAN =====
  if (jobId) {
    await updateJobProgress(jobId, 'ESTIMATE_PLAN', currentStageNum, baseStages, stageResults);
  }
  
  const estimatePlan = await processEstimatePlanStage(
    workScopeDescription,
    projectType,
    jobAddress,
    defaultMarkupPercent,
    regionInfo,
    planDigest,
    systemPrompt,
    aiTemperature,
    LOVABLE_API_KEY,
    aiProvider
  );
  
  stageResults.estimate_plan = estimatePlan;
  currentStageNum++;
  
  // Extract groups from ESTIMATE_PLAN
  const groups = estimatePlan.groups || [];
  const totalStages = baseStages + groups.length; // Add GROUP_ITEMS stages
  
  // ===== STAGE 3: GROUP_ITEMS (loop for each group) =====
  const groupResults: any[] = [];
  
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const groupName = group.group_name || `Group ${i + 1}`;
    const groupDescription = group.description || '';
    const targetItemCount = group.target_item_count || 10;
    
    if (jobId) {
      await updateJobProgress(jobId, `GROUP_ITEMS:${groupName}`, currentStageNum + i, totalStages, stageResults);
    }
    
    const groupItems = await processGroupItemsStage(
      groupName,
      groupDescription,
      targetItemCount,
      workScopeDescription,
      jobAddress,
      defaultMarkupPercent,
      regionInfo,
      planDigest,
      systemPrompt,
      aiTemperature,
      LOVABLE_API_KEY,
      aiProvider
    );
    
    groupResults.push({
      group_name: groupName,
      description: groupDescription,
      items: groupItems.items || [],
      missing_info: groupItems.missing_info || [],
    });
    
    stageResults[`group_${i}`] = groupItems;
  }
  
  // ===== STAGE 4: FINAL_ASSEMBLY =====
  if (jobId) {
    await updateJobProgress(jobId, 'FINAL_ASSEMBLY', totalStages, totalStages, stageResults);
  }
  
  const finalResult = processFinalAssemblyStage(
    estimatePlan,
    groupResults
  );
  
  // Add metadata
  finalResult.regionInfo = {
    region: regionInfo.region,
    zipCode: zipCode,
    costMultiplier: regionInfo.costMultiplier,
  };
  finalResult.apiProvider = aiProvider === 'openai' ? 'OpenAI (GPT-5.2)' : 'Gemini (Staged)';
  
  if (pdfTooLarge) {
    finalResult.warning = 'The uploaded PDF was too large to analyze. The estimate was generated from the work description only.';
  }
  
  return {
    scope: finalResult,
    warning: pdfTooLarge ? 'PDF too large - estimate generated from description only' : undefined
  };
}

// Default system prompt (fallback if no custom instructions)
function getDefaultSystemPrompt(): string {
  return `You are an expert California residential construction estimator (COST basis: contractor cost, not selling price).
You produce estimates that are: granular, accurate, logically grouped, and machine-readable.

ABSOLUTE RULES:
1) OUTPUT MUST BE VALID JSON ONLY. No markdown. No commentary.
2) COST BASIS: Return costs (what contractor pays). Markup applied separately by system.
3) COST FIELDS ARE PER-UNIT ONLY:
   - labor_cost = rate per unit (e.g., $65/hour)
   - material_cost = price per unit (e.g., $4/sqft)
   - NEVER return extended totals in labor_cost or material_cost.
4) Every line item MUST include both labor_cost and material_cost fields (use 0 when not applicable).
5) Keep text compact: descriptions <= 80 chars, notes <= 120 chars.
6) Payments must be front-heavy. Final payment must NOT exceed 10%.

Follow the mode specified in the user message strictly.`;
}

// ===== MAIN HTTP HANDLER =====
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let body: any = null;
  
  try {
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
      jobId,
      stagedMode = true, // Default to new staged mode
      recoverJobId, // If provided, recover a failed job by running final assembly on saved stage_results
    } = body;

    // ===== RECOVER MODE: Complete a failed job using saved stage_results =====
    if (recoverJobId) {
      console.log(`Recover mode: Attempting to recover job ${recoverJobId}`);
      
      const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      // Fetch the job's stage_results
      const { data: jobData, error: jobError } = await supabaseAdmin
        .from('estimate_generation_jobs')
        .select('id, estimate_id, stage_results, status')
        .eq('id', recoverJobId)
        .single();
      
      if (jobError || !jobData) {
        console.error('Failed to fetch job:', jobError);
        return new Response(JSON.stringify({
          success: false,
          error: `Job not found: ${recoverJobId}`,
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      const stageResults = jobData.stage_results as Record<string, any>;
      if (!stageResults || !stageResults.estimate_plan) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Job does not have saved stage_results with estimate_plan. Cannot recover.',
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Extract estimate_plan and group results from stage_results
      const estimatePlan = stageResults.estimate_plan;
      const groupResults: any[] = [];
      
      // Find all group_N keys and reconstruct groupResults array
      const groupKeys = Object.keys(stageResults)
        .filter(k => k.startsWith('group_'))
        .sort((a, b) => {
          const aNum = parseInt(a.replace('group_', ''));
          const bNum = parseInt(b.replace('group_', ''));
          return aNum - bNum;
        });
      
      for (const groupKey of groupKeys) {
        const groupData = stageResults[groupKey];
        // Get group name from estimate_plan.groups if available
        const groupIndex = parseInt(groupKey.replace('group_', ''));
        const planGroup = estimatePlan.groups?.[groupIndex];
        
        groupResults.push({
          group_name: planGroup?.group_name || groupData.group_name || `Group ${groupIndex + 1}`,
          description: planGroup?.description || groupData.description || '',
          items: groupData.items || [],
          missing_info: groupData.missing_info || [],
        });
      }
      
      if (groupResults.length === 0) {
        return new Response(JSON.stringify({
          success: false,
          error: 'No group items found in stage_results. Cannot complete final assembly.',
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      console.log(`Recover mode: Found ${groupResults.length} groups in stage_results`);
      
      // Run programmatic final assembly
      const finalResult = processFinalAssemblyStage(estimatePlan, groupResults);
      
      // Update job as completed
      await updateJobStatus(recoverJobId, 'completed', {
        scope: finalResult,
        recovered: true,
      });
      
      console.log(`Recover mode: Successfully recovered job ${recoverJobId}`);
      
      return new Response(JSON.stringify({
        success: true,
        scope: finalResult,
        recovered: true,
        message: 'Job recovered successfully from saved stage data',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Generating estimate scope:', { 
      projectType, 
      jobAddress, 
      defaultMarkupPercent, 
      companyId, 
      hasPlans: !!plansFileUrl, 
      jobId: jobId || 'none',
      stagedMode 
    });
    
    // If jobId provided, run AI in background and return immediately
    if (jobId) {
      console.log(`Background job mode: ${jobId} - returning immediately`);
      
      // Add to queue and get position
      let queuePosition = 1;
      try {
        // Extract user_id from auth header if available
        const authHeader = req.headers.get('Authorization');
        let userId: string | null = null;
        if (authHeader) {
          const token = authHeader.replace('Bearer ', '');
          const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
          const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
          const tempClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: `Bearer ${token}` } }
          });
          const { data: userData } = await tempClient.auth.getUser();
          userId = userData?.user?.id || null;
        }
        
        queuePosition = await addToQueue(jobId, companyId, userId);
      } catch (queueError) {
        console.warn('Failed to add to queue, continuing without queue management:', queueError);
      }
      
      // Mark job as processing (will wait for turn in background)
      await updateJobStatus(jobId, 'processing');
      
      // Start background processing
      // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
      EdgeRuntime.waitUntil((async () => {
        try {
          // If we're not first in queue, wait for our turn
          if (queuePosition > 1) {
            console.log(`Background job ${jobId}: Waiting in queue at position ${queuePosition}...`);
            await waitForQueueTurn(jobId, companyId);
          }
          
          // Mark queue entry as processing
          await updateQueueStatus(jobId, 'processing');
          
          console.log(`Background job ${jobId}: Starting staged AI processing...`);
          
          const result = await processEstimateGenerationStaged({
            projectType,
            projectDescription,
            workScopeDescription,
            jobAddress,
            existingGroups,
            defaultMarkupPercent,
            companyId,
            plansFileUrl,
            jobId,
          });
          
          console.log(`Background job ${jobId}: Completed successfully`);
          await updateJobStatus(jobId, 'completed', {
            scope: result.scope,
            warning: result.warning
          });
          
          // Mark queue entry as completed (triggers advancement for others)
          await updateQueueStatus(jobId, 'completed');
        } catch (bgError) {
          const errorMessage = bgError instanceof Error ? bgError.message : 'Unknown error';
          console.error(`Background job ${jobId}: Failed:`, errorMessage);
          await updateJobStatus(jobId, 'failed', null, errorMessage);
          
          // Mark queue entry as failed (triggers advancement for others)
          await updateQueueStatus(jobId, 'failed');
        }
      })());
      
      // Return immediately with queue position info
      return new Response(JSON.stringify({ 
        success: true, 
        jobId,
        queuePosition,
        message: queuePosition > 1 
          ? `You are #${queuePosition} in the AI queue. Your request will process automatically.`
          : 'AI generation started in background. You will be notified when complete.',
        backgroundMode: true,
        stagedMode: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Synchronous mode (no jobId) - run processing directly
    const result = await processEstimateGenerationStaged({
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
    
    // If jobId provided, save error to database
    if (body?.jobId) {
      await updateJobStatus(body.jobId, 'failed', null, errorMessage);
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
