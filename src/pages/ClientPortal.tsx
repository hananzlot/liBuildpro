import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { PortalEstimateView } from '@/components/portal/PortalEstimateView';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

export default function ClientPortal() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  if (!token) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-xl font-semibold">Invalid Link</h2>
            <p className="text-muted-foreground">
              This link is missing required information. Please check your email for the correct link or contact us for assistance.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <PortalEstimateView token={token} />;
}
