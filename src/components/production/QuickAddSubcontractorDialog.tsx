import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyContext } from "@/hooks/useCompanyContext";
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

const SUBCONTRACTOR_TYPES = ["Material/Equipment", "Other", "Subcontractor"] as const;

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

  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [subType, setSubType] = useState<string>("Subcontractor");

  const resetForm = () => {
    setCompanyName("");
    setContactName("");
    setPhone("");
    setSubType("Subcontractor");
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No company");
      const { error } = await supabase.from("subcontractors").insert({
        company_name: companyName.trim(),
        contact_name: contactName.trim() || null,
        phone: phone.trim() || null,
        subcontractor_type: subType,
        is_active: true,
        do_not_require_license: subType !== "Subcontractor",
        do_not_require_insurance: subType !== "Subcontractor",
        created_by: user?.id,
        company_id: companyId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Subcontractor added");
      queryClient.invalidateQueries({ queryKey: ["subcontractors"] });
      queryClient.invalidateQueries({ queryKey: ["active-subcontractors", companyId] });
      const name = companyName.trim();
      resetForm();
      onOpenChange(false);
      onAdded(name);
    },
    onError: (err) => toast.error(`Failed: ${(err as Error).message}`),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      toast.error("Company name is required");
      return;
    }
    saveMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
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
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                autoFocus
                className={!companyName.trim() ? "border-destructive" : ""}
              />
            </div>
            <Select value={subType} onValueChange={setSubType}>
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
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
            />
            <div className="col-span-2">
              <Input
                placeholder="Phone"
                value={phone}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                  let formatted = "";
                  if (digits.length > 0) formatted += "(" + digits.slice(0, 3);
                  if (digits.length >= 3) formatted += ") ";
                  if (digits.length > 3) formatted += digits.slice(3, 6);
                  if (digits.length > 6) formatted += "-" + digits.slice(6);
                  setPhone(formatted);
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>
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
