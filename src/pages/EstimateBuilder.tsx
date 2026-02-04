import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { useAppTabs } from "@/contexts/AppTabsContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { EstimateBuilderContent } from "@/components/estimates/EstimateBuilderContent";
import { EstimateSourceDialog, LinkedOpportunity } from "@/components/estimates/EstimateSourceDialog";
import { useState, useEffect, useRef } from "react";

/**
 * Full-page Estimate Builder that opens in its own tab.
 * Routes:
 * - /estimate/new - Create new estimate (shows source dialog first)
 * - /estimate/:id - Edit existing estimate
 * - /estimate/clone/:id - Clone from existing estimate
 */
export default function EstimateBuilder() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { companyId } = useCompanyContext();
  const { closeTab, tabs, activeTabId } = useAppTabs();
  
  // Determine if we're creating new, editing, or cloning
  const isNew = !id;
  const isClone = id?.startsWith("clone:");
  const estimateId = isClone ? id : (isNew ? null : id);
  
  // URL-driven source info (prevents showing the source dialog twice)
  const createOpportunityParam = searchParams.get("createOpportunity") === "1";
  const oppId = searchParams.get("opportunityId");
  const oppGhlId = searchParams.get("opportunityGhlId");
  const hasOpportunityParams = !!(oppId || oppGhlId);

  const initialLinkedOpportunity: LinkedOpportunity | null = hasOpportunityParams
    ? {
        id: oppId || "",
        ghl_id: oppGhlId || null,
        name: searchParams.get("name") || "",
        contact_name: searchParams.get("contactName") || "",
        contact_email: searchParams.get("contactEmail") || null,
        contact_phone: searchParams.get("contactPhone") || null,
        address: searchParams.get("address") || null,
        scope_of_work: searchParams.get("scope") || null,
        salesperson_name: searchParams.get("salesperson") || null,
        contact_uuid: searchParams.get("contactUuid") || null,
        contact_id: searchParams.get("contactId") || null,
        lead_source: searchParams.get("leadSource") || null,
      }
    : null;

  // Source dialog state for new estimates
  const [sourceDialogCompleted, setSourceDialogCompleted] = useState(
    hasOpportunityParams || createOpportunityParam
  );
  const [sourceDialogOpen, setSourceDialogOpen] = useState(
    isNew && !(hasOpportunityParams || createOpportunityParam)
  );
  const [linkedOpportunity, setLinkedOpportunity] = useState<LinkedOpportunity | null>(
    initialLinkedOpportunity
  );
  const [createOpportunityOnSave, setCreateOpportunityOnSave] = useState(createOpportunityParam);
  // Radix Dialog will call onOpenChange when open prop flips to false.
  // When the user clicks Continue we close the dialog programmatically and must NOT treat that as cancel.
  const ignoreNextDialogCloseRef = useRef(false);
  
  // Show source dialog for new estimates on mount
  useEffect(() => {
    if (isNew && !sourceDialogCompleted) {
      // Check if we have opportunity data in search params (from opportunity page)
      const oppId = searchParams.get("opportunityId");
      const oppGhlId = searchParams.get("opportunityGhlId");
      const contactName = searchParams.get("contactName");
      
      if (oppId || oppGhlId) {
        // Pre-populate from URL params
        setLinkedOpportunity({
          id: oppId || "",
          ghl_id: oppGhlId || null,
          name: searchParams.get("name") || "",
          contact_name: contactName || "",
          contact_email: searchParams.get("contactEmail") || null,
          contact_phone: searchParams.get("contactPhone") || null,
          address: searchParams.get("address") || null,
          scope_of_work: searchParams.get("scope") || null,
          salesperson_name: searchParams.get("salesperson") || null,
          contact_uuid: searchParams.get("contactUuid") || null,
          contact_id: searchParams.get("contactId") || null,
          lead_source: searchParams.get("leadSource") || null,
        });
        setSourceDialogCompleted(true);
      } else {
        setSourceDialogOpen(true);
      }
    }
  }, [isNew, sourceDialogCompleted, searchParams]);

  // Handle source dialog completion
  const handleSourceDialogContinue = (opportunity: LinkedOpportunity | null, createOpp: boolean) => {
    ignoreNextDialogCloseRef.current = true;
    setLinkedOpportunity(opportunity);
    setCreateOpportunityOnSave(createOpp);
    setSourceDialogOpen(false);
    setSourceDialogCompleted(true);
  };

  // Handle source dialog cancel - close the tab
  const handleSourceDialogCancel = () => {
    setSourceDialogOpen(false);
    // Find and close this tab
    const currentTab = tabs.find(t => t.id === activeTabId);
    if (currentTab) {
      closeTab(currentTab.id);
    } else {
      navigate("/estimates");
    }
  };
  
  // Handle closing the builder
  const handleClose = () => {
    // Navigate back to estimates with proper view
    navigate("/estimates");
    
    // Close this tab
    const currentTab = tabs.find(t => t.id === activeTabId);
    if (currentTab) {
      closeTab(currentTab.id);
    }
  };
  
  // Handle successful save
  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["estimates", companyId] });
  };

  // For new estimates, show source dialog first
  if (isNew && !sourceDialogCompleted) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <EstimateSourceDialog
            open={sourceDialogOpen}
            onOpenChange={(open) => {
              if (open) {
                setSourceDialogOpen(true);
                return;
              }

              // If we're closing because the user clicked Continue, ignore this close request.
              if (ignoreNextDialogCloseRef.current) {
                ignoreNextDialogCloseRef.current = false;
                setSourceDialogOpen(false);
                return;
              }

              // Otherwise, treat as cancel (escape key / outside click / cancel button)
              handleSourceDialogCancel();
            }}
            onContinue={handleSourceDialogContinue}
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <EstimateBuilderContent
        estimateId={estimateId}
        linkedOpportunity={linkedOpportunity}
        createOpportunityOnSave={createOpportunityOnSave}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />
    </AppLayout>
  );
}
