import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export interface AppTab {
  id: string;
  path: string;
  title: string;
  icon?: string;
  /** The ID of the tab that opened this tab (for return navigation) */
  parentTabId?: string;
}

interface AppTabsContextType {
  tabs: AppTab[];
  activeTabId: string | null;
  openTab: (path: string, title: string, icon?: string) => void;
  closeTab: (tabId: string) => void;
  closeAllTabs: () => void;
  switchToTab: (tabId: string) => void;
  handleNavigation: (e: React.MouseEvent, path: string, title: string, icon?: string) => void;
  reorderTabs: (draggedTabId: string, targetTabId: string) => void;
  /** Update the path of the active tab (for syncing inner state like sub-tabs) */
  updateActiveTabPath: (newPath: string) => void;
}

const AppTabsContext = createContext<AppTabsContextType | undefined>(undefined);

const STORAGE_KEY = "app-inner-tabs";

// Map routes to their display titles
const ROUTE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/opportunities": "Opportunities",
  "/appointments": "Appointments",
  "/contacts": "Contacts",
  "/estimates": "Estimates",
  "/production": "Production",
  "/calendar": "Calendar",
  "/documents": "Documents",
  "/magazine-sales": "Magazine Sales",
  "/follow-up": "Follow-Up",
  "/admin": "Settings",
  "/audit-log": "Audit Log",
  "/outstanding-ar": "Outstanding AR",
  "/outstanding-ap": "Outstanding AP",
};

function getRouteTitle(path: string): string {
  // Check for exact match first
  if (ROUTE_TITLES[path]) {
    return ROUTE_TITLES[path];
  }
  // Check for base path match (e.g., /production?view=projects still matches /production)
  const basePath = path.split("?")[0];
  if (ROUTE_TITLES[basePath]) {
    return ROUTE_TITLES[basePath];
  }
  return "Page";
}

function generateTabId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function AppTabsProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Load tabs from localStorage on mount
  const [tabs, setTabs] = useState<AppTab[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  
  // Active tab is derived from current URL - find a tab whose path matches
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  // Persist tabs to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
  }, [tabs]);

  // Sync activeTabId with current location
  // When the browser URL changes, find the matching tab
  useEffect(() => {
    const currentPath = location.pathname + location.search;
    const currentBasePath = location.pathname;
    
    // First try exact match
    let matchingTab = tabs.find(tab => tab.path === currentPath);
    
    // If no exact match, try base path match
    if (!matchingTab) {
      matchingTab = tabs.find(tab => tab.path.split("?")[0] === currentBasePath);
    }
    
    if (matchingTab) {
      setActiveTabId(matchingTab.id);
      // Update the tab's path if we navigated within the same base route
      // (e.g., switching sub-tabs within a project)
      if (matchingTab.path !== currentPath && matchingTab.path.split("?")[0] === currentBasePath) {
        setTabs(prev => prev.map(t => 
          t.id === matchingTab.id ? { ...t, path: currentPath } : t
        ));
      }
    } else {
      setActiveTabId(null);
    }
  }, [location, tabs]);

  const openTab = useCallback((path: string, title: string, icon?: string) => {
    const basePath = path.split("?")[0];
    
    // Capture the current active tab as the parent
    const parentId = activeTabId;
    
    // Check if tab already exists (by base path)
    const existingTab = tabs.find(tab => tab.path.split("?")[0] === basePath);
    if (existingTab) {
      // Update the path, parent, and navigate
      setTabs(prev => prev.map(t => 
        t.id === existingTab.id ? { ...t, path, parentTabId: parentId || t.parentTabId } : t
      ));
      setActiveTabId(existingTab.id);
      navigate(path);
      return;
    }

    const newTab: AppTab = {
      id: generateTabId(),
      path,
      title: title || getRouteTitle(path),
      icon,
      parentTabId: parentId || undefined,
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
    navigate(path);
  }, [tabs, activeTabId, navigate]);

  const closeTab = useCallback((tabId: string) => {
    const tabToClose = tabs.find(t => t.id === tabId);
    const tabIndex = tabs.findIndex(t => t.id === tabId);
    const newTabs = tabs.filter(t => t.id !== tabId);
    setTabs(newTabs);

    // If we're closing the active tab, switch to another
    if (activeTabId === tabId) {
      if (newTabs.length > 0) {
        // First, try to return to the parent tab if it still exists
        if (tabToClose?.parentTabId) {
          const parentTab = newTabs.find(t => t.id === tabToClose.parentTabId);
          if (parentTab) {
            setActiveTabId(parentTab.id);
            navigate(parentTab.path);
            return;
          }
        }
        
        // Fallback: switch to the tab to the left, or the first remaining tab
        const newActiveIndex = Math.max(0, tabIndex - 1);
        const newActiveTab = newTabs[newActiveIndex];
        setActiveTabId(newActiveTab.id);
        navigate(newActiveTab.path);
      } else {
        setActiveTabId(null);
        // Navigate home when all tabs are closed
        navigate('/');
      }
    }
  }, [tabs, activeTabId, navigate]);

  const closeAllTabs = useCallback(() => {
    setTabs([]);
    setActiveTabId(null);
    navigate('/');
  }, [navigate]);

  const reorderTabs = useCallback((draggedTabId: string, targetTabId: string) => {
    setTabs(prev => {
      const newTabs = [...prev];
      const draggedIndex = newTabs.findIndex(t => t.id === draggedTabId);
      const targetIndex = newTabs.findIndex(t => t.id === targetTabId);
      if (draggedIndex === -1 || targetIndex === -1) return prev;
      
      const [draggedTab] = newTabs.splice(draggedIndex, 1);
      newTabs.splice(targetIndex, 0, draggedTab);
      return newTabs;
    });
  }, []);

  const switchToTab = useCallback((tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      setActiveTabId(tabId);
      navigate(tab.path);
    }
  }, [tabs, navigate]);

  // Handle navigation with middle-click or Ctrl+click to open new tab
  const handleNavigation = useCallback((
    e: React.MouseEvent,
    path: string,
    title: string,
    icon?: string
  ) => {
    const isMiddleClick = e.button === 1;
    const isCtrlClick = e.ctrlKey || e.metaKey;

    if (isMiddleClick || isCtrlClick) {
      e.preventDefault();
      openTab(path, title || getRouteTitle(path), icon);
    }
    // Normal click - just navigate normally (handled by Link/NavLink)
  }, [openTab]);

  // Update the path of the active tab (for syncing inner state like sub-tabs)
  // This also updates the browser URL to keep everything in sync
  const updateActiveTabPath = useCallback((newPath: string) => {
    if (!activeTabId) return;
    
    setTabs(prev => prev.map(tab => 
      tab.id === activeTabId ? { ...tab, path: newPath } : tab
    ));
    
    // Update browser URL to match (using replace to avoid adding history entries)
    const currentPath = window.location.pathname + window.location.search;
    if (currentPath !== newPath) {
      navigate(newPath, { replace: true });
    }
  }, [activeTabId, navigate]);

  return (
    <AppTabsContext.Provider
      value={{
        tabs,
        activeTabId,
        openTab,
        closeTab,
        closeAllTabs,
        switchToTab,
        handleNavigation,
        reorderTabs,
        updateActiveTabPath,
      }}
    >
      {children}
    </AppTabsContext.Provider>
  );
}

export function useAppTabs() {
  const context = useContext(AppTabsContext);
  if (!context) {
    throw new Error("useAppTabs must be used within AppTabsProvider");
  }
  return context;
}
