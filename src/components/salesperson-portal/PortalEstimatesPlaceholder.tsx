import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calculator, Sparkles } from "lucide-react";

export function PortalEstimatesPlaceholder() {
  return (
    <Card className="border-0 shadow-lg bg-gradient-to-br from-primary/5 to-primary/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />
          Create Estimates
          <Badge className="bg-primary/20 text-primary border-0 ml-1">
            <Sparkles className="h-3 w-3 mr-1" />
            Coming Soon
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-center py-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Calculator className="h-8 w-8 text-primary" />
          </div>
          <h3 className="font-semibold text-foreground mb-1">Build Your Own Estimates</h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Soon you'll be able to create and send estimates directly from your mobile device.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
