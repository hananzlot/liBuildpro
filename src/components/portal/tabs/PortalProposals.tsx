import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Eye,
  Calendar,
  Globe
} from 'lucide-react';
import { format } from 'date-fns';

interface PortalProposalsProps {
  estimates: any[];
  projectId: string;
  token: string;
}

export function PortalProposals({ estimates, projectId, token }: PortalProposalsProps) {
  const [selectedEstimateId, setSelectedEstimateId] = useState<string | null>(null);
  const [viewingProposal, setViewingProposal] = useState(false);

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
      draft: { label: 'Draft', variant: 'outline', icon: <FileText className="h-3 w-3" /> },
      sent: { label: 'Awaiting Review', variant: 'secondary', icon: <Clock className="h-3 w-3" /> },
      viewed: { label: 'Viewed', variant: 'secondary', icon: <Eye className="h-3 w-3" /> },
      accepted: { label: 'Accepted', variant: 'default', icon: <CheckCircle2 className="h-3 w-3" /> },
      declined: { label: 'Declined', variant: 'destructive', icon: <XCircle className="h-3 w-3" /> },
      expired: { label: 'Expired', variant: 'outline', icon: <Clock className="h-3 w-3" /> },
    };
    const config = statusConfig[status] || { label: status, variant: 'outline', icon: null };
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  // If viewing a specific proposal, show simple details instead of full view
  if (viewingProposal && selectedEstimateId) {
    const selectedEstimate = estimates.find(e => e.id === selectedEstimateId);
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => setViewingProposal(false)}>
          ← Back to Proposals
        </Button>
        {selectedEstimate && (
          <Card>
            <CardContent className="p-6">
              <h3 className="text-xl font-semibold mb-4">{selectedEstimate.estimate_title}</h3>
              <p className="text-2xl font-bold text-primary mb-4">{formatCurrency(selectedEstimate.total)}</p>
              <p className="text-muted-foreground">Full proposal details available upon request.</p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  if (estimates.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold">No Proposals Yet</h3>
          <p className="text-muted-foreground">
            Proposals will appear here once they are sent to you.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Proposal History</h2>
        <p className="text-sm text-muted-foreground">{estimates.length} proposal(s)</p>
      </div>

      <div className="space-y-4">
        {estimates.map((estimate) => {
          const signature = estimate.estimate_signatures?.[0];
          
          return (
            <Card key={estimate.id} className={estimate.status === 'accepted' ? 'border-green-200 bg-green-50/30' : ''}>
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  {/* Proposal Info */}
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-lg">{estimate.estimate_title}</h3>
                      {getStatusBadge(estimate.status)}
                    </div>
                    <p className="text-sm text-muted-foreground font-mono">
                      Proposal #{estimate.estimate_number}
                    </p>
                    
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-2">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        Created: {format(new Date(estimate.estimate_date), 'MMM d, yyyy')}
                      </span>
                      {estimate.sent_at && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          Sent: {format(new Date(estimate.sent_at), 'MMM d, yyyy')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary">
                      {formatCurrency(estimate.total)}
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-2"
                      onClick={() => {
                        setSelectedEstimateId(estimate.id);
                        setViewingProposal(true);
                      }}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                  </div>
                </div>

                {/* Status Details */}
                {(estimate.status === 'accepted' || estimate.status === 'declined') && (
                  <>
                    <Separator className="my-4" />
                    <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                      {estimate.status === 'accepted' && (
                        <>
                          <div className="flex items-center gap-2 text-green-700">
                            <CheckCircle2 className="h-5 w-5" />
                            <span className="font-medium">Proposal Accepted</span>
                          </div>
                          {signature && (
                            <div className="text-sm text-muted-foreground space-y-1">
                              <p>
                                <span className="font-medium">Signed by:</span> {signature.signer_name}
                                {signature.signer_email && ` (${signature.signer_email})`}
                              </p>
                              <p>
                                <span className="font-medium">Date:</span>{' '}
                                {format(new Date(signature.signed_at), 'MMM d, yyyy h:mm a')}
                              </p>
                              {signature.ip_address && (
                                <p className="flex items-center gap-1">
                                  <Globe className="h-3 w-3" />
                                  <span className="font-medium">IP:</span> {signature.ip_address}
                                </p>
                              )}
                            </div>
                          )}
                        </>
                      )}
                      {estimate.status === 'declined' && (
                        <>
                          <div className="flex items-center gap-2 text-red-700">
                            <XCircle className="h-5 w-5" />
                            <span className="font-medium">Proposal Declined</span>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            {estimate.declined_at && (
                              <p>
                                <span className="font-medium">Date:</span>{' '}
                                {format(new Date(estimate.declined_at), 'MMM d, yyyy h:mm a')}
                              </p>
                            )}
                            {estimate.decline_reason && (
                              <p>
                                <span className="font-medium">Reason:</span> {estimate.decline_reason}
                              </p>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
