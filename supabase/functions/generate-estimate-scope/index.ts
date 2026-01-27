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
    
    if (companyId) {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      // Fetch company settings including OpenAI API key
      const { data: settings } = await supabase
        .from('company_settings')
        .select('setting_key, setting_value')
        .eq('company_id', companyId)
        .in('setting_key', ['ai_estimate_variability', 'ai_estimate_instructions', 'openai_api_key', 'ai_estimate_model']);
      
      if (settings) {
        const variabilitySetting = settings.find((s: any) => s.setting_key === 'ai_estimate_variability');
        const instructionsSetting = settings.find((s: any) => s.setting_key === 'ai_estimate_instructions');
        const openaiKeySetting = settings.find((s: any) => s.setting_key === 'openai_api_key');
        const modelSetting = settings.find((s: any) => s.setting_key === 'ai_estimate_model');
        
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
    }

    // Determine which API to use
    const useOpenAI = !!openaiApiKey;
    
    // Fall back to Lovable API if no OpenAI key
    if (!useOpenAI) {
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      if (!LOVABLE_API_KEY) {
        throw new Error('No AI API key configured. Please add your OpenAI API key in company settings.');
      }
    }

    // Parse uploaded plans file if provided
    let parsedPlansContent = '';
    if (plansFileUrl) {
      console.log('Fetching and parsing plans file...');
      try {
        // Fetch the file content
        const plansResponse = await fetch(plansFileUrl);
        if (plansResponse.ok) {
          const contentType = plansResponse.headers.get('content-type') || '';
          
          if (contentType.includes('application/pdf')) {
            // For PDFs, we'll describe what we received and ask the AI to work with the description
            parsedPlansContent = `\n\n[CONSTRUCTION PLANS FILE UPLOADED - PDF document provided. Please generate an estimate based on the work scope description above, which should describe the contents of the plans.]`;
            console.log('PDF plans file detected - using description-based estimation');
          } else if (contentType.includes('image/')) {
            // For images, convert to base64 for vision model
            const imageBuffer = await plansResponse.arrayBuffer();
            const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
            const mimeType = contentType.split(';')[0];
            parsedPlansContent = `data:${mimeType};base64,${base64Image}`;
            console.log('Image plans file detected - will send to vision model');
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

    // Build system prompt
    let systemPrompt: string;
    
    if (customInstructions) {
      // Use custom instructions directly - trust the user's prompt
      systemPrompt = customInstructions;
    } else {
      // Default system prompt if no custom instructions
      systemPrompt = `You are an expert construction estimator for a home improvement contractor in California. 
Create detailed, accurate estimates for residential construction projects.

Return COST values (what the contractor pays), not selling prices. Markup will be applied separately.
Use realistic California market rates for labor and materials (2024-2025 pricing).
Include all necessary line items: demolition, materials, labor, permits, cleanup.
Group items logically by work area.

Always return valid JSON matching the exact schema requested.`;
    }

    const userPrompt = `Generate a HIGHLY DETAILED estimate scope for the following project.

CRITICAL: Create maximum granularity - break every task into its smallest components. Aim for 50+ line items.

Project Type: ${projectType || 'Home Improvement'}
Job Location: ${jobAddress || 'California'}
${zipCode ? `ZIP Code: ${zipCode} (${regionInfo.region} - apply ${regionInfo.costMultiplier}x cost multiplier)` : ''}
Default Markup: ${defaultMarkupPercent || 35}%

DETAILED WORK SCOPE FROM CUSTOMER:
${workScopeDescription || projectDescription || 'General home improvement project'}
${parsedPlansContent && !parsedPlansContent.startsWith('data:') ? parsedPlansContent : ''}

${existingGroups?.length > 0 ? `\nExisting scope areas (already added): ${existingGroups.join(', ')}` : ''}

Return a JSON object with this EXACT structure (labor_cost and material_cost are REQUIRED and separate):
{
  "project_understanding": ["bullet 1", "bullet 2"],
  "assumptions": ["assumption 1", "assumption 2"],
  "inclusions": ["included item 1", "included item 2"],
  "exclusions": ["excluded item 1", "excluded item 2"],
  "missing_info": ["question 1", "question 2"],
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
          "labor_cost": number,
          "material_cost": number,
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

**CRITICAL - COST FIELD RULES (READ CAREFULLY!):**
- "labor_cost" = RATE PER SINGLE UNIT (e.g., $50 per hour, $3 per sqft for install labor)
- "material_cost" = PRICE PER SINGLE UNIT (e.g., $8 per sqft, $2 per board-foot)
- NEVER multiply costs by quantity - return ONLY the unit rate!
- The system calculates: line_total = (labor_cost + material_cost) × quantity × (1 + markup%)

CORRECT EXAMPLES:
✓ 2000 board feet of lumber at $2/bf → quantity: 2000, material_cost: 2, labor_cost: 0
✓ 40 hours of electrician at $75/hr → quantity: 40, labor_cost: 75, material_cost: 0
✓ 1000 sqft flooring at $8/sqft material + $3/sqft install → quantity: 1000, material_cost: 8, labor_cost: 3
✓ 500 sqft drywall at $1.50/sqft material + $2/sqft labor → quantity: 500, material_cost: 1.5, labor_cost: 2

WRONG EXAMPLES (DO NOT DO THIS):
✗ material_cost: 4000 for 2000 board feet (WRONG - this is the total, not per-unit!)
✗ labor_cost: 3000 for 40 hours (WRONG - should be 75 per hour, not 75×40!)
✗ material_cost: 8000 for 1000 sqft (WRONG - should be 8 per sqft!)

GRANULARITY RULES:
- Break each trade into 5-15 separate line items minimum
- Example: "Flooring" becomes: "Flooring - Remove existing", "Flooring - Subfloor prep", "Flooring - Underlayment material", "Flooring - Underlayment install labor", "Flooring - Hardwood material", "Flooring - Hardwood install labor", "Flooring - Transition strips", "Flooring - Baseboards remove/replace"
- Every line MUST have both labor_cost and material_cost fields (use 0 if not applicable)
- Include often-forgotten items: mobilization, protection, dust control, daily cleanup, dumpsters, permits, inspections, final cleaning, punch list${parsedPlansContent && parsedPlansContent.startsWith('data:') ? '\n- ANALYZE THE ATTACHED CONSTRUCTION PLANS IMAGE CAREFULLY to extract dimensions, room layouts, and scope details' : ''}`;

    // Build messages array - include image if we have one
    const messages: any[] = [
      { role: 'system', content: systemPrompt },
    ];

    const hasImageAttachment = parsedPlansContent && parsedPlansContent.startsWith('data:');

    if (hasImageAttachment) {
      // Vision model message with image
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: userPrompt },
          { 
            type: 'image_url', 
            image_url: { url: parsedPlansContent }
          }
        ]
      });
      console.log('Using vision model with image attachment');
    } else {
      messages.push({ role: 'user', content: userPrompt });
    }

    let response: Response;
    let apiProvider: string;

    if (useOpenAI) {
      // Use OpenAI API directly with company's API key
      apiProvider = 'OpenAI';
      
      // Model selection: gpt-4o for images, gpt-4o-mini for text (or use configured model)
      let modelToUse: string;
      if (aiModel) {
        // Use configured model, but force gpt-4o for images if they chose gpt-4o-mini
        modelToUse = hasImageAttachment && aiModel === 'gpt-4o-mini' ? 'gpt-4o' : aiModel;
      } else {
        modelToUse = hasImageAttachment ? 'gpt-4o' : 'gpt-4o-mini';
      }
      
      console.log(`Using OpenAI API with model: ${modelToUse}`);

      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelToUse,
          messages,
          temperature: aiTemperature,
          max_tokens: 16000,
        }),
      });
    } else {
      // Fall back to Lovable AI Gateway
      apiProvider = 'Lovable';
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
      
      const modelToUse = hasImageAttachment 
        ? 'google/gemini-2.5-flash' // Vision-capable model
        : 'google/gemini-3-flash-preview';
      
      console.log(`Using Lovable AI Gateway with model: ${modelToUse}`);

      response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelToUse,
          messages,
          temperature: aiTemperature,
          max_tokens: 16000,
        }),
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`${apiProvider} API error:`, response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: `Rate limit exceeded on ${apiProvider}. Please try again in a moment.` 
        }), {
          status: 429,
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
    
    console.log('Generated estimate scope:', generatedContent);

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

    return new Response(JSON.stringify({ 
      success: true,
      scope: parsedScope 
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
