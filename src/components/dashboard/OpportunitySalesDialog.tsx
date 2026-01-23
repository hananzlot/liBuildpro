import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { toast } from "sonner";
import { Loader2, DollarSign, Plus, Trash2 } from "lucide-react";
import { findUserByIdOrGhlId } from "@/lib/utils";

interface GHLUser {
  id?: string;
  ghl_id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  location_id?: string;
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
  users: GHLUser[];
  userId?: string;
  userGhlId?: string | null;
  onSalesUpdated: () => void;
}

const PRIMARY_LOCATION_ID = "pVeFrqvtYWNIPRIi0Fmr";

export function OpportunitySalesDialog({
  open,
  onOpenChange,
  opportunityId,
  contactId,
  locationId,
  users,
  userId,
  userGhlId,
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

  // Filter users to primary location only
  const filteredUsers = users
    .filter(u => !u.location_id || u.location_id === PRIMARY_LOCATION_ID)
    .sort((a, b) => {
      const nameA = (a.name || `${a.first_name || ''} ${a.last_name || ''}`.trim() || a.email || 'Unknown').toLowerCase();
      const nameB = (b.name || `${b.first_name || ''} ${b.last_name || ''}`.trim() || b.email || 'Unknown').toLowerCase();
      return nameA.localeCompare(nameB);
    });

  // Fetch existing sales
  useEffect(() => {
    if (open && opportunityId) {
      fetchSales();
      // Set default sold_by to logged in user's GHL ID
      if (userGhlId) {
        setSoldBy(userGhlId);
      }
    }
  }, [open, opportunityId, userGhlId]);

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
        sold_by: soldBy || null,
        entered_by: userId,
        company_id: companyId,
      });

      if (error) throw error;

      toast.success("Sale added successfully");
      setSoldAmount("");
      setSoldDate(new Date().toISOString().split("T")[0]);
      setSoldToName("");
      setSoldToPhone("");
      if (userGhlId) setSoldBy(userGhlId);
      
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

  const getUserName = (ghlId: string | null) => {
    if (!ghlId) return "Unknown";
    const user = findUserByIdOrGhlId(users, undefined, ghlId);
    if (!user) return "Unknown";
    return user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || "Unknown";
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
                      {getUserName(sale.sold_by)}
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
                    {filteredUsers.map((user) => (
                      <SelectItem key={user.ghl_id} value={user.ghl_id}>
                        {user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || "Unknown"}
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
