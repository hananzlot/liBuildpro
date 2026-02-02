import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { useAppTabs } from "@/contexts/AppTabsContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProjectEditorContent } from "@/components/production/ProjectEditorContent";

/**
 * Full-page Project Editor that opens in its own tab.
 * Routes:
 * - /project/new - Create new project
 * - /project/:id - Edit existing project
 */
export default function ProjectEditor() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { companyId } = useCompanyContext();
  const { closeTab, tabs, activeTabId } = useAppTabs();
  
  const isNew = !id;
  const projectId = isNew ? null : id;
  
  // Handle closing the editor
  const handleClose = () => {
    navigate("/production");
    
    // Close this tab
    const currentTab = tabs.find(t => t.id === activeTabId);
    if (currentTab) {
      closeTab(currentTab.id);
    }
  };
  
  // Handle successful save
  const handleSuccess = (savedProjectId?: string) => {
    queryClient.invalidateQueries({ queryKey: ["projects", companyId] });
    
    if (savedProjectId && isNew) {
      // Navigate to the project detail
      navigate(`/production/${savedProjectId}`);
    }
  };

  return (
    <AppLayout>
      <ProjectEditorContent
        projectId={projectId}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />
    </AppLayout>
  );
}
