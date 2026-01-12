import { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageSectionSelector } from "./PageSectionSelector";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

interface MagazineSale {
  id: string;
  buyer_name: string;
  buyer_phone: string | null;
  buyer_email: string | null;
  company_name: string | null;
  magazine_issue_date: string;
  ad_sold: string;
  page_size: string;
  page_number: string;
  price: number;
  created_at: string;
  updated_at: string;
  entered_by: string | null;
  sections_sold?: number[] | null;
}

interface MagazineSalesEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  existingSales: MagazineSale[];
  editingSale: MagazineSale | null;
  userId?: string;
}

const PAGE_NUMBERS = ["Cover", "Inside Front Cover", ...Array.from({ length: 50 }, (_, i) => String(i + 1)), "Inside Back Cover", "Back Page", "Random"];

type PageSizeType = "full" | "half" | "third" | "quarter";

// Convert legacy page_size string to PageSizeType
const legacySizeToType = (pageSize: string): PageSizeType | "" => {
  switch (pageSize) {
    case "Full":
    case "Cover":
    case "Back Page":
      return "full";
    case "1/2":
      return "half";
    case "1/3":
      return "third";
    case "1/4":
      return "quarter";
    default:
      return "";
  }
};

// Convert PageSizeType to display string for storage
const pageSizeTypeToString = (size: PageSizeType | ""): string => {
  switch (size) {
    case "full": return "Full";
    case "half": return "1/2";
    case "third": return "1/3";
    case "quarter": return "1/4";
    default: return "";
  }
};

export const MagazineSalesEntryDialog = ({
  open,
  onOpenChange,
  onSuccess,
  existingSales,
  editingSale,
  userId,
}: MagazineSalesEntryDialogProps) => {
  const queryClient = useQueryClient();
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [magazineIssueDate, setMagazineIssueDate] = useState("");
  const [customIssueDate, setCustomIssueDate] = useState("");
  const [adSold, setAdSold] = useState("");
  const [customAdSold, setCustomAdSold] = useState("");
  const [pageNumber, setPageNumber] = useState("");
  const [selectedSections, setSelectedSections] = useState<number[]>([]);
  const [pageSize, setPageSize] = useState<PageSizeType | "">("");
  const [price, setPrice] = useState("");

  // Get unique issue dates from existing sales
  const existingIssueDates = useMemo(() => {
    const dates = new Set(existingSales.map((s) => s.magazine_issue_date));
    return Array.from(dates).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  }, [existingSales]);

  // Get unique ad types from existing sales
  const existingAdTypes = useMemo(() => {
    const ads = new Set(existingSales.map((s) => s.ad_sold));
    return Array.from(ads).sort();
  }, [existingSales]);

  // Get sold sections for selected page/issue (each sale = 1 slot)
  const soldSectionsForPage = useMemo(() => {
    const finalIssueDate = magazineIssueDate === "custom" ? customIssueDate : magazineIssueDate;
    if (!finalIssueDate || pageNumber === "Random" || !pageNumber) return [];

    const soldSections: number[] = [];
    existingSales
      .filter((s) => 
        s.magazine_issue_date === finalIssueDate && 
        s.page_number === pageNumber &&
        s.id !== editingSale?.id // Exclude current sale when editing
      )
      .forEach((sale) => {
        // Each sale = 1 slot. Use sections_sold if available, otherwise assign based on index
        if (sale.sections_sold?.length) {
          soldSections.push(...sale.sections_sold);
        }
      });

    return [...new Set(soldSections)];
  }, [existingSales, magazineIssueDate, customIssueDate, pageNumber, editingSale]);

  // Reset form when dialog opens/closes or editing sale changes
  useEffect(() => {
    if (open) {
      if (editingSale) {
        setBuyerName(editingSale.buyer_name);
        setBuyerPhone(editingSale.buyer_phone || "");
        setBuyerEmail(editingSale.buyer_email || "");
        setCompanyName(editingSale.company_name || "");
        setMagazineIssueDate(editingSale.magazine_issue_date);
        setCustomIssueDate("");
        setAdSold(editingSale.ad_sold);
        setCustomAdSold("");
        setPageNumber(editingSale.page_number);
        // Use sections_sold if available
        const sections = editingSale.sections_sold?.length 
          ? editingSale.sections_sold 
          : [];
        setSelectedSections(sections);
        // Set page size from stored value
        setPageSize(legacySizeToType(editingSale.page_size));
        setPrice(String(editingSale.price));
      } else {
        setBuyerName("");
        setBuyerPhone("");
        setBuyerEmail("");
        setCompanyName("");
        setMagazineIssueDate("");
        setCustomIssueDate("");
        setAdSold("");
        setCustomAdSold("");
        setPageNumber("");
        setSelectedSections([]);
        setPageSize("");
        setPrice("");
      }
    }
  }, [open, editingSale]);

  // Clear sections and page size when page number changes
  useEffect(() => {
    if (!editingSale) {
      setSelectedSections([]);
      setPageSize("");
    }
  }, [pageNumber, magazineIssueDate, editingSale]);

  const createMutation = useMutation({
    mutationFn: async (data: Omit<MagazineSale, "id" | "created_at" | "updated_at">) => {
      const { data: result, error } = await supabase
        .from("magazine_sales")
        .insert([data])
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      toast.success("Magazine sale entry created");
      onSuccess();
    },
    onError: (error) => {
      toast.error(`Failed to create entry: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, changes }: { id: string; data: Partial<MagazineSale>; changes: { field: string; old: string; new: string }[] }) => {
      const { error: updateError } = await supabase
        .from("magazine_sales")
        .update(data)
        .eq("id", id);
      if (updateError) throw updateError;

      if (changes.length > 0) {
        const edits = changes.map((change) => ({
          magazine_sale_id: id,
          field_name: change.field,
          old_value: change.old,
          new_value: change.new,
          edited_by: userId,
        }));
        const { error: editError } = await supabase
          .from("magazine_sales_edits")
          .insert(edits);
        if (editError) throw editError;
      }
    },
    onSuccess: () => {
      toast.success("Magazine sale entry updated");
      onSuccess();
    },
    onError: (error) => {
      toast.error(`Failed to update entry: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("magazine_sales")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Magazine sale entry deleted");
      queryClient.invalidateQueries({ queryKey: ["magazine-sales"] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(`Failed to delete entry: ${error.message}`);
    },
  });

  const handleSubmit = () => {
    const finalIssueDate = magazineIssueDate === "custom" ? customIssueDate : magazineIssueDate;
    const finalAdSold = adSold === "custom" ? customAdSold : adSold;

    if (!buyerName.trim()) {
      toast.error("Buyer name is required");
      return;
    }
    if (!finalIssueDate) {
      toast.error("Magazine issue date is required");
      return;
    }
    if (!finalAdSold.trim()) {
      toast.error("Ad sold is required");
      return;
    }
    if (!pageNumber) {
      toast.error("Page number is required");
      return;
    }
    if (!pageSize) {
      toast.error("Page size sold is required");
      return;
    }
    if (selectedSections.length === 0) {
      toast.error("No available slot on this page");
      return;
    }
    if (!price || isNaN(Number(price))) {
      toast.error("Valid price is required");
      return;
    }

    // Validate no overlap with sold sections (except for Random pages)
    if (pageNumber !== "Random") {
      const overlap = selectedSections.filter((s) => soldSectionsForPage.includes(s));
      if (overlap.length > 0) {
        toast.error(`Sections ${overlap.join(", ")} are already sold on this page`);
        return;
      }
    }

    const pageSizeString = pageSizeTypeToString(pageSize);

    const saleData = {
      buyer_name: buyerName.trim(),
      buyer_phone: buyerPhone.trim() || null,
      buyer_email: buyerEmail.trim() || null,
      company_name: companyName.trim() || null,
      magazine_issue_date: finalIssueDate,
      ad_sold: finalAdSold.trim(),
      page_size: pageSizeString,
      page_number: pageNumber,
      sections_sold: selectedSections,
      price: Number(price),
      entered_by: userId || null,
    };

    if (editingSale) {
      const changes: { field: string; old: string; new: string }[] = [];
      if (editingSale.buyer_name !== saleData.buyer_name) changes.push({ field: "buyer_name", old: editingSale.buyer_name, new: saleData.buyer_name });
      if ((editingSale.buyer_phone || "") !== (saleData.buyer_phone || "")) changes.push({ field: "buyer_phone", old: editingSale.buyer_phone || "", new: saleData.buyer_phone || "" });
      if ((editingSale.buyer_email || "") !== (saleData.buyer_email || "")) changes.push({ field: "buyer_email", old: editingSale.buyer_email || "", new: saleData.buyer_email || "" });
      if ((editingSale.company_name || "") !== (saleData.company_name || "")) changes.push({ field: "company_name", old: editingSale.company_name || "", new: saleData.company_name || "" });
      if (editingSale.magazine_issue_date !== saleData.magazine_issue_date) changes.push({ field: "magazine_issue_date", old: editingSale.magazine_issue_date, new: saleData.magazine_issue_date });
      if (editingSale.ad_sold !== saleData.ad_sold) changes.push({ field: "ad_sold", old: editingSale.ad_sold, new: saleData.ad_sold });
      if (editingSale.page_size !== saleData.page_size) changes.push({ field: "page_size", old: editingSale.page_size, new: saleData.page_size });
      if (editingSale.page_number !== saleData.page_number) changes.push({ field: "page_number", old: editingSale.page_number, new: saleData.page_number });
      const oldSections = editingSale.sections_sold?.join(",") || "";
      const newSections = saleData.sections_sold.join(",");
      if (oldSections !== newSections) changes.push({ field: "sections_sold", old: oldSections, new: newSections });
      if (Number(editingSale.price) !== saleData.price) changes.push({ field: "price", old: String(editingSale.price), new: String(saleData.price) });

      updateMutation.mutate({ id: editingSale.id, data: saleData, changes });
    } else {
      createMutation.mutate(saleData);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingSale ? "Edit Magazine Sale" : "New Magazine Sale Entry"}</DialogTitle>
          <DialogDescription>
            {editingSale ? "Update the sale details. Changes will be tracked for audit." : "Enter the details of the magazine ad sale."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Buyer Info */}
          <div className="space-y-2">
            <Label htmlFor="buyerName">Buyer Name *</Label>
            <Input
              id="buyerName"
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              placeholder="John Doe"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="buyerPhone">Telephone</Label>
              <Input
                id="buyerPhone"
                value={buyerPhone}
                onChange={(e) => setBuyerPhone(e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="buyerEmail">Email</Label>
              <Input
                id="buyerEmail"
                type="email"
                value={buyerEmail}
                onChange={(e) => setBuyerEmail(e.target.value)}
                placeholder="john@example.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyName">Company Name</Label>
            <Input
              id="companyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Acme Corp"
            />
          </div>

          {/* Magazine Issue Date */}
          <div className="space-y-2">
            <Label>Magazine Issue Date *</Label>
            <Select value={magazineIssueDate} onValueChange={setMagazineIssueDate}>
              <SelectTrigger>
                <SelectValue placeholder="Select issue date" />
              </SelectTrigger>
              <SelectContent>
                {existingIssueDates.map((date) => (
                  <SelectItem key={date} value={date}>
                    {new Date(date).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </SelectItem>
                ))}
                <SelectItem value="custom">+ Add New Issue Date</SelectItem>
              </SelectContent>
            </Select>
            {magazineIssueDate === "custom" && (
              <Input
                type="date"
                value={customIssueDate}
                onChange={(e) => setCustomIssueDate(e.target.value)}
                className="mt-2"
              />
            )}
          </div>

          {/* Ad Sold */}
          <div className="space-y-2">
            <Label>Ad Sold *</Label>
            <Select value={adSold} onValueChange={setAdSold}>
              <SelectTrigger>
                <SelectValue placeholder="Select ad type" />
              </SelectTrigger>
              <SelectContent>
                {existingAdTypes.map((ad) => (
                  <SelectItem key={ad} value={ad}>
                    {ad}
                  </SelectItem>
                ))}
                <SelectItem value="custom">+ Add New Ad Type</SelectItem>
              </SelectContent>
            </Select>
            {adSold === "custom" && (
              <Input
                value={customAdSold}
                onChange={(e) => setCustomAdSold(e.target.value)}
                placeholder="Enter ad type"
                className="mt-2"
              />
            )}
          </div>

          {/* Page Number */}
          <div className="space-y-2">
            <Label>Page Number *</Label>
            <Select value={pageNumber} onValueChange={setPageNumber}>
              <SelectTrigger>
                <SelectValue placeholder="Select page number" />
              </SelectTrigger>
              <SelectContent>
                {PAGE_NUMBERS.map((num) => (
                  <SelectItem key={num} value={num}>
                    {num}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Page Section Selector */}
          <PageSectionSelector
            selectedSections={selectedSections}
            onSectionsChange={setSelectedSections}
            soldSections={pageNumber === "Random" ? [] : soldSectionsForPage}
            disabled={!pageNumber}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
          />

          {/* Price */}
          <div className="space-y-2">
            <Label htmlFor="price">Price ($) *</Label>
            <Input
              id="price"
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="1000"
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {editingSale && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isSubmitting} className="sm:mr-auto">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Magazine Sale</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this sale record? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteMutation.mutate(editingSale.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : editingSale ? "Update" : "Create"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
