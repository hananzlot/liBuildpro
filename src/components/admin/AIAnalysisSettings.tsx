import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Brain, Save, Loader2, RotateCcw, ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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

export function AIAnalysisSettings() {
  const { companyId } = useAuth();
  const queryClient = useQueryClient();
  
  const [positiveSignals, setPositiveSignals] = useState(DEFAULT_POSITIVE_SIGNALS);
  const [negativeSignals, setNegativeSignals] = useState(DEFAULT_NEGATIVE_SIGNALS);
  const [criticalRules, setCriticalRules] = useState(DEFAULT_CRITICAL_RULES);
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
      
      if (positive?.setting_value) setPositiveSignals(positive.setting_value);
      if (negative?.setting_value) setNegativeSignals(negative.setting_value);
      if (rules?.setting_value) setCriticalRules(rules.setting_value);
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
      toast.success("Never Answers analysis settings saved");
    },
    onError: (error: Error) => {
      toast.error(`Failed to save settings: ${error.message}`);
    },
  });

  const handleReset = () => {
    setPositiveSignals(DEFAULT_POSITIVE_SIGNALS);
    setNegativeSignals(DEFAULT_NEGATIVE_SIGNALS);
    setCriticalRules(DEFAULT_CRITICAL_RULES);
    setHasChanges(true);
  };

  const handleChange = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setHasChanges(true);
  };

  return (
    <Collapsible defaultOpen={false} className="group">
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AI "Never Answers" Analysis Settings
              </span>
              <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </CardTitle>
            <CardDescription>
              Customize how the AI analyzes contact notes to determine if an opportunity should be marked as "Never Answers". 
              The AI prioritizes recent notes over older ones.
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
