import { Loader2, FileSearch, Brain, ListTree, CheckCircle2, Layers, X, Users } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface AIGenerationProgressProps {
  isGenerating: boolean;
  hasPlansFile: boolean;
  currentStage?: string | null;
  stageProgress?: { current: number; total: number } | null;
  queuePosition?: number | null;
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
  queuePosition,
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
  const isWaitingInQueue = queuePosition && queuePosition > 1 && !hasRealtimeUpdates;
  
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center pointer-events-auto">
      <div className="bg-card border rounded-lg shadow-lg p-6 max-w-md w-full mx-4 space-y-4 relative pointer-events-auto">
        {/* Close button */}
        {onClose && (
          <button
            type="button"
            className="absolute top-3 right-3 h-8 w-8 rounded-md flex items-center justify-center hover:bg-muted transition-colors pointer-events-auto z-50 cursor-pointer"
            onClick={onClose}
            title="Close progress view"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        
        <div className="flex items-center gap-3">
          <div className="relative">
            {isWaitingInQueue ? (
              <Users className="h-8 w-8 text-amber-500" />
            ) : (
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg">
                {isWaitingInQueue ? "Waiting in Queue" : "Generating AI Estimate"}
              </h3>
              {isWaitingInQueue && (
                <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                  #{queuePosition} in line
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {isWaitingInQueue 
                ? "Another estimate is being generated. You'll start automatically when it's done."
                : hasPlansFile 
                  ? "Analyzing your construction plans..." 
                  : "Building your estimate..."}
            </p>
          </div>
        </div>
        
        {/* Queue waiting indicator */}
        {isWaitingInQueue && (
          <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex gap-1">
              {Array.from({ length: Math.min(queuePosition!, 5) }).map((_, idx) => (
                <div
                  key={idx}
                  className={`h-3 w-3 rounded-full ${
                    idx === queuePosition! - 1 
                      ? "bg-amber-500 animate-pulse" 
                      : "bg-amber-300"
                  }`}
                />
              ))}
            </div>
            <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
              {queuePosition === 2 
                ? "You're next! Starting soon..." 
                : `${queuePosition! - 1} estimate${queuePosition! > 2 ? 's' : ''} ahead of you`}
            </span>
          </div>
        )}
        
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
        
        {/* Current stage indicator - only show when not waiting in queue */}
        {!isWaitingInQueue && (
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <StageIcon className="h-5 w-5 text-primary animate-pulse" />
            <span className="text-sm font-medium">{stageMessage}</span>
          </div>
        )}
        
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
        {isWaitingInQueue ? (
          <p className="text-xs text-muted-foreground text-center">
            Your request will automatically advance when the current generation completes.
          </p>
        ) : hasRealtimeUpdates ? (
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
        {!isWaitingInQueue && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
            <Layers className="h-3 w-3" />
            <span>Multi-stage processing for better results</span>
          </div>
        )}
        
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
