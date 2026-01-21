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
    const { projectType, projectDescription, workScopeDescription, jobAddress, existingGroups, defaultMarkupPercent } = await req.json();

    console.log('Generating estimate scope for:', { projectType, workScopeDescription, jobAddress, defaultMarkupPercent });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Extract ZIP code and get regional pricing info
    const zipCode = extractZipCode(jobAddress || '');
    const regionInfo = zipCode ? getRegionFromZip(zipCode) : { region: "California", costMultiplier: 1.0, description: "Standard rates" };

    const systemPrompt = `You are an expert construction estimator for a home improvement contractor in California. 
You create detailed, accurate estimates for residential construction projects including kitchens, bathrooms, roofing, windows, siding, HVAC, and general remodeling.

IMPORTANT: You are calculating COSTS (what the contractor pays), not selling prices. Markup will be applied separately by the system.

IMPORTANT LOCATION-BASED PRICING:
- Job Location: ${jobAddress || 'California'}
- ZIP Code: ${zipCode || 'Not specified'}
- Region: ${regionInfo.region}
- Cost Adjustment: ${((regionInfo.costMultiplier - 1) * 100).toFixed(0)}% ${regionInfo.costMultiplier > 1 ? 'above' : 'below'} base California rates
- Note: ${regionInfo.description}

Apply the ${regionInfo.costMultiplier}x multiplier to all labor and material costs for accurate regional pricing.

When generating estimates:
- Return COST values (what YOU pay for labor and materials), not selling prices
- Use realistic California market rates for labor and materials (2024-2025 pricing) ADJUSTED for the specific region
- Parse the work scope description carefully for exact measurements and quantities
- Include all necessary line items: demolition, materials, labor, permits, cleanup
- Group items logically by work area (e.g., Kitchen, Bathroom, Electrical, Plumbing)
- Use appropriate units (sqft, linear ft, hours, each, set)
- Include common permit fees for the type of work (adjusted for local jurisdiction)
- Include suggested markup percentage for each item type
- Be thorough but not excessive
- Use the EXACT measurements provided by the user when available

Labor COST rates reference (BASE - multiply by ${regionInfo.costMultiplier} for ${regionInfo.region}):
- General labor: $35-50/hour (cost)
- Skilled trades (electrical, plumbing): $65-95/hour (cost)
- Specialty (tile, cabinet): $55-75/hour (cost)

Suggested markup percentages by item type:
- Labor: 40-50% markup
- Materials: 25-35% markup
- Equipment: 30-40% markup
- Permits: 10-15% markup (or pass-through)
- Assembly: 35-45% markup

Material cost considerations for ${regionInfo.region}:
- Account for delivery costs to this area
- Use pricing appropriate for local suppliers

Always return valid JSON matching the exact schema requested.`;

    const userPrompt = `Generate a detailed estimate scope for the following project:

Project Type: ${projectType || 'Home Improvement'}
Job Location: ${jobAddress || 'California'}
${zipCode ? `ZIP Code: ${zipCode} (${regionInfo.region})` : ''}
Default Markup: ${defaultMarkupPercent || 35}%

DETAILED WORK SCOPE FROM CUSTOMER:
${workScopeDescription || projectDescription || 'General home improvement project'}

${existingGroups?.length > 0 ? `\nExisting scope areas (already added, enhance or add complementary items): ${existingGroups.join(', ')}` : ''}

INSTRUCTIONS:
1. Parse the work scope description carefully - extract ALL measurements, quantities, and specifications mentioned
2. Apply ${regionInfo.region} pricing (${regionInfo.costMultiplier}x multiplier on base rates)
3. Return COST values (what you pay), not selling prices - the system will apply markup
4. Include realistic material costs from major suppliers in the area
5. Add appropriate permit fees for ${regionInfo.region}
6. Group items logically by work area
7. Include suggested markup percentages for each item based on type

CRITICAL - UNIT COST CALCULATION:
- The "cost" field is the UNIT COST (cost per single unit), NOT the total cost
- For labor: If 8 hours of work costs $800 total, the unit cost is $100/hour (quantity: 8, unit: "hours", cost: 100)
- For materials: If 77 sqft of countertop costs $4,620 total, the unit cost is $60/sqft (quantity: 77, unit: "sqft", cost: 60)
- For cabinets: If 38 linear ft of cabinets costs $11,400 total, the unit cost is $300/linear ft (quantity: 38, unit: "linear ft", cost: 300)
- The system will calculate: total = quantity × cost × (1 + markup_percent/100)

Return a JSON object with this exact structure:
{
  "groups": [
    {
      "group_name": "Area name (e.g., Kitchen, Bathroom)",
      "description": "Brief description of work in this area",
      "items": [
        {
          "item_type": "labor|material|equipment|permit|assembly",
          "description": "Detailed item description with specs",
          "quantity": number (use exact quantities from scope when provided),
          "unit": "hours|sqft|linear ft|each|set|unit",
          "cost": number (UNIT COST - cost per 1 unit, NOT total. System multiplies by quantity),
          "markup_percent": number (suggested markup: labor 45%, materials 30%, equipment 35%, permits 12%),
          "is_taxable": boolean (materials taxable, labor not taxable in CA)
        }
      ]
    }
  ],
  "payment_schedule": [
    {
      "phase_name": "string - Name the phase based on the actual project work, NOT 'Deposit'. Examples: 'Materials & Ordering' for material-heavy jobs, 'Mobilization' for large projects, 'Pre-Construction' for remodels, 'Roof Materials' for roofing, 'Cabinet Order' for kitchens. Be creative and specific to the job scope.",
      "percent": number,
      "due_type": "on_approval|milestone|date",
      "description": "When this payment is due"
    }
  ],
  "suggested_deposit_percent": number (typically 30-50% depending on project size),
  "suggested_tax_rate": 9.5,
  "notes": "Include note about ${regionInfo.region} pricing and any regional considerations",
  "first_payment_name": "string - A short, project-specific name for the initial payment. DO NOT use 'Deposit'. Instead, name it after what the money funds: 'Materials & Scheduling', 'Cabinet Order', 'Roof Materials', 'Mobilization', 'Pre-Construction', 'Initial Materials', etc. Be specific to this job's scope."
}

EXAMPLES OF CORRECT UNIT COSTS (adjusted for ${regionInfo.region}):
- General labor: $45-60/hour (unit cost)
- Skilled trades labor: $75-110/hour (unit cost)
- Pre-fab cabinets: $200-400/linear ft (unit cost)
- Quartz countertop with install: $60-120/sqft (unit cost)
- Drywall finish labor: $2-4/sqft (unit cost)
- Paint labor: $1.50-3/sqft (unit cost)
- Demolition labor: $35-55/hour (unit cost)

Be specific and detailed. Include 3-6 groups with 3-8 items each based on the project scope.
Use the EXACT measurements from the work scope description when provided.`;

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
        temperature: 0.2,
        max_tokens: 4000,
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
