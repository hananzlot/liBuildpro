import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Brain, Save, Loader2, RotateCcw } from "lucide-react";

const DEFAULT_POSITIVE_SIGNALS = `- Scope of work being discussed or documented
- Price/estimate mentioned
- Customer providing information (emails, sketches, details)
- Any meeting or appointment that happened successfully
- Customer replying or responding in any way
- Salesperson getting project details`;

const DEFAULT_NEGATIVE_SIGNALS = `- Multiple consecutive failed contact attempts with no successful contact after
- "No answer", "voicemail", "didn't pick up" as the latest activity
- "Left message", "no response", "no callback" with no follow-up success`;

const DEFAULT_CRITICAL_RULES = `1. RECENCY IS PARAMOUNT - The most recent notes (especially from today or last 2-3 days) COMPLETELY OVERRIDE older notes
2. If there are ANY recent notes showing positive engagement (scope of work, estimates, pricing, scheduling, customer responding), this is NOT a "Never Answers" case
3. Only mark as "Never Answers" if the MOST RECENT activity still shows no contact`;

const DEFAULT_AI_VARIABILITY = 0.2;

const DEFAULT_ESTIMATE_INSTRUCTIONS = `ROLE
You are a senior construction estimator for high-end residential and light commercial projects in California. You produce professional, client-ready estimates that are extremely detailed, clearly structured, and easy to approve.

CORE RULES (NON-NEGOTIABLE)

A) Line Item Structure (Always Required)
Every scope item MUST include separate lines for:
- Labor
- Materials
- (Optional but preferred) Equipment/Disposal
- (Optional) Subcontractor

You must never group a task into one lump sum line without a Labor/Materials breakdown.
Use clear scope descriptions and include quantities, units, and unit pricing wherever possible.
If any detail is missing, create reasonable assumptions and label them as ASSUMPTIONS.

B) Payment Terms + Deposits (Always Required)
Deposit rules are dictated by the company settings.
You MUST include a Deposit line in the estimate.
You MUST display the deposit as: Deposit Due at Signing: $X (calculated per company settings)
If the deposit setting value is not provided, you MUST insert a placeholder: Deposit Due at Signing: [AUTO-CALCULATED PER COMPANY SETTINGS]

Payment phases must be front-heavy.
Payments should be structured so the contractor is paid early for mobilization, demo, rough work, materials ordering, and progress.
The final payment must NEVER exceed 10% of the total contract value.
If the user doesn't specify phases, you must generate them based on project type and ensure the final payment ≤ 10%.

OUTPUT FORMAT (MANDATORY)

1) Estimate Header
Include: Project Name, Client Name (if provided), Address (if provided), Estimate Date, Estimate # (generate one if missing), Prepared By, Validity period (ex: 14 days)

2) Scope Breakdown (Detailed Line Items)
Organize into clean sections (example: Demo, Framing, Electrical, Plumbing, HVAC, Drywall, Paint, Flooring, Cabinets, Tile, Fixtures, Finish Carpentry, Cleanup).

For each line item, use this format:
Line Item Name:
Description (Included + Excluded):
Qty / Unit:
Unit Cost:
Line Total:

Cost Breakdown (REQUIRED):
- Labor: $____ (include hours x rate when possible)
- Materials: $____
- Equipment/Disposal: $____
- Subcontractor: $____
- Subtotal: $____
- Notes / Assumptions:

3) Section Subtotals
At the end of each section: Section Subtotal

4) Summary Totals
Provide: Total Labor, Total Materials, Total Subcontractors, Total Equipment/Disposal, Total Direct Cost, Overhead & Profit, Contingency (optional), Grand Total

5) Deposits + Payment Schedule (MANDATORY)
You MUST include this section in every estimate:
Deposit Due at Signing: $X (calculated per company settings) OR placeholder if not provided.

Payment Phases (Front-Heavy):
- Phase 1: Deposit / Mobilization / Scheduling – $____ (___%)
- Phase 2: Demo + Rough Prep – $____ (___%)
- Phase 3: Rough Trades (Plumbing/Electrical/HVAC) – $____ (___%)
- Phase 4: Drywall + Prime + Waterproofing – $____ (___%)
- Phase 5: Finishes (Tile/Flooring/Cabinets/Paint) – $____ (___%)
- Phase 6: Trim + Fixtures + Punchlist – $____ (___%)
- Final Payment (Completion/Closeout): $____ (≤ 10% REQUIRED)

Rules: Final payment must never exceed 10% of the total contract. If your phase totals don't equal 100%, you must correct them.

6) Exclusions + Clarifications (Mandatory)
Always include exclusions such as: Permits and city fees (unless included), Engineering/Architect fees (unless included), Hazardous materials / asbestos remediation (unless included), Unforeseen structural issues behind walls, Utility upgrades unless specified, After-hours work unless specified

7) Change Order Policy
Any work outside scope requires a written change order and may affect timeline/cost.

Estimator Intelligence (Auto-Include When Relevant)
Always add line items when applicable: Mobilization, Site protection (floor/wall protection, plastic, dust barriers), Debris hauling / dumpster, Daily cleanup + final cleanup, Project management + supervision, Patching and paint touch-ups after rough trades

FINAL QUALITY CHECK (DO THIS EVERY TIME)
Before outputting, verify:
✅ Every line item includes Labor + Materials
✅ Deposit section exists and references company settings
✅ Payment schedule is front-heavy
✅ Final payment ≤ 10%
✅ No missing totals or incorrect phase math
If anything fails, fix it before presenting the estimate.`;

export function AIAnalysisSettings() {
  const { companyId } = useAuth();
  const queryClient = useQueryClient();
  
  const [positiveSignals, setPositiveSignals] = useState(DEFAULT_POSITIVE_SIGNALS);
  const [negativeSignals, setNegativeSignals] = useState(DEFAULT_NEGATIVE_SIGNALS);
  const [criticalRules, setCriticalRules] = useState(DEFAULT_CRITICAL_RULES);
  const [aiVariability, setAiVariability] = useState(DEFAULT_AI_VARIABILITY);
  const [estimateInstructions, setEstimateInstructions] = useState(DEFAULT_ESTIMATE_INSTRUCTIONS);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch existing settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ["ai-analysis-settings", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("setting_key, setting_value")
        .eq("company_id", companyId)
        .in("setting_key", [
          "ai_never_answers_positive_signals",
          "ai_never_answers_negative_signals",
          "ai_never_answers_critical_rules",
          "ai_estimate_variability",
          "ai_estimate_instructions"
        ]);
      
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  // Load settings into state when fetched
  useEffect(() => {
    if (settings) {
      const positive = settings.find(s => s.setting_key === "ai_never_answers_positive_signals");
      const negative = settings.find(s => s.setting_key === "ai_never_answers_negative_signals");
      const rules = settings.find(s => s.setting_key === "ai_never_answers_critical_rules");
      const variability = settings.find(s => s.setting_key === "ai_estimate_variability");
      const instructions = settings.find(s => s.setting_key === "ai_estimate_instructions");
      
      if (positive?.setting_value) setPositiveSignals(positive.setting_value);
      if (negative?.setting_value) setNegativeSignals(negative.setting_value);
      if (rules?.setting_value) setCriticalRules(rules.setting_value);
      if (variability?.setting_value) setAiVariability(parseFloat(variability.setting_value) || DEFAULT_AI_VARIABILITY);
      if (instructions?.setting_value) setEstimateInstructions(instructions.setting_value);
    }
  }, [settings]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No company ID");

      const settingsToUpsert = [
        {
          company_id: companyId,
          setting_key: "ai_never_answers_positive_signals",
          setting_value: positiveSignals,
          setting_type: "text",
          description: "Signals that indicate customer IS reachable (do NOT mark as Never Answers)",
          updated_at: new Date().toISOString(),
        },
        {
          company_id: companyId,
          setting_key: "ai_never_answers_negative_signals",
          setting_value: negativeSignals,
          setting_type: "text",
          description: "Signals that indicate customer is unreachable (only counts if most recent)",
          updated_at: new Date().toISOString(),
        },
        {
          company_id: companyId,
          setting_key: "ai_never_answers_critical_rules",
          setting_value: criticalRules,
          setting_type: "text",
          description: "Critical rules for AI analysis of Never Answers opportunities",
          updated_at: new Date().toISOString(),
        },
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
      ];

      for (const setting of settingsToUpsert) {
        const { error } = await supabase
          .from("company_settings")
          .upsert(setting, { onConflict: "company_id,setting_key" });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-analysis-settings", companyId] });
      setHasChanges(false);
      toast.success("AI analysis settings saved");
    },
    onError: (error: Error) => {
      toast.error(`Failed to save settings: ${error.message}`);
    },
  });

  const handleReset = () => {
    setPositiveSignals(DEFAULT_POSITIVE_SIGNALS);
    setNegativeSignals(DEFAULT_NEGATIVE_SIGNALS);
    setCriticalRules(DEFAULT_CRITICAL_RULES);
    setAiVariability(DEFAULT_AI_VARIABILITY);
    setEstimateInstructions(DEFAULT_ESTIMATE_INSTRUCTIONS);
    setHasChanges(true);
  };

  const handleChange = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setHasChanges(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          AI "Never Answers" Analysis Settings
        </CardTitle>
        <CardDescription>
          Customize how the AI analyzes contact notes to determine if an opportunity should be marked as "Never Answers". 
          The AI prioritizes recent notes over older ones.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
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
              <Label>Critical Rules</Label>
              <Textarea
                value={criticalRules}
                onChange={(e) => handleChange(setCriticalRules)(e.target.value)}
                rows={5}
                className="font-mono text-sm"
                placeholder="Rules the AI must follow..."
              />
              <p className="text-xs text-muted-foreground">
                These rules guide the AI's decision-making process. Recency should always be emphasized.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Positive Engagement Signals (Customer IS Reachable)</Label>
              <Textarea
                value={positiveSignals}
                onChange={(e) => handleChange(setPositiveSignals)(e.target.value)}
                rows={6}
                className="font-mono text-sm"
                placeholder="One signal per line..."
              />
              <p className="text-xs text-muted-foreground">
                If recent notes contain any of these signals, the AI will NOT mark the opportunity as "Never Answers".
              </p>
            </div>

            <div className="space-y-2">
              <Label>Negative Signals (Customer Unreachable)</Label>
              <Textarea
                value={negativeSignals}
                onChange={(e) => handleChange(setNegativeSignals)(e.target.value)}
                rows={4}
                className="font-mono text-sm"
                placeholder="One signal per line..."
              />
              <p className="text-xs text-muted-foreground">
                These signals indicate unreachability, but ONLY count if they are the MOST RECENT activity.
              </p>
            </div>

            <div className="border-t pt-6 space-y-2">
              <Label className="text-base font-semibold">Estimate Generation Instructions</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Custom instructions that guide how AI generates detailed estimates. These rules control line item structure, payment terms, and formatting.
              </p>
              <Textarea
                value={estimateInstructions}
                onChange={(e) => handleChange(setEstimateInstructions)(e.target.value)}
                rows={20}
                className="font-mono text-sm"
                placeholder="Enter custom instructions for AI estimate generation..."
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!hasChanges || saveMutation.isPending}
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Settings
              </Button>
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={saveMutation.isPending}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset to Defaults
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
