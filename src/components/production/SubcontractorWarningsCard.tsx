import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FileWarning, Shield, ShieldAlert, ExternalLink, ChevronDown } from "lucide-react";
import { differenceInDays, parseISO, format } from "date-fns";
import { useNavigate } from "react-router-dom";
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

export function SubcontractorWarningsCard() {
  const navigate = useNavigate();
  const { companyId } = useCompanyContext();
  const [isOpen, setIsOpen] = useState(false);

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

  // Calculate warnings for expiring/expired documents
  const warnings: ExpirationWarning[] = [];
  const today = new Date();

  subcontractors.forEach((sub) => {
    // Only check license/insurance for "Subcontractor" type and if not exempted
    const isSubcontractorType = sub.subcontractor_type === 'Subcontractor';
    
    // Check license - only if required
    if (isSubcontractorType && !sub.do_not_require_license && sub.license_expiration_date) {
      const licenseExpiry = parseISO(sub.license_expiration_date);
      const licenseDays = differenceInDays(licenseExpiry, today);
      if (licenseDays <= 30) {
        warnings.push({
          subcontractor: sub,
          type: 'license',
          daysUntilExpiry: licenseDays,
          expirationDate: sub.license_expiration_date,
        });
      }
    }

    // Check insurance - only if required
    if (isSubcontractorType && !sub.do_not_require_insurance && sub.insurance_expiration_date) {
      const insuranceExpiry = parseISO(sub.insurance_expiration_date);
      const insuranceDays = differenceInDays(insuranceExpiry, today);
      if (insuranceDays <= 30) {
        warnings.push({
          subcontractor: sub,
          type: 'insurance',
          daysUntilExpiry: insuranceDays,
          expirationDate: sub.insurance_expiration_date,
        });
      }
    }
  });

  // Sort by urgency (most critical first)
  warnings.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

  const expiredCount = warnings.filter(w => w.daysUntilExpiry < 0).length;
  const expiringCount = warnings.filter(w => w.daysUntilExpiry >= 0 && w.daysUntilExpiry <= 30).length;

  if (warnings.length === 0) {
    return null;
  }

  const getStatusBadge = (days: number) => {
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

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover:bg-amber-500/10 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-500" />
                Subcontractor Document Warnings
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </CardTitle>
              <div className="flex gap-2">
                {expiredCount > 0 && (
                  <Badge variant="destructive">
                    {expiredCount} Expired
                  </Badge>
                )}
                {expiringCount > 0 && (
                  <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30">
                    {expiringCount} Expiring Soon
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {warnings.slice(0, 5).map((warning, idx) => (
                <div
                  key={`${warning.subcontractor.id}-${warning.type}-${idx}`}
                  className="flex items-center justify-between py-2 px-3 rounded-md bg-background/50 border border-border/50"
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
                  {getStatusBadge(warning.daysUntilExpiry)}
                </div>
              ))}
            </div>
            {warnings.length > 5 && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                +{warnings.length - 5} more warning{warnings.length - 5 > 1 ? 's' : ''}
              </p>
            )}
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-3"
              onClick={() => navigate('/production?view=subcontractors')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Manage Subcontractors
            </Button>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
