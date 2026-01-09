import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, FileWarning, Shield, ShieldAlert, ExternalLink } from "lucide-react";
import { differenceInDays, parseISO, format } from "date-fns";
import { useNavigate } from "react-router-dom";

interface Subcontractor {
  id: string;
  company_name: string;
  license_expiration_date: string;
  insurance_expiration_date: string;
  is_active: boolean;
}

interface ExpirationWarning {
  subcontractor: Subcontractor;
  type: 'license' | 'insurance';
  daysUntilExpiry: number;
  expirationDate: string;
}

export function SubcontractorWarningsCard() {
  const navigate = useNavigate();

  const { data: subcontractors = [] } = useQuery({
    queryKey: ["subcontractors-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subcontractors")
        .select("id, company_name, license_expiration_date, insurance_expiration_date, is_active")
        .eq("is_active", true);
      if (error) throw error;
      return data as Subcontractor[];
    },
  });

  // Calculate warnings for expiring/expired documents
  const warnings: ExpirationWarning[] = [];
  const today = new Date();

  subcontractors.forEach((sub) => {
    // Check license
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

    // Check insurance
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
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            Subcontractor Document Warnings
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
    </Card>
  );
}
