import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ClipboardList,
  Eye,
  CheckCircle,
  XCircle,
  FileText,
  Loader2,
  Clock,
  AlertTriangle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  User,
  Phone,
  Mail,
  MapPin,
  Image,
  MessageSquare,
  Calculator,
  RefreshCw,
} from "lucide-react";

interface ScopeSubmission {
  id: string;
  company_id: string;
  salesperson_id: string;
  opportunity_id: string | null;
  appointment_id: string | null;
  contact_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  job_address: string | null;
  project_type: string | null;
  scope_description: string;
  measurements: string | null;
  special_requirements: string | null;
  photos_urls: string[] | null;
  status: "pending" | "reviewing" | "priced" | "proposal_sent" | "declined";
  priority: "low" | "normal" | "high" | "urgent";
  estimate_id: string | null;
  office_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  salespeople?: {
    name: string;
  };
  estimates?: {
    id: string;
    estimate_number: number;
    estimate_title: string;
  };
}

type SortColumn = "created_at" | "customer_name" | "priority" | "status";
type SortDirection = "asc" | "desc";

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  { value: "reviewing", label: "Reviewing", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { value: "priced", label: "Priced", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  { value: "proposal_sent", label: "Proposal Sent", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  { value: "declined", label: "Declined", color: "bg-red-500/20 text-red-400 border-red-500/30" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low", color: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
  { value: "normal", label: "Normal", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { value: "high", label: "High", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  { value: "urgent", label: "Urgent", color: "bg-red-500/20 text-red-400 border-red-500/30" },
];

export function ScopeSubmissionsManagement() {
  const { companyId } = useCompanyContext();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // State
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [sortColumn, setSortColumn] = useState<SortColumn>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedSubmission, setSelectedSubmission] = useState<ScopeSubmission | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  const [declineNotes, setDeclineNotes] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Fetch submissions
  const { data: submissions, isLoading, refetch } = useQuery({
    queryKey: ["scope_submissions", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      const { data, error } = await supabase
        .from("scope_submissions")
        .select(`
          *,
          salespeople (name),
          estimates (id, estimate_number, estimate_title)
        `)
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ScopeSubmission[];
    },
    enabled: !!companyId,
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const updateData: Record<string, unknown> = {
        status,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      };
      
      if (notes !== undefined) {
        updateData.office_notes = notes;
      }

      const { error } = await supabase
        .from("scope_submissions")
        .update(updateData)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scope_submissions"] });
      toast.success("Submission updated");
    },
    onError: (error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  // Filtered and sorted data
  const filteredSubmissions = useMemo(() => {
    if (!submissions) return [];

    let result = [...submissions];

    // Apply status filter
    if (statusFilter !== "all") {
      result = result.filter((s) => s.status === statusFilter);
    }

    // Apply priority filter
    if (priorityFilter !== "all") {
      result = result.filter((s) => s.priority === priorityFilter);
    }

    // Apply sorting
    result.sort((a, b) => {
      let aVal: string | number = "";
      let bVal: string | number = "";

      switch (sortColumn) {
        case "created_at":
          aVal = new Date(a.created_at).getTime();
          bVal = new Date(b.created_at).getTime();
          break;
        case "customer_name":
          aVal = a.customer_name.toLowerCase();
          bVal = b.customer_name.toLowerCase();
          break;
        case "priority":
          const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
          aVal = priorityOrder[a.priority] ?? 4;
          bVal = priorityOrder[b.priority] ?? 4;
          break;
        case "status":
          aVal = a.status;
          bVal = b.status;
          break;
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [submissions, statusFilter, priorityFilter, sortColumn, sortDirection]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-4 w-4" />;
    return sortDirection === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  const getStatusBadge = (status: string) => {
    const option = STATUS_OPTIONS.find((o) => o.value === status);
    return (
      <Badge variant="outline" className={option?.color || ""}>
        {option?.label || status}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const option = PRIORITY_OPTIONS.find((o) => o.value === priority);
    return (
      <Badge variant="outline" className={option?.color || ""}>
        {option?.label || priority}
      </Badge>
    );
  };

  const handleViewDetails = (submission: ScopeSubmission) => {
    setSelectedSubmission(submission);
    setDetailDialogOpen(true);
  };

  const handleMarkReviewing = async (submission: ScopeSubmission) => {
    await updateStatusMutation.mutateAsync({ id: submission.id, status: "reviewing" });
  };

  const handleDecline = async () => {
    if (!selectedSubmission) return;
    setIsUpdating(true);
    try {
      await updateStatusMutation.mutateAsync({
        id: selectedSubmission.id,
        status: "declined",
        notes: declineNotes,
      });
      setDeclineDialogOpen(false);
      setDetailDialogOpen(false);
      setDeclineNotes("");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleConvertToEstimate = (submission: ScopeSubmission) => {
    // Navigate to estimate builder with pre-filled data using React Router
    const params = new URLSearchParams({
      view: "list",
      action: "new",
      from_scope: submission.id,
      customer_name: submission.customer_name,
      customer_email: submission.customer_email || "",
      customer_phone: submission.customer_phone || "",
      job_address: submission.job_address || "",
      scope: submission.scope_description,
      project_type: submission.project_type || "",
    });
    
    if (submission.opportunity_id) {
      params.set("opportunity_id", submission.opportunity_id);
    }
    
    // Use navigate to preserve app context (company ID)
    navigate(`/estimates?${params.toString()}`);
  };

  // Stats
  const pendingCount = submissions?.filter((s) => s.status === "pending").length || 0;
  const reviewingCount = submissions?.filter((s) => s.status === "reviewing").length || 0;
  const urgentCount = submissions?.filter((s) => s.priority === "urgent" && s.status !== "declined" && s.status !== "proposal_sent").length || 0;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="h-6 w-6" />
            Scope Submissions
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Review and convert salesperson scope submissions into estimates
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="outline" className="bg-amber-500/20 text-amber-400 border-amber-500/30">
              {pendingCount} Pending
            </Badge>
            <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/30">
              {reviewingCount} Reviewing
            </Badge>
            {urgentCount > 0 && (
              <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30">
                {urgentCount} Urgent
              </Badge>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="w-48">
              <Label className="text-xs text-muted-foreground mb-1.5 block">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Label className="text-xs text-muted-foreground mb-1.5 block">Priority</Label>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  {PRIORITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 -ml-2"
                    onClick={() => handleSort("customer_name")}
                  >
                    Customer
                    {getSortIcon("customer_name")}
                  </Button>
                </TableHead>
                <TableHead>Salesperson</TableHead>
                <TableHead>Project Type</TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 -ml-2"
                    onClick={() => handleSort("priority")}
                  >
                    Priority
                    {getSortIcon("priority")}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 -ml-2"
                    onClick={() => handleSort("status")}
                  >
                    Status
                    {getSortIcon("status")}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 -ml-2"
                    onClick={() => handleSort("created_at")}
                  >
                    Submitted
                    {getSortIcon("created_at")}
                  </Button>
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSubmissions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No scope submissions found
                  </TableCell>
                </TableRow>
              ) : (
                filteredSubmissions.map((submission) => (
                  <TableRow
                    key={submission.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleViewDetails(submission)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{submission.customer_name}</span>
                        {submission.job_address && (
                          <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {submission.job_address}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {submission.salespeople?.name || "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {submission.project_type || "-"}
                    </TableCell>
                    <TableCell>{getPriorityBadge(submission.priority)}</TableCell>
                    <TableCell>{getStatusBadge(submission.status)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(submission.created_at), "MMM d, yyyy")}
                      <br />
                      <span className="text-xs">
                        {format(new Date(submission.created_at), "h:mm a")}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(submission)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {submission.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMarkReviewing(submission)}
                          >
                            <Clock className="h-4 w-4" />
                          </Button>
                        )}
                        {(submission.status === "pending" || submission.status === "reviewing") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-emerald-500 hover:text-emerald-400"
                            onClick={() => handleConvertToEstimate(submission)}
                          >
                            <Calculator className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Scope Submission Details
            </DialogTitle>
            <DialogDescription>
              Submitted by {selectedSubmission?.salespeople?.name || "Unknown"} on{" "}
              {selectedSubmission && format(new Date(selectedSubmission.created_at), "MMMM d, yyyy 'at' h:mm a")}
            </DialogDescription>
          </DialogHeader>

          {selectedSubmission && (
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-6">
                {/* Status & Priority */}
                <div className="flex items-center gap-4">
                  {getStatusBadge(selectedSubmission.status)}
                  {getPriorityBadge(selectedSubmission.priority)}
                  {selectedSubmission.estimate_id && (
                    <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400">
                      <Calculator className="h-3 w-3 mr-1" />
                      Estimate #{selectedSubmission.estimates?.estimate_number}
                    </Badge>
                  )}
                </div>

                {/* Customer Info */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Customer Information
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Name:</span>
                      <span className="ml-2 font-medium">{selectedSubmission.customer_name}</span>
                    </div>
                    {selectedSubmission.customer_phone && (
                      <div className="flex items-center gap-1">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <span>{selectedSubmission.customer_phone}</span>
                      </div>
                    )}
                    {selectedSubmission.customer_email && (
                      <div className="flex items-center gap-1">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        <span>{selectedSubmission.customer_email}</span>
                      </div>
                    )}
                    {selectedSubmission.job_address && (
                      <div className="flex items-center gap-1 col-span-2">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <span>{selectedSubmission.job_address}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Project Details */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Project Details
                  </h4>
                  {selectedSubmission.project_type && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Type:</span>
                      <span className="ml-2">{selectedSubmission.project_type}</span>
                    </div>
                  )}
                  <div>
                    <Label className="text-xs text-muted-foreground">Scope Description</Label>
                    <div className="mt-1 p-3 bg-muted/50 rounded-md text-sm whitespace-pre-wrap">
                      {selectedSubmission.scope_description}
                    </div>
                  </div>
                  {selectedSubmission.measurements && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Measurements</Label>
                      <div className="mt-1 p-3 bg-muted/50 rounded-md text-sm whitespace-pre-wrap">
                        {selectedSubmission.measurements}
                      </div>
                    </div>
                  )}
                  {selectedSubmission.special_requirements && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Special Requirements</Label>
                      <div className="mt-1 p-3 bg-muted/50 rounded-md text-sm whitespace-pre-wrap">
                        {selectedSubmission.special_requirements}
                      </div>
                    </div>
                  )}
                </div>

                {/* Photos */}
                {selectedSubmission.photos_urls && selectedSubmission.photos_urls.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <Image className="h-4 w-4" />
                      Photos ({selectedSubmission.photos_urls.length})
                    </h4>
                    <div className="grid grid-cols-3 gap-2">
                      {selectedSubmission.photos_urls.map((url, idx) => (
                        <a
                          key={idx}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="aspect-square rounded-md overflow-hidden bg-muted hover:opacity-80 transition-opacity"
                        >
                          <img
                            src={url}
                            alt={`Photo ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Office Notes */}
                {selectedSubmission.office_notes && (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Office Notes
                    </h4>
                    <div className="p-3 bg-muted/50 rounded-md text-sm whitespace-pre-wrap">
                      {selectedSubmission.office_notes}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {selectedSubmission?.status !== "declined" && selectedSubmission?.status !== "proposal_sent" && (
              <>
                <Button
                  variant="outline"
                  className="text-red-500 hover:text-red-400"
                  onClick={() => setDeclineDialogOpen(true)}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Decline
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-500"
                  onClick={() => selectedSubmission && handleConvertToEstimate(selectedSubmission)}
                >
                  <Calculator className="h-4 w-4 mr-1" />
                  Create Estimate
                </Button>
              </>
            )}
            {selectedSubmission?.status === "pending" && (
              <Button
                variant="secondary"
                onClick={() => {
                  if (selectedSubmission) {
                    handleMarkReviewing(selectedSubmission);
                    setDetailDialogOpen(false);
                  }
                }}
              >
                <Clock className="h-4 w-4 mr-1" />
                Mark as Reviewing
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decline Confirmation Dialog */}
      <AlertDialog open={declineDialogOpen} onOpenChange={setDeclineDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Decline Scope Submission
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to decline this scope submission from{" "}
              <strong>{selectedSubmission?.customer_name}</strong>? This action will notify the salesperson.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="decline-notes">Reason for declining (optional)</Label>
            <Textarea
              id="decline-notes"
              placeholder="Enter reason for declining..."
              value={declineNotes}
              onChange={(e) => setDeclineNotes(e.target.value)}
              className="mt-2"
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDecline}
              disabled={isUpdating}
              className="bg-red-600 hover:bg-red-500"
            >
              {isUpdating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <XCircle className="h-4 w-4 mr-1" />
              )}
              Decline
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
