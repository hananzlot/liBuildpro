import { Loader2, FileSearch, Brain, ListTree, CheckCircle2, Layers, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

interface AIGenerationProgressProps {
  isGenerating: boolean;
  hasPlansFile: boolean;
  currentStage?: string | null;
  stageProgress?: { current: number; total: number } | null;
  onClose?: () => void;
}

// Get user-friendly message for each stage
function getStageMessage(stage: string | null): string {
  if (!stage) return 'Starting AI generation...';
  if (stage === 'PLAN_DIGEST') return 'Analyzing construction plans...';
  if (stage === 'ESTIMATE_PLAN') return 'Creating estimate outline...';
  if (stage.startsWith('GROUP_ITEMS:')) {
    const groupName = stage.replace('GROUP_ITEMS:', '');
    return `Generating items for: ${groupName}`;
  }
  if (stage === 'FINAL_ASSEMBLY') return 'Assembling final estimate...';
  return 'Processing...';
}

// Get icon for each stage
function getStageIcon(stage: string | null) {
  if (!stage) return Loader2;
  if (stage === 'PLAN_DIGEST') return FileSearch;
  if (stage === 'ESTIMATE_PLAN') return Brain;
  if (stage.startsWith('GROUP_ITEMS:')) return ListTree;
  if (stage === 'FINAL_ASSEMBLY') return CheckCircle2;
  return Loader2;
}

export function AIGenerationProgress({ 
  isGenerating, 
  hasPlansFile, 
  currentStage,
  stageProgress,
  onClose
}: AIGenerationProgressProps) {
  if (!isGenerating) return null;
  
  // Calculate progress percentage from stage progress
  const progressPercent = stageProgress 
    ? Math.min((stageProgress.current / stageProgress.total) * 100, 95)
    : 0;
  
  const stageMessage = getStageMessage(currentStage || null);
  const StageIcon = getStageIcon(currentStage || null);
  
  // Determine stage description based on whether we have real-time updates
  const hasRealtimeUpdates = !!currentStage;
  
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center">
      <div className="bg-card border rounded-lg shadow-lg p-6 max-w-md w-full mx-4 space-y-4 relative">
        {/* Close button - z-index ensures it's clickable */}
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-8 w-8 z-10 hover:bg-muted"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            title="Close progress view"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        
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
        
        {/* Progress bar - only show if we have stage progress */}
        {hasRealtimeUpdates && stageProgress && (
          <div className="space-y-2">
            <Progress value={progressPercent} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Stage {stageProgress.current} of {stageProgress.total}</span>
              <span>~{Math.round(progressPercent)}%</span>
            </div>
          </div>
        )}
        
        {/* Current stage indicator */}
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
          <StageIcon className="h-5 w-5 text-primary animate-pulse" />
          <span className="text-sm font-medium">{stageMessage}</span>
        </div>
        
        {/* Stage pipeline visualization */}
        {hasRealtimeUpdates && stageProgress && (
          <div className="flex justify-center gap-2">
            {Array.from({ length: Math.min(stageProgress.total, 10) }).map((_, idx) => (
              <div
                key={idx}
                className={`h-2 w-2 rounded-full transition-colors ${
                  idx < stageProgress.current 
                    ? "bg-primary" 
                    : idx === stageProgress.current 
                      ? "bg-primary animate-pulse" 
                      : "bg-muted"
                }`}
              />
            ))}
            {stageProgress.total > 10 && (
              <span className="text-xs text-muted-foreground">+{stageProgress.total - 10}</span>
            )}
          </div>
        )}
        
        {/* Informational text */}
        {hasRealtimeUpdates ? (
          <p className="text-xs text-muted-foreground text-center">
            {hasPlansFile 
              ? "Processing plans and generating detailed line items..."
              : "Generating groups and line items for your estimate..."}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground text-center">
            This may take 1-2 minutes for complex projects.
          </p>
        )}
        
        {/* Multi-stage benefit message */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
          <Layers className="h-3 w-3" />
          <span>Multi-stage processing for better results</span>
        </div>
        
        {/* Close explanation */}
        {onClose && (
          <p className="text-xs text-muted-foreground text-center border-t pt-3 mt-2">
            You can close this window — the estimate will continue generating in the background and populate automatically when complete.
          </p>
        )}
      </div>
    </div>
  );
}
