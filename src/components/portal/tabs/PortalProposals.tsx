import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Eye,
  Calendar,
  Globe,
  ArrowLeft,
  DollarSign,
  TrendingUp,
  Shield
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

  const getStatusConfig = (status: string) => {
    const config: Record<string, { 
      label: string; 
      bgColor: string; 
      textColor: string; 
      icon: React.ReactNode;
      ringColor: string;
    }> = {
      draft: { 
        label: 'Draft', 
        bgColor: 'bg-slate-100', 
        textColor: 'text-slate-700',
        icon: <FileText className="h-3.5 w-3.5" />,
        ringColor: 'ring-slate-200'
      },
      sent: { 
        label: 'Awaiting Review', 
        bgColor: 'bg-amber-50', 
        textColor: 'text-amber-700',
        icon: <Clock className="h-3.5 w-3.5" />,
        ringColor: 'ring-amber-200'
      },
      viewed: { 
        label: 'Viewed', 
        bgColor: 'bg-blue-50', 
        textColor: 'text-blue-700',
        icon: <Eye className="h-3.5 w-3.5" />,
        ringColor: 'ring-blue-200'
      },
      accepted: { 
        label: 'Accepted', 
        bgColor: 'bg-green-50', 
        textColor: 'text-green-700',
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
        ringColor: 'ring-green-200'
      },
      declined: { 
        label: 'Declined', 
        bgColor: 'bg-red-50', 
        textColor: 'text-red-700',
        icon: <XCircle className="h-3.5 w-3.5" />,
        ringColor: 'ring-red-200'
      },
      expired: { 
        label: 'Expired', 
        bgColor: 'bg-slate-100', 
        textColor: 'text-slate-600',
        icon: <Clock className="h-3.5 w-3.5" />,
        ringColor: 'ring-slate-200'
      },
    };
    return config[status] || config.draft;
  };

  // If viewing a specific proposal, show simple details instead of full view
  if (viewingProposal && selectedEstimateId) {
    const selectedEstimate = estimates.find(e => e.id === selectedEstimateId);
    return (
      <div className="space-y-6">
        <Button 
          variant="ghost" 
          onClick={() => setViewingProposal(false)}
          className="gap-2 text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Proposals
        </Button>
        {selectedEstimate && (
          <Card className="border-0 shadow-lg overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-primary to-primary/70" />
            <CardContent className="p-8">
              <div className="space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900">{selectedEstimate.estimate_title}</h3>
                    <p className="text-slate-500 mt-1">Proposal #{selectedEstimate.estimate_number}</p>
                  </div>
                  {(() => {
                    const statusConfig = getStatusConfig(selectedEstimate.status);
                    return (
                      <Badge className={`${statusConfig.bgColor} ${statusConfig.textColor} border-0 gap-1.5`}>
                        {statusConfig.icon}
                        {statusConfig.label}
                      </Badge>
                    );
                  })()}
                </div>
                
                <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl p-6 border border-primary/10">
                  <p className="text-sm text-slate-500 mb-1">Total Amount</p>
                  <p className="text-4xl font-bold text-primary">{formatCurrency(selectedEstimate.total)}</p>
                </div>
                
                <p className="text-slate-500">Full proposal details available upon request.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  if (estimates.length === 0) {
    return (
      <Card className="border-0 shadow-lg overflow-hidden">
        <CardContent className="py-16 text-center">
          <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-6">
            <FileText className="h-10 w-10 text-slate-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">No Proposals Yet</h3>
          <p className="text-slate-500 max-w-sm mx-auto">
            Your proposals will appear here once they are sent to you for review.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Stats
  const totalValue = estimates.reduce((sum, e) => sum + (e.total || 0), 0);
  const acceptedCount = estimates.filter(e => e.status === 'accepted').length;

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md bg-gradient-to-br from-slate-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{estimates.length}</p>
                <p className="text-xs text-slate-500">Total Proposals</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-md bg-gradient-to-br from-green-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{acceptedCount}</p>
                <p className="text-xs text-slate-500">Accepted</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-white col-span-2">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalValue)}</p>
                <p className="text-xs text-slate-500">Total Value</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Proposals List */}
      <div className="space-y-4">
        {estimates.map((estimate) => {
          const signature = estimate.estimate_signatures?.[0];
          const statusConfig = getStatusConfig(estimate.status);
          const isAccepted = estimate.status === 'accepted';
          const isDeclined = estimate.status === 'declined';
          
          return (
            <Card 
              key={estimate.id} 
              className={`border-0 shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl ${
                isAccepted ? 'ring-2 ring-green-200' : ''
              }`}
            >
              {isAccepted && (
                <div className="h-1 bg-gradient-to-r from-green-400 to-green-600" />
              )}
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  {/* Proposal Info */}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-start gap-3 flex-wrap">
                      <Badge className={`${statusConfig.bgColor} ${statusConfig.textColor} border-0 gap-1.5 ring-1 ${statusConfig.ringColor}`}>
                        {statusConfig.icon}
                        {statusConfig.label}
                      </Badge>
                      <span className="text-sm text-slate-400 font-mono">
                        #{estimate.estimate_number}
                      </span>
                    </div>
                    
                    <h3 className="font-bold text-lg text-slate-900">{estimate.estimate_title}</h3>
                    
                    <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-4 w-4" />
                        Created {format(new Date(estimate.estimate_date), 'MMM d, yyyy')}
                      </span>
                      {estimate.sent_at && (
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-4 w-4" />
                          Sent {format(new Date(estimate.sent_at), 'MMM d, yyyy')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Amount & Action */}
                  <div className="flex flex-col items-end gap-3">
                    <div className="text-right">
                      <p className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                        {formatCurrency(estimate.total)}
                      </p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="shadow-sm"
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
                {(isAccepted || isDeclined) && (
                  <div className={`mt-6 rounded-xl p-5 ${isAccepted ? 'bg-green-50' : 'bg-red-50'}`}>
                    {isAccepted && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-green-700">
                          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                            <CheckCircle2 className="h-4 w-4" />
                          </div>
                          <span className="font-semibold">Proposal Accepted</span>
                        </div>
                        {signature && (
                          <div className="grid sm:grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-green-600/70 text-xs uppercase tracking-wider mb-1">Signed By</p>
                              <p className="text-green-800 font-medium">{signature.signer_name}</p>
                              {signature.signer_email && (
                                <p className="text-green-600 text-xs">{signature.signer_email}</p>
                              )}
                            </div>
                            <div>
                              <p className="text-green-600/70 text-xs uppercase tracking-wider mb-1">Date</p>
                              <p className="text-green-800 font-medium">
                                {format(new Date(signature.signed_at), 'MMM d, yyyy')}
                              </p>
                              <p className="text-green-600 text-xs">
                                {format(new Date(signature.signed_at), 'h:mm a')}
                              </p>
                            </div>
                            {signature.ip_address && (
                              <div>
                                <p className="text-green-600/70 text-xs uppercase tracking-wider mb-1">Verification</p>
                                <p className="text-green-800 font-medium flex items-center gap-1.5">
                                  <Shield className="h-3.5 w-3.5" />
                                  Digitally Signed
                                </p>
                                <p className="text-green-600 text-xs">IP: {signature.ip_address}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {isDeclined && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-red-700">
                          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                            <XCircle className="h-4 w-4" />
                          </div>
                          <span className="font-semibold">Proposal Declined</span>
                        </div>
                        <div className="text-sm text-red-700 space-y-1">
                          {estimate.declined_at && (
                            <p>
                              <span className="text-red-600/70">Date:</span>{' '}
                              {format(new Date(estimate.declined_at), 'MMM d, yyyy h:mm a')}
                            </p>
                          )}
                          {estimate.decline_reason && (
                            <p>
                              <span className="text-red-600/70">Reason:</span>{' '}
                              {estimate.decline_reason}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}