import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, Search, AlertTriangle, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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

interface JunkContact {
  id: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  ghl_id: string | null;
  created_at: string;
}

interface JunkContactsResult {
  contacts: JunkContact[];
  count: number;
  summary: { name: string; count: number }[];
}

export function JunkContactsCleanup() {
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: junkData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["junk-contacts", companyId],
    queryFn: async (): Promise<JunkContactsResult | null> => {
      if (!companyId) return null;

      const { data, error } = await supabase.functions.invoke("cleanup-junk-contacts", {
        body: {
          action: "find-junk-contacts",
          companyId,
        },
      });

      if (error) throw error;
      return data;
    },
    enabled: !!companyId && isOpen,
    staleTime: 60000,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No company context");

      const { data, error } = await supabase.functions.invoke("cleanup-junk-contacts", {
        body: {
          action: "delete-junk-contacts",
          companyId,
          dryRun: false,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || `Deleted ${data.deleted} junk contacts`);
      queryClient.invalidateQueries({ queryKey: ["junk-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["ghl-metrics"] });
      refetch();
    },
    onError: (error) => {
      toast.error("Failed to delete contacts: " + (error as Error).message);
    },
  });

  const handleDelete = () => {
    setShowDeleteConfirm(false);
    deleteMutation.mutate();
  };

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className="group">
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                    <Trash2 className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Junk Contacts Cleanup</CardTitle>
                    <CardDescription>
                      Remove orphaned contacts without email, phone, or linked records
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {junkData && junkData.count > 0 && (
                    <Badge variant="destructive">{junkData.count} found</Badge>
                  )}
                  <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                  disabled={isLoading || isFetching}
                >
                  {(isLoading || isFetching) ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4 mr-2" />
                  )}
                  Scan for Junk Contacts
                </Button>

                {junkData && junkData.count > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={deleteMutation.isPending}
                  >
                    {deleteMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    Delete All ({junkData.count})
                  </Button>
                )}
              </div>

              {junkData && junkData.count === 0 && (
                <div className="text-sm text-muted-foreground py-4 text-center">
                  ✓ No junk contacts found. Your database is clean!
                </div>
              )}

              {junkData && junkData.count > 0 && (
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    Found <strong>{junkData.count}</strong> contacts with no email, no phone, 
                    and no linked projects, opportunities, or appointments.
                  </div>

                  {junkData.summary.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Top duplicates by name:</p>
                      <ScrollArea className="h-32">
                        <div className="space-y-1">
                          {junkData.summary.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm py-1 px-2 rounded bg-muted/50">
                              <span className="truncate">{item.name}</span>
                              <Badge variant="secondary">{item.count}</Badge>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong>Safe to delete:</strong> These contacts have no linked records 
                      (no projects, opportunities, or appointments). Deleting them won't affect 
                      any business data.
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {junkData?.count} junk contacts?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all orphaned contacts that have no email, 
              no phone, and no linked projects, opportunities, or appointments.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
