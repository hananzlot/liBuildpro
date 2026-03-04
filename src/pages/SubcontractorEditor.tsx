import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { useAppTabs } from "@/contexts/AppTabsContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { SubcontractorEditorContent } from "@/components/production/SubcontractorEditorContent";

/**
 * Full-page Subcontractor Editor that opens in its own tab.
 * Routes:
 * - /vendor/new - Create new subcontractor
 * - /vendor/:id - Edit existing subcontractor
 */
export default function SubcontractorEditor() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { companyId } = useCompanyContext();
  const { closeTab, tabs, activeTabId } = useAppTabs();

  const isNew = !id;
  const subcontractorId = isNew ? null : id;

  const handleClose = () => {
    navigate("/production?view=subcontractors");
    const currentTab = tabs.find(t => t.id === activeTabId);
    if (currentTab) {
      closeTab(currentTab.id);
    }
  };

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["subcontractors", companyId] });
  };

  return (
    <AppLayout>
      <SubcontractorEditorContent
        subcontractorId={subcontractorId}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />
    </AppLayout>
  );
}
