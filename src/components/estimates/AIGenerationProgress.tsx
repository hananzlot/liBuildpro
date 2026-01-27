import { Loader2, FileSearch, Brain, ListTree, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";

interface AIGenerationProgressProps {
  isGenerating: boolean;
  hasPlansFile: boolean;
}

const stages = [
  { id: "uploading", label: "Uploading plans to AI...", icon: FileSearch, duration: 8000 },
  { id: "analyzing", label: "Analyzing construction plans...", icon: Brain, duration: 25000 },
  { id: "generating", label: "Generating detailed line items...", icon: ListTree, duration: 40000 },
  { id: "finalizing", label: "Finalizing estimate scope...", icon: CheckCircle2, duration: 15000 },
];

const stagesWithoutPlans = [
  { id: "analyzing", label: "Analyzing work scope...", icon: Brain, duration: 5000 },
  { id: "generating", label: "Generating detailed line items...", icon: ListTree, duration: 25000 },
  { id: "finalizing", label: "Finalizing estimate scope...", icon: CheckCircle2, duration: 15000 },
];

export function AIGenerationProgress({ isGenerating, hasPlansFile }: AIGenerationProgressProps) {
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  const activeStages = hasPlansFile ? stages : stagesWithoutPlans;
  
  // Reset when generation starts
  useEffect(() => {
    if (isGenerating) {
      setCurrentStageIndex(0);
      setElapsedTime(0);
    }
  }, [isGenerating]);
  
  // Progress through stages based on time
  useEffect(() => {
    if (!isGenerating) return;
    
    const timer = setInterval(() => {
      setElapsedTime(prev => prev + 1000);
    }, 1000);
    
    return () => clearInterval(timer);
  }, [isGenerating]);
  
  // Advance stage based on cumulative duration
  useEffect(() => {
    if (!isGenerating) return;
    
    let cumulativeDuration = 0;
    for (let i = 0; i < activeStages.length; i++) {
      cumulativeDuration += activeStages[i].duration;
      if (elapsedTime < cumulativeDuration) {
        setCurrentStageIndex(i);
        return;
      }
    }
    // Stay on last stage if we've exceeded all durations
    setCurrentStageIndex(activeStages.length - 1);
  }, [elapsedTime, isGenerating, activeStages]);
  
  if (!isGenerating) return null;
  
  const currentStage = activeStages[currentStageIndex];
  const StageIcon = currentStage.icon;
  
  // Calculate progress percentage
  const totalDuration = activeStages.reduce((sum, s) => sum + s.duration, 0);
  const progressPercent = Math.min((elapsedTime / totalDuration) * 100, 95); // Cap at 95% until complete
  
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center">
      <div className="bg-card border rounded-lg shadow-lg p-6 max-w-md w-full mx-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Generating AI Estimate</h3>
            <p className="text-sm text-muted-foreground">
              {hasPlansFile ? "Analyzing your construction plans..." : "Building your estimate..."}
            </p>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="space-y-2">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-1000 ease-out rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatTime(elapsedTime)} elapsed</span>
            <span>~{Math.round(progressPercent)}%</span>
          </div>
        </div>
        
        {/* Current stage */}
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
          <StageIcon className="h-5 w-5 text-primary animate-pulse" />
          <span className="text-sm font-medium">{currentStage.label}</span>
        </div>
        
        {/* Stage indicators */}
        <div className="flex justify-center gap-2">
          {activeStages.map((stage, idx) => (
            <div
              key={stage.id}
              className={`h-2 w-2 rounded-full transition-colors ${
                idx < currentStageIndex 
                  ? "bg-primary" 
                  : idx === currentStageIndex 
                    ? "bg-primary animate-pulse" 
                    : "bg-muted"
              }`}
            />
          ))}
        </div>
        
        {/* Tip for long waits */}
        {elapsedTime > 60000 && (
          <p className="text-xs text-muted-foreground text-center">
            Large plans may take 1-2 minutes. The AI is thoroughly analyzing all pages.
          </p>
        )}
        
        {hasPlansFile && elapsedTime > 90000 && (
          <p className="text-xs text-amber-600 text-center">
            Processing is taking longer than usual. This may be due to AI rate limits.
          </p>
        )}
      </div>
    </div>
  );
}
