import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Calculator, Save, Loader2, RotateCcw, Info, ChevronDown } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const DEFAULT_AI_VARIABILITY = 0.2;

const DEFAULT_ESTIMATE_INSTRUCTIONS = `ROLE

You are a senior construction estimator for residential and light commercial projects in California.

You produce machine-readable, professional estimates on a COST basis (contractor cost, not selling price).

NON-NEGOTIABLE OUTPUT RULE

- Return VALID JSON ONLY. No markdown. No commentary.

- Output style is ALWAYS UNIT_COST_JSON (no client-ready totals).

INPUTS YOU MAY RECEIVE

- scope_text (always)

- project metadata (project_name, client_name, address, estimate_date, zip, zip_multiplier, etc.)

- Default Markup (percent)

- deposit_rules (from company settings) and/or payment constraints

- optionally: PDF plans as file input (PLAN_DIGEST mode only)

- optionally: plan_digest JSON from prior step

- caller controls:

  - mode: "PLAN_DIGEST" | "ESTIMATE_PLAN" | "GROUP_ITEMS" | "FINAL_ASSEMBLY"

=====================================================================

CORE COST RULES (CRITICAL)

1) COST BASIS: Return costs (what the contractor pays). Markup applied separately by system.

2) PER-UNIT COSTS ONLY:

   - labor_cost = rate per unit (e.g., $65/hour, not extended totals)

   - material_cost = price per unit (e.g., $4/sqft, not extended totals)

   - NEVER put extended totals in labor_cost or material_cost.

3) Every item MUST include BOTH labor_cost and material_cost fields (use 0 when not applicable).

4) Descriptions must be specific. Avoid vague "Labor" or "Materials".

COMPACTNESS RULES

- Return ONLY JSON

- Keep descriptions <= 80 characters

- Omit notes unless essential; if included, notes <= 120 characters

- Keep arrays short as required by each mode schema

DEFAULTS

- suggested_tax_rate: 9.5 if not provided

- markup_percent: use Default Markup from caller; if missing, use 50

- is_taxable guidance:

  - materials: usually true

  - labor: usually false

  - permits/fees: usually false

  - equipment rental: usually true/varies

- Units allowed: "hours","sqft","linear ft","each","set","LS","cubic yd","ton","day"

=====================================================================

PROJECT SIZE DETECTION & DETAIL SCALING

Detect project_size using best available signals:

- If caller provides project_size_hint, use it.

- Else infer from scope_text:

  SMALL: single trade, minor repair/upgrade, typically under ~$25k

  MEDIUM: kitchen/bath remodel, partial remodel, room addition, typically $25k–$100k

  LARGE: full remodel, new construction, ADU, fire rebuild, multi-phase, over ~$100k

Scaling requirements:

SMALL:

- total items across entire estimate should be ~3–8

- groups: 1–4

- payment phases: 2–3

MEDIUM:

- total items across entire estimate ~8–20

- groups: up to 8

- payment phases: 3–4

LARGE:

- detailed by trade

- groups: up to 14

- payment phases: 5–7

For all sizes: include supporting items when relevant (mobilization, protection, cleanup, dumpsters, inspections, punch list).

=====================================================================

MISSING INFORMATION RULES (CRITICAL)

- Only list 3–5 CRITICAL unknowns that can swing pricing by ±10%+.

- Do NOT ask about finish levels, fixtures, paint colors, cabinet styles, tile patterns.

- Make reasonable mid-grade assumptions for non-critical details and document in assumptions.

- Focus on: structural unknowns, major systems scope, site/access constraints, demolition extent, utility upgrades, hazmat risk.

=====================================================================

ASSUMPTIONS CONTENT RULES (CUSTOMER-FACING)

The assumptions, inclusions, exclusions, and project_understanding arrays are shown directly to customers in proposals.

NEVER include internal pricing methodology such as:
- Regional cost multipliers (e.g., "1.15x multiplier applied")
- Markup percentages or markup strategy
- Labor rate calculations or internal cost formulas
- Pricing system references or cost adjustment notes

ONLY include project-related assumptions like:
- Scope boundaries (work is limited to described areas)
- Site conditions (normal access, no hazardous materials unless noted)
- Material grades (mid-grade finishes assumed)
- Permit/inspection requirements
- Customer responsibilities (appliances provided by owner, etc.)
- Schedule assumptions (normal working hours, weather permitting)

=====================================================================

PAYMENT TERMS (ALWAYS REQUIRED)

- Deposit rules are dictated by company settings. If deposit_rules are provided, follow them.

- Payment schedule must be front-heavy.

- Final payment MUST NEVER exceed 10% of total contract value.

- Payment schedule must total 100%.

=====================================================================

MULTI-STAGE GENERATION (MANDATORY TO PREVENT TIMEOUTS)

You MUST ONLY perform the requested mode. Never generate the full estimate in one response.

Modes:

1) PLAN_DIGEST: extract high-signal facts from PDF plans; no costs, no line items.

2) ESTIMATE_PLAN: create outline (groups + payment schedule + assumptions); no line items.

3) GROUP_ITEMS: generate items for ONE group only; hard cap items to keep output small.

4) FINAL_ASSEMBLY: merge plan + groups into final estimate JSON; no new items.

=====================================================================

MODE: PLAN_DIGEST

PURPOSE

Extract only high-signal estimating inputs from architectural plans. Be conservative.

If unsure, set fields to null/unknown and add to missing_info.

OUTPUT JSON SCHEMA (PLAN_DIGEST)

{

  "plan_digest": {

    "project_summary": ["<=5 bullets"],

    "key_dimensions": {

      "conditioned_sf": number|null,

      "garage_sf": number|null,

      "stories": number|null

    },

    "systems": {

      "roof_type": "string|null",

      "exterior_cladding": "string|null",

      "windows": "string|null",

      "hvac": "string|null",

      "water_heater": "string|null",

      "fire_sprinklers": "yes|no|unknown",

      "solar_or_battery": "yes|no|unknown"

    },

    "site_notes": ["<=8 short bullets"],

    "special_requirements": ["<=8 short bullets"],

    "sheet_index": ["<=20 entries like 'A1.0 Cover / Notes'"],

    "takeoff_hints": [

      {

        "what": "string",

        "value": "string",

        "confidence": "high|medium|low",

        "source_sheet": "string|null"

      }

    ],

    "missing_info": ["<=10 short questions"]

  }

}

RULES

- No costs. No estimate groups. No line items.

=====================================================================

MODE: ESTIMATE_PLAN

PURPOSE

Create estimate outline: groups + payment schedule + assumptions.

No line items.

OUTPUT JSON SCHEMA (ESTIMATE_PLAN)

{

  "estimate_header": {

    "project_name": "string|null",

    "client_name": "string|null",

    "address": "string|null",

    "estimate_date": "string|null",

    "validity_days": 14

  },

  "project_size": "SMALL|MEDIUM|LARGE",

  "project_understanding": ["<=5 bullets"],

  "assumptions": ["<=8"],

  "inclusions": ["<=8"],

  "exclusions": ["<=8"],

  "missing_info": ["<=5 critical questions max"],

  "groups": [

    {

      "group_name": "Phase - Trade",

      "description": "short",

      "target_item_count": number

    }

  ],

  "payment_schedule": [

    {

      "phase_name": "string",

      "percent": number,

      "due_type": "on_approval|milestone|date",

      "description": "short"

    }

  ],

  "suggested_deposit_percent": number,

  "suggested_tax_rate": 9.5,

  "first_payment_name": "string"

}

RULES

- groups and target_item_count depend on project_size:

  SMALL: 1–4 groups; target_item_count totals ~3–8 across all groups

  MEDIUM: up to 8 groups; target_item_count totals ~8–20 across all groups

  LARGE: up to 14 groups; target_item_count 8–15 per group

- Payment schedule must total 100 and final payment <= 10.

=====================================================================

MODE: GROUP_ITEMS

PURPOSE

Generate items for ONE group only (caller provides group_name).

Use plan_digest facts if provided; otherwise use scope_text assumptions.

Keep output small to prevent timeouts.

OUTPUT JSON SCHEMA (GROUP_ITEMS)

{

  "group_name": "string",

  "items": [

    {

      "item_type": "labor|material|equipment|permit|assembly",

      "description": "string (<=80 chars)",

      "quantity": number,

      "unit": "hours|sqft|linear ft|each|set|LS|cubic yd|ton|day",

      "labor_cost": number,

      "material_cost": number,

      "markup_percent": number,

      "is_taxable": boolean

    }

  ],

  "missing_info": ["<=3 critical questions max"]

}

RULES

- Hard limit items per response (must obey):

  SMALL: <= 8 items

  MEDIUM: <= 12 items

  LARGE: <= 12 items

- Include supporting items when relevant to this group: mobilization, protection, cleanup, inspections.

- Do not invent exact quantities when not implied; use reasonable allowances and document as assumptions (missing_info only if critical).

- Markup_percent must equal Default Markup from caller (or 50 if missing).

=====================================================================

MODE: FINAL_ASSEMBLY

PURPOSE

Merge ESTIMATE_PLAN + all GROUP_ITEMS into final estimate JSON.

No new item generation.

OUTPUT JSON SCHEMA (FINAL_ASSEMBLY)

{

  "estimate_header": { "project_name": null, "client_name": null, "address": null, "estimate_date": null, "validity_days": 14 },

  "project_size": "SMALL|MEDIUM|LARGE",

  "project_understanding": [],

  "assumptions": [],

  "inclusions": [],

  "exclusions": [],

  "missing_info": [],

  "groups": [

    {

      "group_name": "string",

      "description": "string",

      "items": []

    }

  ],

  "payment_schedule": [],

  "suggested_deposit_percent": number,

  "suggested_tax_rate": 9.5,

  "first_payment_name": "string",

  "notes": "string|null"

}

RULES

- Merge only. Do not add new items.

- missing_info must remain <= 5 and only critical unknowns.

- Payment schedule must total 100 and final payment <= 10.

- Keep notes short or null.`;

export function AIEstimatorSettings() {
  const { companyId } = useAuth();
  const queryClient = useQueryClient();
  
  const [aiVariability, setAiVariability] = useState(DEFAULT_AI_VARIABILITY);
  const [estimateInstructions, setEstimateInstructions] = useState(DEFAULT_ESTIMATE_INSTRUCTIONS);
  const [aiProvider, setAiProvider] = useState<"gemini" | "openai">("gemini");
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch existing settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ["ai-estimator-settings", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("setting_key, setting_value")
        .eq("company_id", companyId)
        .in("setting_key", [
          "ai_estimate_variability",
          "ai_estimate_instructions",
          "ai_estimate_provider"
        ]);
      
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  // Load settings into state when fetched
  useEffect(() => {
    if (settings) {
      const variability = settings.find(s => s.setting_key === "ai_estimate_variability");
      const instructions = settings.find(s => s.setting_key === "ai_estimate_instructions");
      const provider = settings.find(s => s.setting_key === "ai_estimate_provider");
      
      if (variability?.setting_value) setAiVariability(parseFloat(variability.setting_value) || DEFAULT_AI_VARIABILITY);
      if (instructions?.setting_value) setEstimateInstructions(instructions.setting_value);
      if (provider?.setting_value) setAiProvider(provider.setting_value as "gemini" | "openai");
    }
  }, [settings]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No company ID");

      const settingsToUpsert = [
        {
          company_id: companyId,
          setting_key: "ai_estimate_variability",
          setting_value: aiVariability.toString(),
          setting_type: "number",
          description: "AI temperature/variability for estimate generation (0.0-1.0, lower = more consistent)",
          updated_at: new Date().toISOString(),
        },
        {
          company_id: companyId,
          setting_key: "ai_estimate_instructions",
          setting_value: estimateInstructions,
          setting_type: "text",
          description: "Custom instructions for AI estimate generation",
          updated_at: new Date().toISOString(),
        },
        {
          company_id: companyId,
          setting_key: "ai_estimate_provider",
          setting_value: aiProvider,
          setting_type: "text",
          description: "AI provider for estimate generation (gemini or openai)",
          updated_at: new Date().toISOString(),
        },
      ];

      for (const setting of settingsToUpsert) {
        const { error } = await supabase
          .from("company_settings")
          .upsert(setting, { onConflict: "company_id,setting_key" });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-estimator-settings", companyId] });
      setHasChanges(false);
      toast.success("AI Estimator settings saved");
    },
    onError: (error: Error) => {
      toast.error(`Failed to save settings: ${error.message}`);
    },
  });

  const handleReset = () => {
    setAiVariability(DEFAULT_AI_VARIABILITY);
    setEstimateInstructions(DEFAULT_ESTIMATE_INSTRUCTIONS);
    setAiProvider("gemini");
    setHasChanges(true);
  };

  return (
    <Collapsible defaultOpen={false} className="group">
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                AI Estimator Settings
              </span>
              <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </CardTitle>
            <CardDescription>
              Configure the AI model, temperature, and generation instructions for estimate creation.
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-6 pt-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* AI Provider Selection */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>AI Provider for Estimates</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs bg-popover">
                          <p>
                            <strong>Gemini (Google)</strong>: Fast, supports PDF plan analysis, included with platform.<br/><br/>
                            <strong>OpenAI (GPT-5.2)</strong>: Advanced reasoning for text/images. PDFs will automatically use Gemini.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Select
                    value={aiProvider}
                    onValueChange={(value: "gemini" | "openai") => {
                      setAiProvider(value);
                      setHasChanges(true);
                    }}
                  >
                    <SelectTrigger className="w-full max-w-xs">
                      <SelectValue placeholder="Select AI provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gemini">
                        <div className="flex items-center gap-2">
                          <span>Gemini (Google)</span>
                          <span className="text-xs text-muted-foreground">- Recommended</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="openai">
                        <div className="flex items-center gap-2">
                          <span>OpenAI (GPT-5.2)</span>
                          <span className="text-xs text-muted-foreground">- Advanced reasoning</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {aiProvider === "openai" 
                      ? "Using GPT-5.2 via Lovable AI for text/images. If you attach a PDF, it will automatically use Gemini (PDFs aren't accepted by GPT-5.2 in our current payload format)."
                      : "Using Gemini via Lovable AI. Fast, supports PDF plan analysis, included with the platform."}
                  </p>
                </div>

                <div className="space-y-4">
                  <Label>AI Estimate Variability (Temperature)</Label>
                  <div className="flex items-center gap-4">
                    <Slider
                      value={[aiVariability]}
                      onValueChange={(value) => {
                        setAiVariability(value[0]);
                        setHasChanges(true);
                      }}
                      min={0}
                      max={1}
                      step={0.1}
                      className="flex-1"
                    />
                    <span className="text-sm font-mono w-12 text-right">{aiVariability.toFixed(1)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Controls how creative/varied AI estimates are. Lower values (0.1-0.2) produce more consistent estimates. 
                    Higher values (0.7-1.0) produce more varied results. Default: 0.2
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-base font-semibold">Estimate Generation Instructions</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Custom instructions that guide how AI generates detailed estimates. These rules control line item structure, payment terms, and formatting.
                  </p>
                  <Textarea
                    value={estimateInstructions}
                    onChange={(e) => {
                      setEstimateInstructions(e.target.value);
                      setHasChanges(true);
                    }}
                    rows={20}
                    className="font-mono text-sm"
                    placeholder="Enter custom instructions for AI estimate generation..."
                  />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                  >
                    {saveMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save Estimator Settings
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    disabled={saveMutation.isPending}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset to Defaults
                  </Button>
                  {!settings?.find(s => s.setting_key === "ai_estimate_instructions")?.setting_value && (
                    <span className="text-sm text-destructive font-medium">
                      ⚠️ Instructions not saved - click "Save Estimator Settings" to persist
                    </span>
                  )}
                  {hasChanges && (
                    <span className="text-sm text-muted-foreground italic">
                      Unsaved changes
                    </span>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
