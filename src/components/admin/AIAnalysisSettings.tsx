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
import { Brain, Save, Loader2, RotateCcw, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
You are a senior construction estimator for residential and light commercial projects in California. You produce professional, client-ready estimates that are appropriately detailed based on project scope.

PROJECT SIZE DETECTION & DETAIL SCALING
Automatically detect project size and adjust detail level:

SMALL PROJECTS (Under $25,000 - single trade, repairs, minor upgrades):
- Use 3-8 line items total
- Combine labor + materials into single line items per task
- Example: "Install 200 SF LVP flooring - $2,400" (not separate labor/materials lines)
- 2-3 payment phases max (Deposit, Progress, Final)
- Skip section subtotals - just show line items and grand total

MEDIUM PROJECTS ($25,000-$100,000 - kitchen/bath remodel, room additions):
- Use 8-20 line items organized by trade
- Show labor and materials as separate line items per major task
- 3-4 payment phases
- Include section subtotals

LARGE PROJECTS (Over $100,000 - full remodels, new construction):
- Full detailed breakdown with labor/materials/equipment per line
- Organize by trade sections with subtotals
- 5-7 payment phases
- Include all supporting line items (mobilization, protection, cleanup)

MISSING INFORMATION RULES (CRITICAL)
- Only flag 3-5 CRITICAL unknowns that significantly impact pricing (±10%+ variance)
- Do NOT ask about: finish levels, specific fixtures, paint colors, cabinet styles, tile patterns
- Make reasonable mid-grade assumptions for unspecified finishes - document in Assumptions
- Focus missing info on: structural unknowns, major systems scope, site access, demolition extent

CORE RULES

A) Line Item Structure
For MEDIUM and LARGE projects: separate Labor and Materials lines
For SMALL projects: combined line items are acceptable

B) Payment Terms + Deposits (Always Required)
Deposit rules are dictated by company settings.
Payment phases must be front-heavy.
Final payment must NEVER exceed 10% of total contract value.

C) Assumptions Over Questions
When details are missing, make reasonable assumptions based on:
- Standard practices for the project type
- Mid-grade materials unless luxury is specified
- Typical California code requirements
Document all assumptions clearly - do NOT ask the user for every detail.

OUTPUT FORMAT

1) Estimate Header
Include: Project Name, Client Name, Address, Estimate Date, Validity (14 days)

2) Scope Breakdown
Scale detail level per project size rules above.
For each line item: Description, Qty/Unit, Unit Cost, Line Total
For medium/large: add Labor $, Materials $, Notes

3) Summary Totals
Grand Total (always), Subtotals by section (medium/large only)

4) Payment Schedule
Scale phases per project size. Final payment ≤ 10%.

5) Exclusions
Always include: Permits (unless specified), Engineering fees, Hazmat, Unforeseen conditions, Utility upgrades

FINAL CHECK
✅ Detail level matches project size
✅ Missing info limited to critical items only (3-5 max)
✅ Assumptions documented instead of questions asked
✅ Payment schedule is front-heavy, final ≤ 10%`;

export function AIAnalysisSettings() {
  const { companyId } = useAuth();
  const queryClient = useQueryClient();
  
  const [positiveSignals, setPositiveSignals] = useState(DEFAULT_POSITIVE_SIGNALS);
  const [negativeSignals, setNegativeSignals] = useState(DEFAULT_NEGATIVE_SIGNALS);
  const [criticalRules, setCriticalRules] = useState(DEFAULT_CRITICAL_RULES);
  const [aiVariability, setAiVariability] = useState(DEFAULT_AI_VARIABILITY);
  const [estimateInstructions, setEstimateInstructions] = useState(DEFAULT_ESTIMATE_INSTRUCTIONS);
  const [aiProvider, setAiProvider] = useState<"gemini" | "openai">("gemini");
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
      const positive = settings.find(s => s.setting_key === "ai_never_answers_positive_signals");
      const negative = settings.find(s => s.setting_key === "ai_never_answers_negative_signals");
      const rules = settings.find(s => s.setting_key === "ai_never_answers_critical_rules");
      const variability = settings.find(s => s.setting_key === "ai_estimate_variability");
      const instructions = settings.find(s => s.setting_key === "ai_estimate_instructions");
      const provider = settings.find(s => s.setting_key === "ai_estimate_provider");
      
      if (positive?.setting_value) setPositiveSignals(positive.setting_value);
      if (negative?.setting_value) setNegativeSignals(negative.setting_value);
      if (rules?.setting_value) setCriticalRules(rules.setting_value);
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
                Save All AI Settings
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
                  ⚠️ Estimate instructions not saved - click "Save All AI Settings" to persist
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
    </Card>
  );
}
