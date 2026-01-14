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
    const { projectType, projectDescription, workScopeDescription, jobAddress, existingGroups } = await req.json();

    console.log('Generating estimate scope for:', { projectType, workScopeDescription, jobAddress });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Extract ZIP code and get regional pricing info
    const zipCode = extractZipCode(jobAddress || '');
    const regionInfo = zipCode ? getRegionFromZip(zipCode) : { region: "California", costMultiplier: 1.0, description: "Standard rates" };

    const systemPrompt = `You are an expert construction estimator for a home improvement contractor in California. 
You create detailed, accurate estimates for residential construction projects including kitchens, bathrooms, roofing, windows, siding, HVAC, and general remodeling.

IMPORTANT LOCATION-BASED PRICING:
- Job Location: ${jobAddress || 'California'}
- ZIP Code: ${zipCode || 'Not specified'}
- Region: ${regionInfo.region}
- Cost Adjustment: ${((regionInfo.costMultiplier - 1) * 100).toFixed(0)}% ${regionInfo.costMultiplier > 1 ? 'above' : 'below'} base California rates
- Note: ${regionInfo.description}

Apply the ${regionInfo.costMultiplier}x multiplier to all labor and material costs for accurate regional pricing.

When generating estimates:
- Use realistic California market rates for labor and materials (2024-2025 pricing) ADJUSTED for the specific region
- Parse the work scope description carefully for exact measurements and quantities
- Include all necessary line items: demolition, materials, labor, permits, cleanup
- Group items logically by work area (e.g., Kitchen, Bathroom, Electrical, Plumbing)
- Use appropriate units (sqft, linear ft, hours, each, set)
- Include common permit fees for the type of work (adjusted for local jurisdiction)
- Be thorough but not excessive
- Use the EXACT measurements provided by the user when available

Labor rates reference (BASE - multiply by ${regionInfo.costMultiplier} for ${regionInfo.region}):
- General labor: $45-65/hour
- Skilled trades (electrical, plumbing): $85-125/hour
- Specialty (tile, cabinet): $75-95/hour

Material cost considerations for ${regionInfo.region}:
- Account for delivery costs to this area
- Use pricing appropriate for local suppliers

Always return valid JSON matching the exact schema requested.`;

    const userPrompt = `Generate a detailed estimate scope for the following project:

Project Type: ${projectType || 'Home Improvement'}
Job Location: ${jobAddress || 'California'}
${zipCode ? `ZIP Code: ${zipCode} (${regionInfo.region})` : ''}

DETAILED WORK SCOPE FROM CUSTOMER:
${workScopeDescription || projectDescription || 'General home improvement project'}

${existingGroups?.length > 0 ? `\nExisting scope areas (already added, enhance or add complementary items): ${existingGroups.join(', ')}` : ''}

INSTRUCTIONS:
1. Parse the work scope description carefully - extract ALL measurements, quantities, and specifications mentioned
2. Apply ${regionInfo.region} pricing (${regionInfo.costMultiplier}x multiplier on base rates)
3. Include realistic material costs from major suppliers in the area
4. Add appropriate permit fees for ${regionInfo.region}
5. Group items logically by work area

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
          "unit_price": number (adjusted for ${regionInfo.region}),
          "is_taxable": boolean (materials taxable, labor not taxable in CA)
        }
      ]
    }
  ],
  "payment_schedule": [
    {
      "phase_name": "Deposit|Materials|Rough Complete|Final",
      "percent": number,
      "due_type": "on_approval|milestone|date",
      "description": "When this payment is due"
    }
  ],
  "suggested_deposit_percent": number (typically 30-50% depending on project size),
  "suggested_tax_rate": 9.5,
  "notes": "Include note about ${regionInfo.region} pricing and any regional considerations"
}

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
        temperature: 0.7,
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
