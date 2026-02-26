import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfUrl } = await req.json();
    if (!pdfUrl) {
      return new Response(JSON.stringify({ error: "pdfUrl is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI gateway is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the PDF and convert to base64
    console.log("Fetching PDF from:", pdfUrl);
    const pdfResp = await fetch(pdfUrl);
    if (!pdfResp.ok) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch PDF: ${pdfResp.status}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pdfBuffer = await pdfResp.arrayBuffer();
    const bytes = new Uint8Array(pdfBuffer);
    let binary = "";
    const chunkSize = 65536; // 64KB chunks for speed
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
      binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
    }
    const pdfBase64 = btoa(binary);

    console.log(`PDF fetched, size: ${pdfBuffer.byteLength} bytes`);

    // Use Gemini vision to extract payment phases from the PDF
    const systemPrompt = `You are a construction contract analyst. Your job is to extract the payment schedule / payment phases from a construction contract PDF.

Look for sections like "Schedule 2 – Payment Schedule", "Progress Payments", "Payment Terms", "Draw Schedule", "Milestone Payments", or similar.

For each payment phase found, extract:
- phase_name: A short name like "Deposit", "Foundation", "Framing", "Rough-In", "Drywall", "Final", etc.
- description: The full description from the contract (e.g., "Due upon signing of contract", "Due upon completion of framing")
- amount: The dollar amount (numeric only, no $ or commas). If it's a percentage, calculate the dollar amount if the total contract value is available, otherwise return the percentage as a string like "10%".
- display_order: The order in which the phase appears (1, 2, 3, etc.)

Also extract:
- total_contract_value: The total contract/agreement value if visible

Return ONLY valid JSON in this exact format:
{
  "phases": [
    {
      "phase_name": "Deposit",
      "description": "Due upon signing of contract",
      "amount": 5000,
      "display_order": 1
    }
  ],
  "total_contract_value": 50000,
  "notes": "Any relevant notes about the extraction"
}

If you cannot find payment phases, return:
{
  "phases": [],
  "total_contract_value": null,
  "notes": "Reason why no phases were found"
}`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Extract the payment phases/schedule from this construction contract PDF. Return the structured JSON.",
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:application/pdf;base64,${pdfBase64}`,
                  },
                },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "AI extraction failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content || "";

    console.log("AI raw response:", content.substring(0, 500));

    // Parse JSON from the AI response (handle markdown code blocks)
    let parsed;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
      parsed = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error("JSON parse error:", parseErr, "Raw:", content);
      return new Response(
        JSON.stringify({
          error: "Failed to parse AI response",
          raw: content.substring(0, 1000),
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Extracted ${parsed.phases?.length || 0} phases`);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-contract-phases error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
