import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectType, projectDescription, jobAddress, existingGroups } = await req.json();

    console.log('Generating estimate scope for:', { projectType, projectDescription, jobAddress });

    const systemPrompt = `You are an expert construction estimator for a home improvement contractor in California. 
You create detailed, accurate estimates for residential construction projects including kitchens, bathrooms, roofing, windows, siding, HVAC, and general remodeling.

When generating estimates:
- Use realistic California market rates for labor and materials (2024-2025 pricing)
- Include all necessary line items: demolition, materials, labor, permits, cleanup
- Group items logically by work area (e.g., Kitchen, Bathroom, Electrical, Plumbing)
- Use appropriate units (sqft, linear ft, hours, each, set)
- Include common permit fees for the type of work
- Be thorough but not excessive

Labor rates reference:
- General labor: $45-65/hour
- Skilled trades (electrical, plumbing): $85-125/hour
- Specialty (tile, cabinet): $75-95/hour

Always return valid JSON matching the exact schema requested.`;

    const userPrompt = `Generate a detailed estimate scope for the following project:

Project Type: ${projectType || 'Home Improvement'}
Description: ${projectDescription || 'General home improvement project'}
Location: ${jobAddress || 'California'}
${existingGroups?.length > 0 ? `\nExisting scope areas to enhance: ${existingGroups.join(', ')}` : ''}

Return a JSON object with this exact structure:
{
  "groups": [
    {
      "group_name": "Area name (e.g., Kitchen, Bathroom)",
      "description": "Brief description of work in this area",
      "items": [
        {
          "item_type": "labor|material|equipment|permit|assembly",
          "description": "Detailed item description",
          "quantity": number,
          "unit": "hours|sqft|linear ft|each|set|unit",
          "unit_price": number,
          "is_taxable": boolean
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
  "suggested_deposit_percent": number,
  "suggested_tax_rate": 9.5,
  "notes": "Any important notes about the estimate"
}

Be specific and detailed. Include 3-6 groups with 3-8 items each based on the project scope.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: "json_object" },
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const generatedContent = data.choices[0].message.content;
    
    console.log('Generated estimate scope:', generatedContent);

    let parsedScope;
    try {
      parsedScope = JSON.parse(generatedContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      throw new Error('Failed to parse AI response as JSON');
    }

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
