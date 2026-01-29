import { useState } from "react";
import { format, formatDistanceToNow, differenceInSeconds } from "date-fns";
import { useNavigate } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  Eye, 
  Pause, 
  Play, 
  Trash2, 
  Loader2, 
  Clock, 
  User,
  MapPin,
  CheckCircle2,
  XCircle,
  Timer
} from "lucide-react";
import { useAIGenerationQueue, type QueuedJob } from "@/hooks/useAIGenerationQueue";
import { Skeleton } from "@/components/ui/skeleton";

interface AIQueueSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getProgressPercent(job: QueuedJob): number {
  if (!job.total_stages || job.total_stages === 0) return 0;
  
  // Extract stage number from current_stage like "GROUP_ITEMS:Framing" → approximate
  if (job.status === "processing" && job.current_stage) {
    // Rough estimate based on known stages
    const stageOrder = ["PLAN_DIGEST", "ESTIMATE_PLAN", "GROUP_ITEMS", "FINAL_ASSEMBLY"];
    const stageName = job.current_stage.split(":")[0];
    const idx = stageOrder.indexOf(stageName);
    if (idx >= 0) {
      return Math.min(((idx + 1) / job.total_stages) * 100, 95);
    }
  }
  
  if (job.status === "completed") return 100;
  return 0;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "pending":
      return <Badge variant="secondary">Pending</Badge>;
    case "processing":
      return <Badge className="bg-primary text-primary-foreground">Processing</Badge>;
    case "paused":
      return <Badge variant="outline" className="text-muted-foreground">Paused</Badge>;
    case "completed":
      return <Badge className="bg-green-500 text-white">Completed</Badge>;
    case "failed":
      return <Badge variant="destructive">Failed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function formatDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt || !completedAt) return "—";
  const seconds = differenceInSeconds(new Date(completedAt), new Date(startedAt));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

export function AIQueueSheet({ open, onOpenChange }: AIQueueSheetProps) {
  const navigate = useNavigate();
  const {
    queuedJobs,
    historyJobs,
    isLoading,
    isLoadingHistory,
    pauseJob,
    resumeJob,
    deleteJob,
    isPausing,
    isResuming,
    isDeleting,
  } = useAIGenerationQueue();

  const [deleteConfirmJob, setDeleteConfirmJob] = useState<QueuedJob | null>(null);

  const handleViewEstimate = (estimateId: string) => {
    onOpenChange(false);
    navigate(`/estimates?view=list&estimateId=${estimateId}`);
  };

  const handleDeleteConfirm = () => {
    if (deleteConfirmJob) {
      deleteJob(deleteConfirmJob.id);
      setDeleteConfirmJob(null);
    }
  };

  const renderActiveTable = () => {
    if (isLoading) {
      return (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      );
    }

    if (queuedJobs.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <Loader2 className="h-8 w-8 mx-auto mb-3 opacity-50" />
          <p>No active AI generation requests</p>
          <p className="text-sm mt-1">Jobs will appear here when users generate AI estimates</p>
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Project</TableHead>
            <TableHead>Progress</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead>User</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {queuedJobs.map((job) => {
            const progress = getProgressPercent(job);
            const jobAddress = job.request_params?.job_address || "Unknown address";
            
            return (
              <TableRow key={job.id}>
                <TableCell>
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium truncate max-w-[180px]" title={jobAddress}>
                        {job.estimate_number ? `#${job.estimate_number} - ` : ""}{jobAddress}
                      </p>
                      {getStatusBadge(job.status)}
                    </div>
                  </div>
                </TableCell>
                
                <TableCell>
                  <div className="w-24 space-y-1">
                    <Progress value={progress} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      {job.current_stage?.replace("GROUP_ITEMS:", "") || (job.status === "pending" ? "Waiting..." : "—")}
                    </p>
                  </div>
                </TableCell>
                
                <TableCell>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span title={format(new Date(job.created_at), "PPpp")}>
                      {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </TableCell>
                
                <TableCell>
                  <div className="flex items-center gap-1.5 text-sm">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="truncate max-w-[100px]" title={job.creator_email || undefined}>
                      {job.creator_name || job.creator_email || "Unknown"}
                    </span>
                  </div>
                </TableCell>
                
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleViewEstimate(job.estimate_id)}
                      title="View estimate"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    
                    {job.status === "paused" ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => resumeJob(job.id)}
                        disabled={isResuming}
                        title="Resume job"
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    ) : job.status === "pending" ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => pauseJob(job.id)}
                        disabled={isPausing}
                        title="Pause job"
                      >
                        <Pause className="h-4 w-4" />
                      </Button>
                    ) : null}
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteConfirmJob(job)}
                      disabled={isDeleting}
                      title="Cancel job"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  };

  const renderHistoryTable = () => {
    if (isLoadingHistory) {
      return (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      );
    }

    if (historyJobs.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <Clock className="h-8 w-8 mx-auto mb-3 opacity-50" />
          <p>No job history yet</p>
          <p className="text-sm mt-1">Completed and failed jobs will appear here</p>
        </div>
      );
    }

    return (
      <TooltipProvider>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Requested At</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>User</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {historyJobs.map((job) => {
              const jobAddress = job.request_params?.job_address || "Unknown address";
              const duration = formatDuration(job.started_at, job.completed_at);
              
              return (
                <TableRow key={job.id}>
                  <TableCell>
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium truncate max-w-[180px]" title={jobAddress}>
                          {job.estimate_number ? `#${job.estimate_number} - ` : ""}{jobAddress}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    {job.status === "failed" && job.error_message ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1.5 cursor-help">
                            <XCircle className="h-4 w-4 text-destructive" />
                            <Badge variant="destructive">Failed</Badge>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-xs">{job.error_message}</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <Badge className="bg-green-500 text-white">Completed</Badge>
                      </div>
                    )}
                  </TableCell>
                  
                  <TableCell>
                    <div className="text-sm">
                      <p className="font-medium">{format(new Date(job.created_at), "MMM d, yyyy")}</p>
                      <p className="text-muted-foreground text-xs">{format(new Date(job.created_at), "h:mm:ss a")}</p>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Timer className="h-3.5 w-3.5" />
                      <span>{duration}</span>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="truncate max-w-[100px]" title={job.creator_email || undefined}>
                        {job.creator_name || job.creator_email || "Unknown"}
                      </span>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleViewEstimate(job.estimate_id)}
                        title="View estimate"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TooltipProvider>
    );
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>AI Generation Queue</SheetTitle>
            <SheetDescription>
              View and manage AI estimate generation requests.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6">
            <Tabs defaultValue="active">
              <TabsList className="mb-4">
                <TabsTrigger value="active" className="flex items-center gap-2">
                  Active
                  {queuedJobs.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                      {queuedJobs.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>
              
              <TabsContent value="active">
                {renderActiveTable()}
              </TabsContent>
              
              <TabsContent value="history">
                {renderHistoryTable()}
              </TabsContent>
            </Tabs>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteConfirmJob} onOpenChange={() => setDeleteConfirmJob(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel AI Generation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the job from the queue. The estimate will remain but won't have AI-generated content.
              {deleteConfirmJob?.request_params?.job_address && (
                <span className="block mt-2 font-medium text-foreground">
                  Project: {deleteConfirmJob.request_params.job_address}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep in Queue</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cancel Job
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
