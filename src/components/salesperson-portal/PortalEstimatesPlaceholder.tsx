import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calculator, Sparkles } from "lucide-react";

export function PortalEstimatesPlaceholder() {
  return (
    <Card className="border border-border/50 shadow-md rounded-xl overflow-hidden">
      <CardHeader className="pb-3 pt-4 px-4 bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Calculator className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                Create Estimates
                <Badge className="bg-amber-100 text-amber-700 border-0 text-[10px] px-1.5">
                  <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                  Soon
                </Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground">Build estimates on mobile</p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-3 pb-4 px-4">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-dashed border-border">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Calculator className="h-6 w-6 text-primary/60" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Coming Soon</p>
            <p className="text-xs text-muted-foreground">
              Create & send estimates from your phone
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
