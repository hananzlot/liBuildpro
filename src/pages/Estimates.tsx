import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Calculator, Send, FileSignature, Plus, Trash2, Eye, Edit, Loader2, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { EstimateDetailSheet } from "@/components/estimates/EstimateDetailSheet";
import { EstimateBuilderDialog } from "@/components/estimates/EstimateBuilderDialog";

type ViewType = "list" | "proposals" | "contracts";

interface Estimate {
  id: string;
  estimate_number: number;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  job_address: string | null;
  estimate_title: string;
  estimate_date: string;
  expiration_date: string | null;
  status: string;
  total: number;
  created_at: string;
  notes: string | null;
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-500",
  sent: "bg-blue-500",
  viewed: "bg-purple-500",
  needs_changes: "bg-amber-500",
  accepted: "bg-green-500",
  declined: "bg-red-500",
  expired: "bg-gray-400",
};

const statusLabels: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  needs_changes: "Needs Changes",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
};

export default function Estimates() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentView = (searchParams.get("view") as ViewType) || "list";
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [selectedEstimateId, setSelectedEstimateId] = useState<string | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingEstimateId, setEditingEstimateId] = useState<string | null>(null);

  const handleViewChange = (view: string) => {
    setSearchParams({ view });
  };

  // Fetch estimates
  const { data: estimates, isLoading } = useQuery({
    queryKey: ["estimates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estimates")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Estimate[];
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (estimateId: string) => {
      const { error } = await supabase
        .from("estimates")
        .delete()
        .eq("id", estimateId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
      toast.success("Estimate deleted successfully");
    },
    onError: (error) => {
      toast.error(`Failed to delete estimate: ${error.message}`);
    },
  });

  // Filter estimates by status for different views
  const draftEstimates = estimates?.filter((e) => e.status === "draft") || [];
  const proposalEstimates = estimates?.filter((e) => ["sent", "viewed", "needs_changes"].includes(e.status)) || [];
  const contractEstimates = estimates?.filter((e) => ["accepted", "declined", "expired"].includes(e.status)) || [];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const renderEstimateTable = (estimateList: Estimate[], emptyMessage: string, emptyIcon: React.ReactNode) => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (estimateList.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          {emptyIcon}
          <h3 className="text-lg font-semibold">{emptyMessage}</h3>
          <p className="text-muted-foreground mb-4">
            {currentView === "list" && "Get started by creating your first estimate."}
            {currentView === "proposals" && "Send an estimate as a proposal to see it here."}
            {currentView === "contracts" && "Contracts will appear here once proposals are approved and signed."}
          </p>
          {currentView === "list" && (
            <Button onClick={() => {
              setEditingEstimateId(null);
              setBuilderOpen(true);
            }}>
              <Plus className="mr-2 h-4 w-4" />
              Create Estimate
            </Button>
          )}
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[80px]">#</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="w-[120px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {estimateList.map((estimate) => (
            <TableRow key={estimate.id}>
              <TableCell className="font-mono text-muted-foreground">
                {estimate.estimate_number}
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{estimate.customer_name}</span>
                  {estimate.customer_email && (
                    <span className="text-xs text-muted-foreground">{estimate.customer_email}</span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span>{estimate.estimate_title}</span>
                  {estimate.job_address && (
                    <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {estimate.job_address}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span>{format(new Date(estimate.estimate_date), "MMM d, yyyy")}</span>
                  {estimate.expiration_date && (
                    <span className="text-xs text-muted-foreground">
                      Exp: {format(new Date(estimate.expiration_date), "MMM d")}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge className={`${statusColors[estimate.status]} text-white`}>
                  {statusLabels[estimate.status]}
                </Badge>
              </TableCell>
              <TableCell className="text-right font-semibold">
                {formatCurrency(estimate.total)}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedEstimateId(estimate.id)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditingEstimateId(estimate.id);
                      setBuilderOpen(true);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  {isAdmin && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Estimate</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete estimate #{estimate.estimate_number} for {estimate.customer_name}? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(estimate.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  // Summary stats
  const totalEstimates = estimates?.length || 0;
  const totalValue = estimates?.reduce((sum, e) => sum + (e.total || 0), 0) || 0;
  const pendingProposals = proposalEstimates.length;
  const acceptedContracts = contractEstimates.filter((e) => e.status === "accepted").length;

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Estimates & Contracts</h1>
            <p className="text-muted-foreground">
              Create estimates, send proposals, and manage contracts
            </p>
          </div>
          <Button onClick={() => {
            setEditingEstimateId(null);
            setBuilderOpen(true);
          }}>
            <Plus className="mr-2 h-4 w-4" />
            New Estimate
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Estimates</CardTitle>
              <Calculator className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalEstimates}</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
              <p className="text-xs text-muted-foreground">Combined estimate value</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Proposals</CardTitle>
              <Send className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingProposals}</div>
              <p className="text-xs text-muted-foreground">Awaiting response</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Accepted</CardTitle>
              <FileSignature className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{acceptedContracts}</div>
              <p className="text-xs text-muted-foreground">Signed contracts</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={currentView} onValueChange={handleViewChange} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="list" className="flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Estimates ({draftEstimates.length})
            </TabsTrigger>
            <TabsTrigger value="proposals" className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              Proposals ({proposalEstimates.length})
            </TabsTrigger>
            <TabsTrigger value="contracts" className="flex items-center gap-2">
              <FileSignature className="h-4 w-4" />
              Contracts ({contractEstimates.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>All Estimates</CardTitle>
                <CardDescription>
                  View and manage all draft estimates. Create new estimates or edit existing ones.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {renderEstimateTable(
                  draftEstimates,
                  "No Draft Estimates",
                  <Calculator className="h-12 w-12 text-muted-foreground mb-4" />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="proposals" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Proposals</CardTitle>
                <CardDescription>
                  Track proposals sent to clients. Monitor views, approvals, and client responses.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {renderEstimateTable(
                  proposalEstimates,
                  "No Proposals Sent",
                  <Send className="h-12 w-12 text-muted-foreground mb-4" />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contracts" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Contracts</CardTitle>
                <CardDescription>
                  Manage signed contracts and pending signatures. View contract status and audit trails.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {renderEstimateTable(
                  contractEstimates,
                  "No Contracts Yet",
                  <FileSignature className="h-12 w-12 text-muted-foreground mb-4" />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Estimate Detail Sheet */}
      <EstimateDetailSheet
        estimateId={selectedEstimateId}
        open={!!selectedEstimateId}
        onOpenChange={(open) => !open && setSelectedEstimateId(null)}
      />

      {/* Estimate Builder Dialog */}
      <EstimateBuilderDialog
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        estimateId={editingEstimateId}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["estimates"] })}
      />
    </AppLayout>
  );
}
