import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/hooks/useAuditLog";
import { findContactByIdOrGhlId } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, Loader2, RefreshCw, CheckCircle2 } from "lucide-react";

interface WonOpportunity {
  id: string;
  ghl_id: string;
  name: string | null;
  contact_id: string | null;
  monetary_value: number | null;
  assigned_to: string | null;
  ghl_date_added: string | null;
  won_at: string | null;
  stage_name: string | null;
  location_id: string;
  scope_of_work: string | null;
  contact?: {
    contact_name: string | null;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    email: string | null;
    source: string | null;
    custom_fields: unknown;
  } | null;
}

const formatCurrency = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatDate = (date: string | null | undefined) => {
  if (!date) return "-";
  return new Date(date).toLocaleDateString();
};

export function MissingProjectsSection() {
  const queryClient = useQueryClient();
  const [selectedOpportunities, setSelectedOpportunities] = useState<Set<string>>(new Set());
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  // Fetch won opportunities
  const { data: wonOpportunities = [], isLoading: loadingOpportunities } = useQuery({
    queryKey: ["won-opportunities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opportunities")
        .select(`
          id,
          ghl_id,
          name,
          contact_id,
          monetary_value,
          assigned_to,
          ghl_date_added,
          won_at,
          stage_name,
          location_id,
          scope_of_work
        `)
        .eq("status", "won")
        .order("ghl_date_added", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch contacts for won opportunities
  const { data: contacts = [] } = useQuery({
    queryKey: ["won-opportunities-contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, ghl_id, contact_name, first_name, last_name, phone, email, source, custom_fields");
      if (error) throw error;
      return data;
    },
  });

  // Fetch existing projects to check which opportunities already have projects
  const { data: existingProjects = [] } = useQuery({
    queryKey: ["existing-projects-opportunity-ids"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("opportunity_id")
        .not("opportunity_id", "is", null);
      if (error) throw error;
      return data;
    },
  });

  // Fetch GHL users for salesperson names
  const { data: ghlUsers = [] } = useQuery({
    queryKey: ["ghl-users-for-opportunities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ghl_users")
        .select("ghl_id, name, first_name, last_name");
      if (error) throw error;
      return data;
    },
  });

  // Calculate missing opportunities
  const existingOpportunityIds = new Set(existingProjects.map(p => p.opportunity_id));
  
  const missingOpportunities: WonOpportunity[] = wonOpportunities
    .filter(opp => !existingOpportunityIds.has(opp.ghl_id))
    .map(opp => {
      const contact = contacts.find(c => c.ghl_id === opp.contact_id);
      return {
        ...opp,
        contact: contact || null,
      };
    });

  const getSalespersonName = (assignedTo: string | null) => {
    if (!assignedTo) return "-";
    const user = ghlUsers.find(u => u.ghl_id === assignedTo);
    if (user) {
      return user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || assignedTo;
    }
    return assignedTo;
  };

  const getContactName = (opp: WonOpportunity) => {
    if (opp.contact) {
      return opp.contact.contact_name || 
        `${opp.contact.first_name || ''} ${opp.contact.last_name || ''}`.trim() || 
        opp.name || '-';
    }
    return opp.name || '-';
  };

  // Toggle selection
  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedOpportunities);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedOpportunities(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedOpportunities.size === missingOpportunities.length) {
      setSelectedOpportunities(new Set());
    } else {
      setSelectedOpportunities(new Set(missingOpportunities.map(o => o.id)));
    }
  };

  // Convert to projects mutation
  const convertMutation = useMutation({
    mutationFn: async (opportunityIds: string[]) => {
      const opportunitiesToConvert = missingOpportunities.filter(o => opportunityIds.includes(o.id));
      
      const projectsToCreate = opportunitiesToConvert.map(opp => {
        const contactName = getContactName(opp);
        const nameParts = contactName.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        // Get scope and address from contact custom_fields
        let projectScope: string | null = opp.scope_of_work || null;
        let projectAddress: string | null = null;
        
        if (opp.contact?.custom_fields && Array.isArray(opp.contact.custom_fields)) {
          const customFields = opp.contact.custom_fields as Array<{ id: string; value?: string }>;
          
          // Scope of work fallback (if not on opportunity)
          if (!projectScope) {
            const scopeField = customFields.find((field) => field.id === 'KwQRtJT0aMSHnq3mwR68');
            if (scopeField && scopeField.value) {
              projectScope = scopeField.value;
            }
          }
          
          // Address field
          const addressField = customFields.find((field) => field.id === 'b7oTVsUQrLgZt84bHpCn');
          if (addressField && addressField.value) {
            projectAddress = addressField.value;
          }
        }
        
        return {
          project_name: opp.name || contactName || 'New Project',
          project_status: 'New Job',
          project_type: 'Residential',
          location_id: opp.location_id,
          opportunity_id: opp.ghl_id,
          customer_first_name: firstName,
          customer_last_name: lastName,
          customer_email: opp.contact?.email || null,
          cell_phone: opp.contact?.phone || null,
          primary_salesperson: getSalespersonName(opp.assigned_to) !== '-' ? getSalespersonName(opp.assigned_to) : null,
          estimated_cost: opp.monetary_value,
          lead_source: opp.contact?.source || null,
          project_scope_dispatch: projectScope,
          project_address: projectAddress,
        };
      });

      const { data, error } = await supabase
        .from("projects")
        .insert(projectsToCreate)
        .select();

      if (error) throw error;

      // Log audit for each created project
      for (const project of data || []) {
        await logAudit({
          tableName: 'projects',
          recordId: project.id,
          action: 'INSERT',
          newValues: project,
          description: `Created project from won opportunity: ${project.project_name}`,
        });
      }

      return data;
    },
    onSuccess: (data) => {
      toast.success(`Successfully created ${data?.length || 0} project(s)`);
      setSelectedOpportunities(new Set());
      setConfirmDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["existing-projects-opportunity-ids"] });
    },
    onError: (error) => {
      toast.error(`Failed to create projects: ${error.message}`);
    },
  });

  const handleConvert = () => {
    if (selectedOpportunities.size === 0) {
      toast.error("Please select at least one opportunity to convert");
      return;
    }
    setConfirmDialogOpen(true);
  };

  const confirmConversion = () => {
    convertMutation.mutate(Array.from(selectedOpportunities));
  };

  if (loadingOpportunities) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (missingOpportunities.length === 0) {
    return null; // Don't show if no missing opportunities
  }

  return (
    <>
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-lg">Won Opportunities Missing Projects</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {selectedOpportunities.size > 0 && (
                <Button onClick={handleConvert} disabled={convertMutation.isPending}>
                  {convertMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4 mr-2" />
                  )}
                  Convert {selectedOpportunities.size} to Projects
                </Button>
              )}
              <Button
                variant="outline"
                size="icon"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["won-opportunities"] })}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <CardDescription>
            {missingOpportunities.length} won opportunity(ies) don't have corresponding project records
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedOpportunities.size === missingOpportunities.length && missingOpportunities.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Opportunity Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Salesperson</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead>Won Date</TableHead>
                  <TableHead>Stage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {missingOpportunities.map((opp) => (
                  <TableRow 
                    key={opp.id}
                    className={selectedOpportunities.has(opp.id) ? "bg-primary/5" : ""}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedOpportunities.has(opp.id)}
                        onCheckedChange={() => toggleSelection(opp.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {opp.name || '-'}
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate">
                      {getContactName(opp)}
                    </TableCell>
                    <TableCell>{opp.contact?.phone || '-'}</TableCell>
                    <TableCell>{getSalespersonName(opp.assigned_to)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(opp.monetary_value)}
                    </TableCell>
                    <TableCell>{formatDate(opp.won_at || opp.ghl_date_added)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                        {opp.stage_name || 'Won'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              Convert to Projects?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will create {selectedOpportunities.size} new project record(s) from the selected won opportunities. 
              The projects will be created with "New Job" status and linked to the original opportunities.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmConversion}
              disabled={convertMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {convertMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Converting...
                </>
              ) : (
                <>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Convert to Projects
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
