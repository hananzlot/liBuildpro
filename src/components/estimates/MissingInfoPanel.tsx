import { useState, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, CheckCircle2, HelpCircle } from "lucide-react";

interface MissingInfoPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  missingInfo: string[];
  onSubmit: (answers: Record<string, string>) => void;
  isSubmitting?: boolean;
}

interface ParsedQuestion {
  id: string;
  text: string;
  type: "text" | "number" | "select";
  options?: string[];
  category?: string;
}

// Parse missing info strings to extract structured questions with deduplication
function parseMissingInfo(items: string[]): ParsedQuestion[] {
  const seenTexts = new Set<string>();
  const questions: ParsedQuestion[] = [];
  
  items.forEach((item, index) => {
    const rawText = item.trim();
    if (!rawText) return;
    
    const lowerText = rawText.toLowerCase();
    let parsedQuestion: ParsedQuestion;
    
    // Foundation type
    if (lowerText.includes("foundation type") || lowerText.includes("foundation")) {
      parsedQuestion = {
        id: `q_foundation`,
        text: "Foundation Type",
        type: "select" as const,
        options: ["Slab-on-grade", "Raised foundation", "Basement", "Combination", "Other"],
        category: "Structure",
      };
    }
    // Roof type/material
    else if (lowerText.includes("roof type") || lowerText.includes("roof material") || lowerText.includes("roofing")) {
      parsedQuestion = {
        id: `q_roof`,
        text: "Roof Type/Material",
        type: "select" as const,
        options: ["Asphalt shingles", "Clay tile", "Concrete tile", "Metal standing seam", "TPO/flat", "Wood shake", "Other"],
        category: "Exterior",
      };
    }
    // Stories
    else if (lowerText.includes("stories") || lowerText.includes("story") || lowerText.includes("floors")) {
      parsedQuestion = {
        id: `q_stories`,
        text: "Number of Stories",
        type: "select" as const,
        options: ["1 story", "2 stories", "3 stories", "Split level"],
        category: "Structure",
      };
    }
    // Exterior cladding
    else if (lowerText.includes("exterior") && (lowerText.includes("cladding") || lowerText.includes("finish") || lowerText.includes("siding"))) {
      parsedQuestion = {
        id: `q_exterior`,
        text: "Exterior Finish",
        type: "select" as const,
        options: ["3-coat stucco", "Fiber cement siding", "Board and batten", "Stone veneer", "Brick", "Mix (specify in notes)", "Other"],
        category: "Exterior",
      };
    }
    // Window type
    else if (lowerText.includes("window") && (lowerText.includes("type") || lowerText.includes("material") || lowerText.includes("frame"))) {
      parsedQuestion = {
        id: `q_window`,
        text: "Window Type",
        type: "select" as const,
        options: ["Vinyl (standard)", "Fiberglass", "Aluminum", "Wood/aluminum clad", "Black frames (premium)"],
        category: "Windows & Doors",
      };
    }
    // Fire sprinklers
    else if (lowerText.includes("fire sprinkler") || lowerText.includes("sprinklers")) {
      parsedQuestion = {
        id: `q_sprinkler`,
        text: "Fire Sprinklers Required?",
        type: "select" as const,
        options: ["Yes - full house", "Yes - garage only", "No", "Unknown - check with city"],
        category: "Mechanical",
      };
    }
    // HVAC
    else if (lowerText.includes("hvac") || lowerText.includes("heating") || lowerText.includes("cooling") || lowerText.includes("air conditioning")) {
      parsedQuestion = {
        id: `q_hvac`,
        text: "HVAC System Type",
        type: "select" as const,
        options: ["Central split system", "Heat pump", "Mini-split (ductless)", "Radiant floor", "Multi-zone ducted"],
        category: "Mechanical",
      };
    }
    // Finish level
    else if (lowerText.includes("finish level") || lowerText.includes("finish grade") || lowerText.includes("quality level")) {
      parsedQuestion = {
        id: `q_finish`,
        text: "Finish Level",
        type: "select" as const,
        options: ["Builder grade", "Mid-grade", "High-end", "Custom/luxury"],
        category: "Finishes",
      };
    }
    // Site conditions / slope
    else if (lowerText.includes("slope") || lowerText.includes("hillside") || lowerText.includes("site condition") || lowerText.includes("topography")) {
      parsedQuestion = {
        id: `q_site`,
        text: "Site Conditions",
        type: "select" as const,
        options: ["Flat lot", "Slight slope (< 10%)", "Moderate slope (10-25%)", "Steep hillside (> 25%)", "Unknown"],
        category: "Site",
      };
    }
    // Duration / timeline
    else if (lowerText.includes("duration") || lowerText.includes("months") || lowerText.includes("timeline") || lowerText.includes("schedule")) {
      parsedQuestion = {
        id: `q_duration`,
        text: "Expected Construction Duration",
        type: "select" as const,
        options: ["3-6 months", "6-9 months", "9-12 months", "12-18 months", "18+ months"],
        category: "Schedule",
      };
    }
    // Electrical service
    else if (lowerText.includes("electrical service") || lowerText.includes("200a") || lowerText.includes("400a") || lowerText.includes("panel size")) {
      parsedQuestion = {
        id: `q_electrical`,
        text: "Electrical Service Size",
        type: "select" as const,
        options: ["200A (standard)", "320A", "400A (large home/EV)", "600A (commercial)"],
        category: "Electrical",
      };
    }
    // Solar
    else if (lowerText.includes("solar") || lowerText.includes("pv system") || lowerText.includes("battery storage")) {
      parsedQuestion = {
        id: `q_solar`,
        text: "Solar/Battery Scope",
        type: "select" as const,
        options: ["No solar", "Solar PV only (code minimum)", "Solar PV + battery backup", "Solar ready (conduit only)", "Unknown"],
        category: "Electrical",
      };
    }
    // Demo / existing structure
    else if (lowerText.includes("demolition") || lowerText.includes("demo") || lowerText.includes("existing structure") || lowerText.includes("tear down")) {
      parsedQuestion = {
        id: `q_demo`,
        text: "Existing Structure",
        type: "select" as const,
        options: ["Vacant lot", "Demo existing structure", "Partial demo/addition", "Renovation only"],
        category: "Site",
      };
    }
    // Garage
    else if (lowerText.includes("garage") && (lowerText.includes("size") || lowerText.includes("car") || lowerText.includes("type"))) {
      parsedQuestion = {
        id: `q_garage`,
        text: "Garage Type",
        type: "select" as const,
        options: ["1-car attached", "2-car attached", "3-car attached", "Detached garage", "Carport", "None"],
        category: "Structure",
      };
    }
    // Pool
    else if (lowerText.includes("pool") || lowerText.includes("spa") || lowerText.includes("hot tub")) {
      parsedQuestion = {
        id: `q_pool`,
        text: "Pool/Spa",
        type: "select" as const,
        options: ["No pool", "In-ground pool", "Pool + spa", "Spa only", "Future pool (rough plumbing)"],
        category: "Exterior",
      };
    }
    // Flooring
    else if (lowerText.includes("flooring") || lowerText.includes("floor finish") || lowerText.includes("hardwood") || lowerText.includes("tile floor")) {
      parsedQuestion = {
        id: `q_flooring`,
        text: "Primary Flooring",
        type: "select" as const,
        options: ["Hardwood", "Engineered wood", "Tile", "Luxury vinyl plank", "Carpet", "Polished concrete", "Mix"],
        category: "Finishes",
      };
    }
    // Countertops
    else if (lowerText.includes("countertop") || lowerText.includes("counter top") || lowerText.includes("granite") || lowerText.includes("quartz")) {
      parsedQuestion = {
        id: `q_countertops`,
        text: "Countertop Material",
        type: "select" as const,
        options: ["Laminate", "Granite", "Quartz", "Marble", "Solid surface", "Butcher block"],
        category: "Finishes",
      };
    }
    // Cabinets
    else if (lowerText.includes("cabinet") && (lowerText.includes("type") || lowerText.includes("style") || lowerText.includes("quality"))) {
      parsedQuestion = {
        id: `q_cabinets`,
        text: "Cabinet Quality",
        type: "select" as const,
        options: ["Stock cabinets", "Semi-custom", "Full custom", "IKEA-style"],
        category: "Finishes",
      };
    }
    // Default to text input with unique ID based on text
    else {
      // Create a unique ID from the text to help with deduplication
      const textKey = rawText.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 30);
      parsedQuestion = {
        id: `q_${textKey}_${index}`,
        text: rawText,
        type: "text" as const,
        category: "Other",
      };
    }
    
    // Deduplicate by checking if we've already seen this question ID
    if (!seenTexts.has(parsedQuestion.id)) {
      seenTexts.add(parsedQuestion.id);
      questions.push(parsedQuestion);
    }
  });
  
  return questions;
}

// Group questions by category
function groupByCategory(questions: ParsedQuestion[]): Record<string, ParsedQuestion[]> {
  return questions.reduce((acc, q) => {
    const cat = q.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(q);
    return acc;
  }, {} as Record<string, ParsedQuestion[]>);
}

export function MissingInfoPanel({ 
  open, 
  onOpenChange, 
  missingInfo, 
  onSubmit,
  isSubmitting = false 
}: MissingInfoPanelProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  
  const parsedQuestions = useMemo(() => parseMissingInfo(missingInfo), [missingInfo]);
  const groupedQuestions = useMemo(() => groupByCategory(parsedQuestions), [parsedQuestions]);
  
  const answeredCount = Object.values(answers).filter(v => v && v.trim()).length;
  const totalCount = parsedQuestions.length;
  const progress = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;
  
  const handleSubmit = () => {
    // Build a clean answers object with original question text as context
    const formattedAnswers: Record<string, string> = {};
    parsedQuestions.forEach((q) => {
      if (answers[q.id]?.trim()) {
        formattedAnswers[q.text] = answers[q.id].trim();
      }
    });
    onSubmit(formattedAnswers);
  };
  
  const updateAnswer = (id: string, value: string) => {
    setAnswers(prev => ({ ...prev, [id]: value }));
  };

  // Reset answers when panel opens with new data
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setAnswers({});
    }
    onOpenChange(isOpen);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader className="flex-shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-amber-500" />
            Complete Missing Information
          </SheetTitle>
          <SheetDescription>
            Answer these questions to refine your estimate. The AI will regenerate affected line items.
          </SheetDescription>
        </SheetHeader>
        
        {/* Progress indicator */}
        <div className="flex-shrink-0 py-3 border-b">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              {answeredCount} of {totalCount} answered
            </span>
            <Badge variant={progress === 100 ? "default" : "secondary"}>
              {progress}%
            </Badge>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 py-4">
            {Object.entries(groupedQuestions).map(([category, questions]) => (
              <div key={category}>
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  {category}
                </h4>
                <div className="space-y-4">
                  {questions.map((question) => (
                    <div key={question.id} className="space-y-2">
                      <Label className="text-sm flex items-start gap-2">
                        {answers[question.id]?.trim() ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                        )}
                        <span>{question.text}</span>
                      </Label>
                      
                      {question.type === "select" && question.options ? (
                        <Select
                          value={answers[question.id] || ""}
                          onValueChange={(v) => updateAnswer(question.id, v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select an option..." />
                          </SelectTrigger>
                          <SelectContent>
                            {question.options.map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                {opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          type="text"
                          value={answers[question.id] || ""}
                          onChange={(e) => updateAnswer(question.id, e.target.value)}
                          placeholder="Enter your answer..."
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        
        <SheetFooter className="flex-shrink-0 border-t pt-4">
          <div className="flex gap-3 w-full">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              className="flex-1"
              disabled={isSubmitting || answeredCount === 0}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Regenerating...
                </>
              ) : (
                <>
                  Regenerate Estimate
                  {answeredCount > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {answeredCount}
                    </Badge>
                  )}
                </>
              )}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
