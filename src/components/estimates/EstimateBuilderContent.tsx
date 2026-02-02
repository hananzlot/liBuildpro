import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { EstimateBuilderDialog } from "./EstimateBuilderDialog";

import type { LinkedOpportunity } from "./EstimateSourceDialog";

interface EstimateBuilderContentProps {
  estimateId?: string | null;
  linkedOpportunity?: LinkedOpportunity | null;
  createOpportunityOnSave?: boolean;
  initialWorkScope?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * Full-page Estimate Builder content.
 * This renders the EstimateBuilderDialog in "page" mode - without the modal wrapper.
 */
export function EstimateBuilderContent({ 
  estimateId, 
  linkedOpportunity, 
  createOpportunityOnSave = false,
  initialWorkScope,
  onClose,
  onSuccess 
}: EstimateBuilderContentProps) {
  return (
    <div className="h-full flex flex-col estimate-builder-page">
      <EstimateBuilderDialog
        open={true}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        estimateId={estimateId}
        linkedOpportunity={linkedOpportunity}
        createOpportunityOnSave={createOpportunityOnSave}
        initialWorkScope={initialWorkScope}
        onSuccess={onSuccess}
        mode="page"
      />
    </div>
  );
}