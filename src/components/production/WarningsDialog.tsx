import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { useNavigate } from "react-router-dom";
import { differenceInDays, parseISO, format } from "date-fns";
import { AlertTriangle, FileWarning, Shield, ShieldAlert, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface WarningCounts {
  missingContract: number;
  missingPhases: number;
  phaseMismatch: number;
  contractMismatch: number;
}

interface BookkeepingWarningCounts {
  missingSalesperson: number;
  missingCompletionDate: number;
  overdueChecklists: number;
  pendingDeposits: number;
}

interface WarningsDialogProps {
  warningCounts: WarningCounts;
  bookkeepingWarningCounts: BookkeepingWarningCounts;
  totalWarnings: number;
  totalBookkeepingWarnings: number;
  onOpenWarningSheet: (type: 'missingContract' | 'missingPhases' | 'phaseMismatch' | 'contractMismatch' | 'missingSalesperson' | 'missingCompletionDate' | 'overdueChecklists') => void;
  onOpenPendingDeposits: () => void;
}

interface Subcontractor {
  id: string;
  company_name: string;
  license_expiration_date: string | null;
  insurance_expiration_date: string | null;
  is_active: boolean;
  do_not_require_license: boolean;
  do_not_require_insurance: boolean;
  subcontractor_type: string;
}

interface ExpirationWarning {
  subcontractor: Subcontractor;
  type: 'license' | 'insurance';
  daysUntilExpiry: number;
  expirationDate: string;
}

export function WarningsDialog({
  warningCounts,
  bookkeepingWarningCounts,
  totalWarnings,
  totalBookkeepingWarnings,
  onOpenWarningSheet,
  onOpenPendingDeposits,
}: WarningsDialogProps) {
  const navigate = useNavigate();
  const { companyId } = useCompanyContext();
  const [open, setOpen] = useState(false);

  // Fetch subcontractor warnings
  const { data: subcontractors = [] } = useQuery({
    queryKey: ["subcontractors-active", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("subcontractors")
        .select("id, company_name, license_expiration_date, insurance_expiration_date, is_active, do_not_require_license, do_not_require_insurance, subcontractor_type")
        .eq("is_active", true)
        .eq("company_id", companyId);
      if (error) throw error;
      return data as Subcontractor[];
    },
    enabled: !!companyId,
  });

  // Calculate subcontractor warnings
  const subWarnings: ExpirationWarning[] = [];
  const today = new Date();

  subcontractors.forEach((sub) => {
    const isSubcontractorType = sub.subcontractor_type === 'Subcontractor';
    
    if (isSubcontractorType && !sub.do_not_require_license && sub.license_expiration_date) {
      const licenseExpiry = parseISO(sub.license_expiration_date);
      const licenseDays = differenceInDays(licenseExpiry, today);
      if (licenseDays <= 30) {
        subWarnings.push({
          subcontractor: sub,
          type: 'license',
          daysUntilExpiry: licenseDays,
          expirationDate: sub.license_expiration_date,
        });
      }
    }

    if (isSubcontractorType && !sub.do_not_require_insurance && sub.insurance_expiration_date) {
      const insuranceExpiry = parseISO(sub.insurance_expiration_date);
      const insuranceDays = differenceInDays(insuranceExpiry, today);
      if (insuranceDays <= 30) {
        subWarnings.push({
          subcontractor: sub,
          type: 'insurance',
          daysUntilExpiry: insuranceDays,
          expirationDate: sub.insurance_expiration_date,
        });
      }
    }
  });

  subWarnings.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

  const subExpiredCount = subWarnings.filter(w => w.daysUntilExpiry < 0).length;
  const subExpiringCount = subWarnings.filter(w => w.daysUntilExpiry >= 0 && w.daysUntilExpiry <= 30).length;
  const totalSubWarnings = subWarnings.length;

  // Grand total of all warnings
  const grandTotal = totalWarnings + totalBookkeepingWarnings + totalSubWarnings;

  if (grandTotal === 0) {
    return null;
  }

  const getSubStatusBadge = (days: number) => {
    if (days < 0) {
      return (
        <Badge variant="destructive" className="text-xs">
          Expired {Math.abs(days)}d ago
        </Badge>
      );
    }
    if (days <= 7) {
      return (
        <Badge variant="destructive" className="text-xs">
          {days}d left
        </Badge>
      );
    }
    return (
      <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30 text-xs">
        {days}d left
      </Badge>
    );
  };

  const handleWarningClick = (type: 'missingContract' | 'missingPhases' | 'phaseMismatch' | 'contractMismatch' | 'missingSalesperson' | 'missingCompletionDate' | 'overdueChecklists') => {
    setOpen(false);
    onOpenWarningSheet(type);
  };

  const handlePendingDepositsClick = () => {
    setOpen(false);
    onOpenPendingDeposits();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="relative">
          <AlertTriangle className="h-4 w-4 mr-2 text-amber-500" />
          Warnings
          <Badge 
            variant="destructive" 
            className="absolute -top-2 -right-2 h-5 min-w-5 px-1.5 text-xs"
          >
            {grandTotal}
          </Badge>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Project Warnings ({grandTotal})
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-3 pr-4">
            {/* Financial Warnings */}
            {totalWarnings > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Financial Warnings
                  <Badge variant="outline" className="ml-auto bg-amber-500/20 text-amber-600 border-amber-500/30">
                    {totalWarnings}
                  </Badge>
                </h4>
                <div className="flex flex-wrap gap-2">
                  {warningCounts.missingContract > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive/20"
                      onClick={() => handleWarningClick('missingContract')}
                    >
                      <Badge variant="outline" className="mr-1.5 h-4 px-1 text-[9px] bg-destructive text-destructive-foreground border-0">
                        C
                      </Badge>
                      No Contract: {warningCounts.missingContract}
                    </Button>
                  )}
                  {warningCounts.missingPhases > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs bg-orange-500/10 border-orange-500/30 text-orange-600 hover:bg-orange-500/20"
                      onClick={() => handleWarningClick('missingPhases')}
                    >
                      <Badge variant="outline" className="mr-1.5 h-4 px-1 text-[9px] bg-orange-500 text-white border-0">
                        P
                      </Badge>
                      No Phases: {warningCounts.missingPhases}
                    </Button>
                  )}
                  {warningCounts.phaseMismatch > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs bg-amber-500/10 border-amber-500/30 text-amber-600 hover:bg-amber-500/20"
                      onClick={() => handleWarningClick('phaseMismatch')}
                    >
                      <AlertTriangle className="h-3 w-3 mr-1.5" />
                      Phase Mismatch: {warningCounts.phaseMismatch}
                    </Button>
                  )}
                  {warningCounts.contractMismatch > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs bg-red-500/10 border-red-500/30 text-red-600 hover:bg-red-500/20"
                      onClick={() => handleWarningClick('contractMismatch')}
                    >
                      <Badge variant="outline" className="mr-1.5 h-4 px-1 text-[9px] bg-red-500 text-white border-0">
                        $
                      </Badge>
                      Contract Mismatch: {warningCounts.contractMismatch}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Bookkeeping Warnings */}
            {totalBookkeepingWarnings > 0 && (
              <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
                <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4 text-blue-500" />
                  Bookkeeping Warnings
                  <Badge variant="outline" className="ml-auto bg-blue-500/20 text-blue-600 border-blue-500/30">
                    {totalBookkeepingWarnings}
                  </Badge>
                </h4>
                <div className="flex flex-wrap gap-2">
                  {bookkeepingWarningCounts.missingSalesperson > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs bg-blue-500/10 border-blue-500/30 text-blue-600 hover:bg-blue-500/20"
                      onClick={() => handleWarningClick('missingSalesperson')}
                    >
                      <Badge variant="outline" className="mr-1.5 h-4 px-1 text-[9px] bg-blue-500 text-white border-0">
                        S
                      </Badge>
                      No Salesperson: {bookkeepingWarningCounts.missingSalesperson}
                    </Button>
                  )}
                  {bookkeepingWarningCounts.missingCompletionDate > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs bg-red-500/10 border-red-500/30 text-red-600 hover:bg-red-500/20"
                      onClick={() => handleWarningClick('missingCompletionDate')}
                    >
                      <Badge variant="outline" className="mr-1.5 h-4 px-1 text-[9px] bg-red-500 text-white border-0">
                        E
                      </Badge>
                      No End Date: {bookkeepingWarningCounts.missingCompletionDate}
                    </Button>
                  )}
                  {bookkeepingWarningCounts.overdueChecklists > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs bg-orange-500/10 border-orange-500/30 text-orange-600 hover:bg-orange-500/20"
                      onClick={() => handleWarningClick('overdueChecklists')}
                    >
                      <Badge variant="outline" className="mr-1.5 h-4 px-1 text-[9px] bg-orange-500 text-white border-0">
                        C
                      </Badge>
                      Overdue Checklists: {bookkeepingWarningCounts.overdueChecklists}
                    </Button>
                  )}
                  {bookkeepingWarningCounts.pendingDeposits > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs bg-purple-500/10 border-purple-500/30 text-purple-600 hover:bg-purple-500/20"
                      onClick={handlePendingDepositsClick}
                    >
                      <Badge variant="outline" className="mr-1.5 h-4 px-1 text-[9px] bg-purple-500 text-white border-0">
                        $
                      </Badge>
                      Pending Deposits: {bookkeepingWarningCounts.pendingDeposits}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Subcontractor Warnings */}
            {totalSubWarnings > 0 && (
              <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-4">
                <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                  <ShieldAlert className="h-4 w-4 text-orange-500" />
                  Subcontractor Documents
                  <div className="flex gap-1 ml-auto">
                    {subExpiredCount > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {subExpiredCount} Expired
                      </Badge>
                    )}
                    {subExpiringCount > 0 && (
                      <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30 text-xs">
                        {subExpiringCount} Expiring
                      </Badge>
                    )}
                  </div>
                </h4>
                <div className="space-y-2">
                  {subWarnings.slice(0, 5).map((warning, idx) => (
                    <div
                      key={`${warning.subcontractor.id}-${warning.type}-${idx}`}
                      className="flex items-center justify-between py-2 px-3 rounded-md bg-background/80 border border-border/50"
                    >
                      <div className="flex items-center gap-3">
                        {warning.type === 'license' ? (
                          <FileWarning className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Shield className="h-4 w-4 text-muted-foreground" />
                        )}
                        <div>
                          <p className="text-sm font-medium">{warning.subcontractor.company_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {warning.type === 'license' ? 'License' : 'Insurance'} expires {format(parseISO(warning.expirationDate), 'MMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                      {getSubStatusBadge(warning.daysUntilExpiry)}
                    </div>
                  ))}
                  {subWarnings.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center">
                      +{subWarnings.length - 5} more warning{subWarnings.length - 5 > 1 ? 's' : ''}
                    </p>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => {
                      setOpen(false);
                      navigate('/production?view=subcontractors');
                    }}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Manage Subcontractors
                  </Button>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
