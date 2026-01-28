import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
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
  Eye, 
  Pause, 
  Play, 
  Trash2, 
  Loader2, 
  Clock, 
  User,
  MapPin 
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
      return <Badge variant="default">Completed</Badge>;
    case "failed":
      return <Badge variant="destructive">Failed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function AIQueueSheet({ open, onOpenChange }: AIQueueSheetProps) {
  const navigate = useNavigate();
  const {
    queuedJobs,
    isLoading,
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

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              AI Generation Queue
              {queuedJobs.length > 0 && (
                <Badge variant="secondary">{queuedJobs.length}</Badge>
              )}
            </SheetTitle>
            <SheetDescription>
              View and manage AI estimate generation requests in the queue.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : queuedJobs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Loader2 className="h-8 w-8 mx-auto mb-3 opacity-50" />
                <p>No active AI generation requests</p>
                <p className="text-sm mt-1">Jobs will appear here when users generate AI estimates</p>
              </div>
            ) : (
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
            )}
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
