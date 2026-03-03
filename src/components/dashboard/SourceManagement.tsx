import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, ArrowRight, Search, Plus, Archive, ArchiveRestore, GitMerge, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Contact {
  ghl_id: string;
  source: string | null;
}

interface SourceManagementProps {
  contacts: Contact[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  inline?: boolean;
}

// Normalize source name to title case
const normalizeSourceName = (source: string): string => {
  return source
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

interface LeadSource {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
}

export function SourceManagement({ contacts, open = true, onOpenChange, inline = false }: SourceManagementProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { companyId } = useCompanyContext();
  const [selectedSource, setSelectedSource] = useState<string>("");
  const [mergeTargetSource, setMergeTargetSource] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"active" | "archived">("active");
  
  // New source state
  const [showAddNew, setShowAddNew] = useState(false);
  const [newSourceInput, setNewSourceInput] = useState("");

  // Fetch lead sources from database
  const { data: leadSources = [], isLoading: isLoadingSources } = useQuery({
    queryKey: ["lead-sources-full", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      const { data, error } = await supabase
        .from("lead_sources")
        .select("id, name, is_active, sort_order")
        .eq("company_id", companyId)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      
      if (error) throw error;
      return data as LeadSource[];
    },
    enabled: (open || inline) && !!companyId,
  });

  // Calculate contact counts per source
  const sourceContactCounts = useMemo(() => {
    const counts = new Map<string, number>();
    contacts.forEach((contact) => {
      if (contact.source) {
        const normalized = normalizeSourceName(contact.source);
        counts.set(normalized, (counts.get(normalized) || 0) + 1);
      }
    });
    return counts;
  }, [contacts]);

  // Separate active and archived sources
  const activeSources = useMemo(() => 
    leadSources.filter(s => s.is_active).map(s => ({
      ...s,
      count: sourceContactCounts.get(s.name) || 0
    })), 
    [leadSources, sourceContactCounts]
  );

  const archivedSources = useMemo(() => 
    leadSources.filter(s => !s.is_active).map(s => ({
      ...s,
      count: sourceContactCounts.get(s.name) || 0
    })), 
    [leadSources, sourceContactCounts]
  );

  const filteredSources = useMemo(() => {
    const sources = activeTab === "active" ? activeSources : archivedSources;
    if (!searchQuery.trim()) return sources;
    return sources.filter((item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [activeSources, archivedSources, searchQuery, activeTab]);

  // Add source mutation
  const addSourceMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!companyId) throw new Error("No company selected");
      const maxSort = leadSources.length > 0 
        ? Math.max(...leadSources.map(s => s.sort_order || 0)) 
        : 0;
      const { error } = await supabase
        .from("lead_sources")
        .insert({ 
          name, 
          company_id: companyId, 
          sort_order: maxSort + 1,
          created_by: user?.id 
        });
      if (error) {
        if (error.code === "23505") {
          throw new Error("Source already exists");
        }
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Source added");
      setNewSourceInput("");
      setShowAddNew(false);
      queryClient.invalidateQueries({ queryKey: ["lead-sources-full", companyId] });
      queryClient.invalidateQueries({ queryKey: ["lead-sources", companyId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add source");
    },
  });

  // Archive source mutation
  const archiveSourceMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      const { error } = await supabase
        .from("lead_sources")
        .update({ is_active: false })
        .eq("id", sourceId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Source archived");
      queryClient.invalidateQueries({ queryKey: ["lead-sources-full", companyId] });
      queryClient.invalidateQueries({ queryKey: ["lead-sources", companyId] });
    },
    onError: () => {
      toast.error("Failed to archive source");
    },
  });

  // Unarchive source mutation
  const unarchiveSourceMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      const { error } = await supabase
        .from("lead_sources")
        .update({ is_active: true })
        .eq("id", sourceId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Source restored");
      queryClient.invalidateQueries({ queryKey: ["lead-sources-full", companyId] });
      queryClient.invalidateQueries({ queryKey: ["lead-sources", companyId] });
    },
    onError: () => {
      toast.error("Failed to restore source");
    },
  });

  // Delete source mutation
  const deleteSourceMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      const { error } = await supabase
        .from("lead_sources")
        .delete()
        .eq("id", sourceId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Source deleted");
      queryClient.invalidateQueries({ queryKey: ["lead-sources-full", companyId] });
      queryClient.invalidateQueries({ queryKey: ["lead-sources", companyId] });
    },
    onError: () => {
      toast.error("Failed to delete source");
    },
  });

  const handleMergeSources = async () => {
    if (!selectedSource || !mergeTargetSource) {
      toast.error("Please select both source and target");
      return;
    }

    if (selectedSource === mergeTargetSource) {
      toast.error("Source and target must be different");
      return;
    }

    setIsUpdating(true);
    try {
      const { data, error } = await supabase.functions.invoke("bulk-update-source", {
        body: {
          oldSource: selectedSource,
          newSource: mergeTargetSource,
          editedBy: user?.id || null,
          companyId: companyId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Merged "${selectedSource}" into "${mergeTargetSource}" for ${data.updated} contacts`);
      
      // Archive the merged source
      const sourceToArchive = leadSources.find(s => s.name === selectedSource);
      if (sourceToArchive) {
        await archiveSourceMutation.mutateAsync(sourceToArchive.id);
      }
      
      // Reset form
      setSelectedSource("");
      setMergeTargetSource("");
      
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["opportunity_edits"] });
    } catch (error) {
      console.error("Error merging sources:", error);
      toast.error("Failed to merge sources");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddNewSource = () => {
    if (!newSourceInput.trim()) {
      toast.error("Please enter a source name");
      return;
    }
    const normalizedName = normalizeSourceName(newSourceInput.trim());
    addSourceMutation.mutate(normalizedName);
  };

  const managerContent = (
    <div className="space-y-4 flex-1 min-h-0 flex flex-col">
      {/* Add New Source Section */}
      <div className="border rounded-lg p-4 bg-muted/30">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium">Add New Source</h4>
          {!showAddNew && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddNew(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Source
            </Button>
          )}
        </div>
        
        {showAddNew && (
          <div className="flex items-center gap-2">
            <Input
              value={newSourceInput}
              onChange={(e) => setNewSourceInput(e.target.value)}
              placeholder="Enter new source name..."
              className="h-9"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddNewSource();
              }}
            />
            <Button 
              size="sm" 
              onClick={handleAddNewSource}
              disabled={addSourceMutation.isPending}
            >
              {addSourceMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Add"
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowAddNew(false);
                setNewSourceInput("");
              }}
            >
              Cancel
            </Button>
          </div>
        )}
      </div>

      {/* Merge/Rename Section */}
      <div className="border rounded-lg p-4 bg-muted/30">
        <h4 className="text-sm font-medium mb-3">Merge Sources</h4>
        <p className="text-xs text-muted-foreground mb-3">
          Select a source to merge and the target source it should be merged into. All records will be updated.
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">Merge from</Label>
            <Select value={selectedSource} onValueChange={setSelectedSource}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Source to remove" />
              </SelectTrigger>
              <SelectContent>
                {activeSources
                  .filter(({ name }) => name !== mergeTargetSource)
                  .map(({ name, count }) => (
                    <SelectItem key={name} value={name}>
                      {name} ({count})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground mt-5" />
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">Merge into</Label>
            <Select value={mergeTargetSource} onValueChange={setMergeTargetSource}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Target source" />
              </SelectTrigger>
              <SelectContent>
                {activeSources
                  .filter(({ name }) => name !== selectedSource)
                  .map(({ name, count }) => (
                    <SelectItem key={name} value={name}>
                      {name} ({count})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleMergeSources}
            disabled={isUpdating || !selectedSource || !mergeTargetSource}
            className="mt-5"
            title="Merge sources"
          >
            {isUpdating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <GitMerge className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Source List with Tabs */}
      <div className="flex flex-col">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "active" | "archived")} className="flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <TabsList className="h-8">
              <TabsTrigger value="active" className="text-xs px-3">
                Active
                <Badge variant="secondary" className="ml-1.5 text-xs h-5">
                  {activeSources.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="archived" className="text-xs px-3">
                Archived
                <Badge variant="secondary" className="ml-1.5 text-xs h-5">
                  {archivedSources.length}
                </Badge>
              </TabsTrigger>
            </TabsList>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="h-8 pl-8 text-sm w-40"
              />
            </div>
          </div>

          <TabsContent value="active" className="m-0">
            <ScrollArea className="h-[300px] border rounded-lg">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right w-24">Contacts</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingSources ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : filteredSources.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                        {searchQuery ? "No sources found" : "No sources defined. Add your first source above."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSources.map((source) => (
                      <TableRow key={source.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">{source.name}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary">{source.count}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => archiveSourceMutation.mutate(source.id)}
                            disabled={archiveSourceMutation.isPending}
                            title="Archive source"
                          >
                            <Archive className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="archived" className="m-0">
            <ScrollArea className="h-[300px] border rounded-lg">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right w-24">Contacts</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSources.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                        {searchQuery ? "No archived sources found" : "No archived sources"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSources.map((source) => (
                      <TableRow key={source.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium text-muted-foreground">{source.name}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline">{source.count}</Badge>
                        </TableCell>
                        <TableCell className="text-right flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => unarchiveSourceMutation.mutate(source.id)}
                            disabled={unarchiveSourceMutation.isPending}
                            title="Restore source"
                          >
                            <ArchiveRestore className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title="Delete source permanently"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Source</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to permanently delete "{source.name}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteSourceMutation.mutate(source.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );

  if (inline) {
    return (
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Manage Sources</h2>
        <p className="text-sm text-muted-foreground">
          Add, archive, or merge lead sources used by your company.
        </p>
        {managerContent}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Manage Lead Sources</DialogTitle>
          <DialogDescription>
            Add, archive, or merge lead sources. These sources will be available when assigning leads to projects.
          </DialogDescription>
        </DialogHeader>

        {managerContent}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange?.(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
