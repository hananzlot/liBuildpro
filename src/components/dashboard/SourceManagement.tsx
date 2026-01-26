import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, ArrowRight, Search, Plus, Archive, ArchiveRestore, GitMerge } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useArchivedSources } from "@/hooks/useArchivedSources";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Contact {
  ghl_id: string;
  source: string | null;
}

interface SourceManagementProps {
  contacts: Contact[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Normalize source name to title case
const normalizeSourceName = (source: string): string => {
  return source
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export function SourceManagement({ contacts, open, onOpenChange }: SourceManagementProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedSource, setSelectedSource] = useState<string>("");
  const [mergeTargetSource, setMergeTargetSource] = useState<string>("");
  const [newSourceName, setNewSourceName] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"active" | "archived">("active");
  
  // New source state
  const [showAddNew, setShowAddNew] = useState(false);
  const [newSourceInput, setNewSourceInput] = useState("");

  // Archived sources hook
  const { 
    archivedSources, 
    archiveSource, 
    unarchiveSource, 
    isArchiving, 
    isUnarchiving,
    isSourceArchived 
  } = useArchivedSources();

  // Calculate source counts (excluding archived sources)
  const sourceCounts = useMemo(() => {
    const counts = new Map<string, number>();
    contacts.forEach((contact) => {
      if (contact.source) {
        const normalized = normalizeSourceName(contact.source);
        counts.set(normalized, (counts.get(normalized) || 0) + 1);
      }
    });
    return Array.from(counts.entries())
      .map(([source, count]) => ({ source, count, archived: isSourceArchived(source) }))
      .sort((a, b) => b.count - a.count);
  }, [contacts, archivedSources]);

  const activeSources = useMemo(() => 
    sourceCounts.filter(s => !s.archived), 
    [sourceCounts]
  );

  const archivedSourcesWithCounts = useMemo(() => 
    sourceCounts.filter(s => s.archived), 
    [sourceCounts]
  );

  const filteredSources = useMemo(() => {
    const sources = activeTab === "active" ? activeSources : archivedSourcesWithCounts;
    if (!searchQuery.trim()) return sources;
    return sources.filter((item) =>
      item.source.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [activeSources, archivedSourcesWithCounts, searchQuery, activeTab]);

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
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Merged "${selectedSource}" into "${mergeTargetSource}" for ${data.updated} contacts`);
      
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
    
    // Check if source already exists
    const existingSource = sourceCounts.find(
      (item) => item.source.toLowerCase() === normalizedName.toLowerCase()
    );
    
    if (existingSource) {
      toast.error(`Source "${normalizedName}" already exists`);
      return;
    }

    // Store in localStorage for the NewEntryDialog to pick up
    const customSources = JSON.parse(localStorage.getItem("customSources") || "[]");
    if (!customSources.includes(normalizedName)) {
      customSources.push(normalizedName);
      localStorage.setItem("customSources", JSON.stringify(customSources));
    }
    
    toast.success(`Source "${normalizedName}" added and is now available when creating new entries`);
    setNewSourceInput("");
    setShowAddNew(false);
  };

  const handleArchiveSource = (sourceName: string) => {
    archiveSource(sourceName);
  };

  const handleUnarchiveSource = (sourceName: string) => {
    unarchiveSource(sourceName);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Manage Sources</DialogTitle>
          <DialogDescription>
            Add new sources, rename existing ones, or archive sources you no longer need.
          </DialogDescription>
        </DialogHeader>

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
                <Button size="sm" onClick={handleAddNewSource}>
                  Add
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
                      .filter(({ source }) => source !== mergeTargetSource)
                      .map(({ source, count }) => (
                        <SelectItem key={source} value={source}>
                          {source} ({count})
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
                      .filter(({ source }) => source !== selectedSource)
                      .map(({ source, count }) => (
                        <SelectItem key={source} value={source}>
                          {source} ({count})
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
          <div className="flex-1 min-h-0 flex flex-col">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "active" | "archived")} className="flex-1 min-h-0 flex flex-col">
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
                      {archivedSourcesWithCounts.length}
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

              <TabsContent value="active" className="flex-1 min-h-0 m-0">
                <ScrollArea className="h-full border rounded-lg">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead>Source</TableHead>
                        <TableHead className="text-right w-24">Contacts</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSources.map(({ source, count }) => (
                        <TableRow 
                          key={source} 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => {
                            setSelectedSource(source);
                            setNewSourceName(source);
                          }}
                        >
                          <TableCell className="font-medium">{source}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary">{count}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleArchiveSource(source);
                              }}
                              disabled={isArchiving}
                              title="Archive source"
                            >
                              <Archive className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredSources.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                            No sources found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="archived" className="flex-1 min-h-0 m-0">
                <ScrollArea className="h-full border rounded-lg">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead>Source</TableHead>
                        <TableHead className="text-right w-24">Contacts</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSources.map(({ source, count }) => (
                        <TableRow key={source} className="hover:bg-muted/50">
                          <TableCell className="font-medium text-muted-foreground">{source}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline">{count}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleUnarchiveSource(source)}
                              disabled={isUnarchiving}
                              title="Restore source"
                            >
                              <ArchiveRestore className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredSources.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                            {searchQuery ? "No archived sources found" : "No archived sources"}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
