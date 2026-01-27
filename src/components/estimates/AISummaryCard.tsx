import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";

export type AISummary = {
  project_understanding?: string[];
  assumptions?: string[];
  inclusions?: string[];
  exclusions?: string[];
  missing_info?: string[];
};

interface AISummaryCardProps {
  summary: AISummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAnswerQuestions?: () => void;
  isBusy?: boolean;
  title?: string;
}

export function AISummaryCard({
  summary,
  open,
  onOpenChange,
  onAnswerQuestions,
  isBusy = false,
  title = "AI Analysis & Assumptions",
}: AISummaryCardProps) {
  const projectUnderstanding = Array.isArray(summary.project_understanding)
    ? summary.project_understanding
    : [];
  const assumptions = Array.isArray(summary.assumptions) ? summary.assumptions : [];
  const inclusions = Array.isArray(summary.inclusions) ? summary.inclusions : [];
  const exclusions = Array.isArray(summary.exclusions) ? summary.exclusions : [];
  const missingInfo = Array.isArray(summary.missing_info) ? summary.missing_info : [];

  const hasAny =
    projectUnderstanding.length > 0 ||
    assumptions.length > 0 ||
    inclusions.length > 0 ||
    exclusions.length > 0 ||
    missingInfo.length > 0;

  if (!hasAny) return null;

  return (
    <Card className="border-dashed">
      <Collapsible open={open} onOpenChange={onOpenChange}>
        <CardHeader className="py-2">
          <CollapsibleTrigger className="flex items-center gap-2 hover:text-primary w-full">
            {open ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <span className="font-semibold text-sm">{title}</span>
            <Badge variant="outline" className="ml-auto">
              {missingInfo.length > 0
                ? `${missingInfo.length} items need clarification`
                : "Complete"}
            </Badge>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3">
            {projectUnderstanding.length > 0 && (
              <div>
                <Label className="text-xs font-medium text-muted-foreground">
                  Project Understanding
                </Label>
                <ul className="mt-1 text-sm space-y-1">
                  {projectUnderstanding.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-muted-foreground">•</span>
                      <span className="whitespace-pre-wrap">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {assumptions.length > 0 && (
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Assumptions</Label>
                <ul className="mt-1 text-sm space-y-1">
                  {assumptions.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-muted-foreground">•</span>
                      <span className="whitespace-pre-wrap">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(inclusions.length > 0 || exclusions.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {inclusions.length > 0 && (
                  <div>
                    <Label className="text-xs font-medium text-primary">Inclusions</Label>
                    <ul className="mt-1 text-sm space-y-1">
                      {inclusions.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-primary">•</span>
                          <span className="whitespace-pre-wrap">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {exclusions.length > 0 && (
                  <div>
                    <Label className="text-xs font-medium text-destructive">Exclusions</Label>
                    <ul className="mt-1 text-sm space-y-1">
                      {exclusions.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-destructive">•</span>
                          <span className="whitespace-pre-wrap">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {missingInfo.length > 0 && (
              <div className="bg-muted/40 border border-border rounded p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <Label className="text-xs font-medium">
                      Missing Information ({missingInfo.length} items)
                    </Label>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Answer these questions to refine your estimate.
                    </p>
                  </div>

                  {onAnswerQuestions && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={onAnswerQuestions}
                      disabled={isBusy}
                    >
                      {isBusy ? (
                        <>
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          Working...
                        </>
                      ) : (
                        "Answer Questions"
                      )}
                    </Button>
                  )}
                </div>

                <ul className="mt-2 text-sm space-y-1 max-h-32 overflow-y-auto">
                  {missingInfo.slice(0, 5).map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-muted-foreground">•</span>
                      <span className="line-clamp-2">{item}</span>
                    </li>
                  ))}
                  {missingInfo.length > 5 && (
                    <li className="text-xs text-muted-foreground italic">
                      + {missingInfo.length - 5} more questions…
                    </li>
                  )}
                </ul>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
