import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, DollarSign, Plus, Trash2 } from "lucide-react";

interface Salesperson {
  id: string;
  name: string | null;
  ghl_user_id: string | null;
  is_active: boolean | null;
}

interface OpportunitySale {
  id: string;
  opportunity_id: string;
  sold_amount: number;
  sold_date: string;
  sold_to_name: string | null;
  sold_to_phone: string | null;
  sold_by: string | null;
}

interface OpportunitySalesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunityId: string;
  contactId: string | null;
  locationId: string;
  userId?: string;
  currentSalespersonId?: string | null;
  onSalesUpdated: () => void;
}

const PRIMARY_LOCATION_ID = "pVeFrqvtYWNIPRIi0Fmr";

export function OpportunitySalesDialog({
  open,
  onOpenChange,
  opportunityId,
  contactId,
  locationId,
  userId,
  currentSalespersonId,
  onSalesUpdated,
}: OpportunitySalesDialogProps) {
  const { companyId } = useCompanyContext();
  const [sales, setSales] = useState<OpportunitySale[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // New sale form
  const [soldAmount, setSoldAmount] = useState("");
  const [soldDate, setSoldDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [soldToName, setSoldToName] = useState("");
  const [soldToPhone, setSoldToPhone] = useState("");
  const [soldBy, setSoldBy] = useState("");

  // Fetch active salespeople from salespeople table
  const { data: salespeople = [] } = useQuery<Salesperson[]>({
    queryKey: ["active-salespeople-for-sales", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("salespeople")
        .select("id, name, ghl_user_id, is_active")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId && open,
    staleTime: 5 * 60 * 1000,
  });

  // Sort salespeople alphabetically
  const sortedSalespeople = [...salespeople].sort((a, b) => 
    (a.name || "Unknown").localeCompare(b.name || "Unknown")
  );

  // Fetch existing sales and set default sold_by
  useEffect(() => {
    if (open && opportunityId) {
      fetchSales();
      // Set default sold_by to current salesperson ID (internal UUID)
      if (currentSalespersonId) {
        setSoldBy(currentSalespersonId);
      }
    }
  }, [open, opportunityId, currentSalespersonId]);

  const fetchSales = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("opportunity_sales")
        .select("*")
        .eq("opportunity_id", opportunityId)
        .order("sold_date", { ascending: false });

      if (error) throw error;
      setSales(data || []);
    } catch (err) {
      console.error("Error fetching sales:", err);
      toast.error("Failed to load sales");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSale = async () => {
    if (!soldAmount || !soldDate) {
      toast.error("Please enter amount and date");
      return;
    }

    if (sales.length >= 5) {
      toast.error("Maximum 5 sales per opportunity");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.from("opportunity_sales").insert({
        opportunity_id: opportunityId,
        contact_id: contactId,
        location_id: locationId || PRIMARY_LOCATION_ID,
        sold_amount: parseFloat(soldAmount),
        sold_date: soldDate,
        sold_to_name: soldToName || null,
        sold_to_phone: soldToPhone || null,
        sold_by: soldBy || null, // Now stores internal salesperson ID
        entered_by: userId,
        company_id: companyId,
      });

      if (error) throw error;

      toast.success("Sale added successfully");
      setSoldAmount("");
      setSoldDate(new Date().toISOString().split("T")[0]);
      setSoldToName("");
      setSoldToPhone("");
      if (currentSalespersonId) setSoldBy(currentSalespersonId);
      
      await fetchSales();
      onSalesUpdated();
    } catch (err) {
      console.error("Error adding sale:", err);
      toast.error("Failed to add sale");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSale = async (saleId: string) => {
    setIsDeleting(saleId);
    try {
      const { error } = await supabase
        .from("opportunity_sales")
        .delete()
        .eq("id", saleId);

      if (error) throw error;

      toast.success("Sale deleted");
      await fetchSales();
      onSalesUpdated();
    } catch (err) {
      console.error("Error deleting sale:", err);
      toast.error("Failed to delete sale");
    } finally {
      setIsDeleting(null);
    }
  };

  // Get salesperson name by internal ID (supports both internal UUID and legacy GHL ID)
  const getSalespersonName = (soldById: string | null) => {
    if (!soldById) return "Unknown";
    // First try to match by internal ID
    const byInternalId = salespeople.find(sp => sp.id === soldById);
    if (byInternalId) return byInternalId.name || "Unknown";
    // Fallback: try matching by ghl_user_id for legacy records
    const byGhlId = salespeople.find(sp => sp.ghl_user_id === soldById);
    if (byGhlId) return byGhlId.name || "Unknown";
    return "Unknown";
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const totalSalesAmount = sales.reduce((sum, s) => sum + (s.sold_amount || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Opportunity Sales ({sales.length}/5)
          </DialogTitle>
        </DialogHeader>

        {/* Summary */}
        {sales.length > 0 && (
          <div className="bg-emerald-500/10 rounded-lg p-3 mb-4">
            <div className="text-sm text-muted-foreground">Total Sales</div>
            <div className="text-2xl font-bold text-emerald-500">{formatCurrency(totalSalesAmount)}</div>
          </div>
        )}

        {/* Existing Sales */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : sales.length > 0 ? (
          <div className="space-y-3 mb-4">
            {sales.map((sale) => (
              <div key={sale.id} className="border rounded-lg p-3 bg-muted/20">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-lg text-emerald-500">
                        {formatCurrency(sale.sold_amount)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {new Date(sale.sold_date).toLocaleDateString()}
                      </span>
                    </div>
                    {sale.sold_to_name && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Sold to: </span>
                        {sale.sold_to_name}
                        {sale.sold_to_phone && ` (${sale.sold_to_phone})`}
                      </div>
                    )}
                    <div className="text-sm">
                      <span className="text-muted-foreground">Sold by: </span>
                      {getSalespersonName(sale.sold_by)}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDeleteSale(sale.id)}
                    disabled={isDeleting === sale.id}
                  >
                    {isDeleting === sale.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            No sales recorded yet
          </div>
        )}

        {/* Add New Sale Form */}
        {sales.length < 5 && (
          <div className="border-t pt-4 space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add New Sale
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sold Amount *</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={soldAmount}
                  onChange={(e) => { const val = e.target.value; if (val === '' || /^\d*\.?\d*$/.test(val)) setSoldAmount(val); }}
                  placeholder="Enter amount"
                />
              </div>
              <div className="space-y-2">
                <Label>Sold Date *</Label>
                <Input
                  type="date"
                  value={soldDate}
                  onChange={(e) => setSoldDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Sold To (Name)</Label>
                <Input
                  value={soldToName}
                  onChange={(e) => setSoldToName(e.target.value)}
                  placeholder="Buyer name"
                />
              </div>
              <div className="space-y-2">
                <Label>Sold To (Phone)</Label>
                <Input
                  value={soldToPhone}
                  onChange={(e) => setSoldToPhone(e.target.value)}
                  placeholder="Buyer phone"
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Sold By</Label>
                <Select value={soldBy} onValueChange={setSoldBy}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select sales rep" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__unassigned__">Unassigned</SelectItem>
                    {sortedSalespeople.map((sp) => (
                      <SelectItem key={sp.id} value={sp.id}>
                        {sp.name || "Unknown"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleAddSale} disabled={isSaving || !soldAmount || !soldDate} className="w-full">
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Sale
                </>
              )}
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
