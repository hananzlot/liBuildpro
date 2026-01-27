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
    const { projectType, projectDescription, workScopeDescription, jobAddress, existingGroups, defaultMarkupPercent, companyId } = await req.json();

    console.log('Generating estimate scope for:', { projectType, workScopeDescription, jobAddress, defaultMarkupPercent, companyId });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Fetch AI settings from company_settings
    let aiTemperature = 0.3;
    let customInstructions = '';
    
    if (companyId) {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      const { data: settings } = await supabase
        .from('company_settings')
        .select('setting_key, setting_value')
        .eq('company_id', companyId)
        .in('setting_key', ['ai_estimate_variability', 'ai_estimate_instructions']);
      
      if (settings) {
        const variabilitySetting = settings.find((s: any) => s.setting_key === 'ai_estimate_variability');
        const instructionsSetting = settings.find((s: any) => s.setting_key === 'ai_estimate_instructions');
        
        if (variabilitySetting?.setting_value) {
          const parsed = parseFloat(variabilitySetting.setting_value);
          if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
            aiTemperature = parsed;
          }
        }
        
        if (instructionsSetting?.setting_value) {
          customInstructions = instructionsSetting.setting_value;
        }
      }
      console.log('Using AI temperature:', aiTemperature);
      console.log('Has custom instructions:', !!customInstructions);
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
          "labor_cost": number (labor cost per unit, 0 if material-only),
          "material_cost": number (material cost per unit, 0 if labor-only),
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

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: aiTemperature,
        max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Rate limit exceeded. Please try again in a moment." 
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "AI credits exhausted. Please add credits to continue using AI features." 
        }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('Lovable AI API error:', response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const generatedContent = data.choices[0].message.content;
    
    console.log('Generated estimate scope:', generatedContent);

    let parsedScope;
    try {
      // Try to extract JSON from the response (handle markdown code blocks)
      let jsonStr = generatedContent;
      const jsonMatch = generatedContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }
      parsedScope = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.error('Raw response:', generatedContent);
      throw new Error('Failed to parse AI response as JSON');
    }

    // Add region info to the response
    parsedScope.regionInfo = {
      region: regionInfo.region,
      zipCode: zipCode,
      costMultiplier: regionInfo.costMultiplier,
    };

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
