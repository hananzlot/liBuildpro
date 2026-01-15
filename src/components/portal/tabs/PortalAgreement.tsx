import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Download, 
  Calendar,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';

interface PortalAgreementProps {
  agreements: any[];
  acceptedEstimate?: any;
}

export function PortalAgreement({ agreements, acceptedEstimate }: PortalAgreementProps) {
  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const hasAgreement = agreements.length > 0 || acceptedEstimate;

  if (!hasAgreement) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold">No Agreement Yet</h3>
          <p className="text-muted-foreground">
            Your contract agreement will appear here once a proposal is accepted.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Accepted Estimate as Agreement */}
      {acceptedEstimate && (
        <Card className="border-green-200 bg-green-50/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
                <div>
                  <CardTitle>Signed Contract</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Contract #{acceptedEstimate.estimate_number}
                  </p>
                </div>
              </div>
              <Badge variant="default" className="bg-green-600">Active</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Contract Title</p>
                <p className="font-medium">{acceptedEstimate.estimate_title}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Contract Value</p>
                <p className="font-semibold text-lg text-primary">
                  {formatCurrency(acceptedEstimate.total)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Signed Date</p>
                <p className="font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {acceptedEstimate.signed_at 
                    ? format(new Date(acceptedEstimate.signed_at), 'MMM d, yyyy')
                    : 'N/A'}
                </p>
              </div>
            </div>

            {acceptedEstimate.terms_and_conditions && (
              <div className="mt-4 p-4 bg-background rounded-lg border">
                <h4 className="font-medium mb-2">Terms & Conditions</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {acceptedEstimate.terms_and_conditions}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Additional Project Agreements */}
      {agreements.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Additional Agreements</h3>
          {agreements.map((agreement) => (
            <Card key={agreement.id}>
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <h4 className="font-medium">
                        {agreement.agreement_type || 'Agreement'}
                        {agreement.agreement_number && ` #${agreement.agreement_number}`}
                      </h4>
                    </div>
                    {agreement.description_of_work && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {agreement.description_of_work}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      {agreement.agreement_signed_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          Signed: {format(new Date(agreement.agreement_signed_date), 'MMM d, yyyy')}
                        </span>
                      )}
                      {agreement.total_price && (
                        <span className="font-medium text-foreground">
                          {formatCurrency(agreement.total_price)}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {agreement.attachment_url && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={agreement.attachment_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View Document
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
