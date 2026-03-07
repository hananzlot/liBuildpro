import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { useQuickAddSubStore } from "@/stores/quickAddSubcontractorStore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const SUBCONTRACTOR_TYPES = [
  "Subcontractor",
  "Material/Equipment",
  "Labor",
  "Permits",
  "Equipment Rental",
  "Other",
] as const;

interface QuickAddSubcontractorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: (companyName: string) => void;
}

export function QuickAddSubcontractorDialog({
  open,
  onOpenChange,
  onAdded,
}: QuickAddSubcontractorDialogProps) {
  const { user } = useAuth();
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();
  const { draft, updateDraft, clearDraft } = useQuickAddSubStore();

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No company");
      // Map expanded types back to DB-compatible subcontractor_type
      const dbType = draft.subType === "Subcontractor" ? "Subcontractor"
        : draft.subType === "Material/Equipment" ? "Material/Equipment"
        : "Other";
      const { error } = await supabase.from("subcontractors").insert({
        company_name: draft.companyName.trim(),
        contact_name: draft.contactName.trim() || null,
        phone: draft.phone.trim() || null,
        subcontractor_type: dbType,
        is_active: true,
        do_not_require_license: dbType !== "Subcontractor",
        do_not_require_insurance: dbType !== "Subcontractor",
        needs_compliance_review: true,
        created_by: user?.id,
        company_id: companyId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Subcontractor added");
      queryClient.invalidateQueries({ queryKey: ["subcontractors"] });
      queryClient.invalidateQueries({ queryKey: ["active-subcontractors", companyId] });
      const name = draft.companyName.trim();
      clearDraft();
      onOpenChange(false);
      onAdded(name);
    },
    onError: (err) => toast.error(`Failed: ${(err as Error).message}`),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.companyName.trim()) {
      toast.error("Company name is required");
      return;
    }
    saveMutation.mutate();
  };

  const handleCancel = () => {
    clearDraft();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onOpenChange(false); }}>
      <DialogContent className="sm:max-w-md z-[60]" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Quick Add Vendor / Sub</DialogTitle>
          <DialogDescription>
            Add basic info now. You can complete license & insurance details later from Vendors & Subs.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Input
                placeholder="Company Name *"
                value={draft.companyName}
                onChange={(e) => updateDraft({ companyName: e.target.value })}
                autoFocus
                className={!draft.companyName.trim() ? "border-destructive" : ""}
              />
            </div>
            <Select value={draft.subType} onValueChange={(v) => updateDraft({ subType: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                {SUBCONTRACTOR_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Contact Name"
              value={draft.contactName}
              onChange={(e) => updateDraft({ contactName: e.target.value })}
            />
            <div className="col-span-2">
              <Input
                placeholder="Phone"
                value={draft.phone}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                  let formatted = "";
                  if (digits.length > 0) formatted += "(" + digits.slice(0, 3);
                  if (digits.length >= 3) formatted += ") ";
                  if (digits.length > 3) formatted += digits.slice(3, 6);
                  if (digits.length > 6) formatted += "-" + digits.slice(6);
                  updateDraft({ phone: formatted });
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
