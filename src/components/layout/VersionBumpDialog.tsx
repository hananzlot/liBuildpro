import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface VersionBumpDialogProps {
  currentVersion: number | null;
}

export function VersionBumpDialog({ currentVersion }: VersionBumpDialogProps) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();

  const newVersion = currentVersion ? currentVersion + 0.01 : 2.21;

  const bumpVersionMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("app_version")
        .insert({
          version_number: newVersion,
          notes: notes.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success(`Version bumped to v${newVersion.toFixed(2)}`);
      queryClient.invalidateQueries({ queryKey: ["app-version"] });
      setOpen(false);
      setNotes("");
    },
    onError: (error) => {
      console.error("Failed to bump version:", error);
      toast.error("Failed to bump version");
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="h-4 w-4 flex items-center justify-center rounded hover:bg-muted transition-colors"
          title="Bump version"
        >
          <Plus className="h-3 w-3 text-muted-foreground hover:text-foreground" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bump Version</DialogTitle>
          <DialogDescription>
            Increment the app version before deploying. This will trigger a cache refresh for all users.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex items-center justify-center gap-4 text-lg font-medium">
            <span className="text-muted-foreground">v{currentVersion?.toFixed(2) ?? "2.20"}</span>
            <span className="text-muted-foreground">→</span>
            <span className="text-primary">v{newVersion.toFixed(2)}</span>
          </div>
          <div className="space-y-2">
            <Label htmlFor="release-notes">Release Notes (optional)</Label>
            <Textarea
              id="release-notes"
              placeholder="What's new in this version..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => bumpVersionMutation.mutate()}
            disabled={bumpVersionMutation.isPending}
          >
            {bumpVersionMutation.isPending ? "Bumping..." : "Bump Version"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
