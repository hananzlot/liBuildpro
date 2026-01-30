import React, { createContext, useContext, useState, useCallback } from 'react';
import { PortalChatDialog } from '@/components/production/PortalChatDialog';

interface PortalChatContextValue {
  openChatDialog: (projectId: string) => void;
  closeChatDialog: () => void;
  isDialogOpen: boolean;
  currentProjectId: string | null;
}

const PortalChatContext = createContext<PortalChatContextValue | undefined>(undefined);

export function PortalChatProvider({ children }: { children: React.ReactNode }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);

  const openChatDialog = useCallback((projectId: string) => {
    setCurrentProjectId(projectId);
    setIsDialogOpen(true);
  }, []);

  const closeChatDialog = useCallback(() => {
    setIsDialogOpen(false);
    setCurrentProjectId(null);
  }, []);

  return (
    <PortalChatContext.Provider
      value={{
        openChatDialog,
        closeChatDialog,
        isDialogOpen,
        currentProjectId,
      }}
    >
      {children}
      <PortalChatDialog
        projectId={currentProjectId}
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeChatDialog();
        }}
      />
    </PortalChatContext.Provider>
  );
}

export function usePortalChat() {
  const context = useContext(PortalChatContext);
  if (!context) {
    // Return a no-op version when used outside provider (e.g., during initial render)
    return {
      openChatDialog: () => {},
      closeChatDialog: () => {},
      isDialogOpen: false,
      currentProjectId: null,
    };
  }
  return context;
}
