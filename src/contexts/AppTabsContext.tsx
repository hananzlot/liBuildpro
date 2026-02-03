import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export interface AppTab {
  id: string;
  path: string;
  title: string;
  icon?: string;
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
    // Add query param context if available
    const params = new URLSearchParams(path.split("?")[1] || "");
    const view = params.get("view");
    const tab = params.get("tab");
    
    let title = ROUTE_TITLES[basePath];
    if (view) {
      title += ` (${view.charAt(0).toUpperCase() + view.slice(1)})`;
    } else if (tab) {
      title += ` (${tab.charAt(0).toUpperCase() + tab.slice(1)})`;
    }
    return title;
  }
  return "Page";
}

function generateTabId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function AppTabsProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [tabs, setTabs] = useState<AppTab[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  
  const [activeTabId, setActiveTabId] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}-active`);
      return saved || null;
    } catch {
      return null;
    }
  });

  // Persist tabs to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
  }, [tabs]);

  useEffect(() => {
    if (activeTabId) {
      localStorage.setItem(`${STORAGE_KEY}-active`, activeTabId);
    } else {
      localStorage.removeItem(`${STORAGE_KEY}-active`);
    }
  }, [activeTabId]);

  // Restore location when browser tab regains focus
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const savedActiveId = localStorage.getItem(`${STORAGE_KEY}-active`);
        const savedTabs = localStorage.getItem(STORAGE_KEY);
        if (savedActiveId && savedTabs) {
          const parsedTabs = JSON.parse(savedTabs) as AppTab[];
          const activeTab = parsedTabs.find(t => t.id === savedActiveId);
          if (activeTab) {
            const currentPath = location.pathname + location.search;
            if (activeTab.path !== currentPath) {
              navigate(activeTab.path);
            }
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [navigate, location]);

  // Update active tab when location changes
  useEffect(() => {
    const currentPath = location.pathname + location.search;
    const matchingTab = tabs.find(tab => tab.path === currentPath);
    if (matchingTab && matchingTab.id !== activeTabId) {
      setActiveTabId(matchingTab.id);
    }
  }, [location, tabs, activeTabId]);

  const openTab = useCallback((path: string, title: string, icon?: string) => {
    // Check if tab already exists
    const existingTab = tabs.find(tab => tab.path === path);
    if (existingTab) {
      setActiveTabId(existingTab.id);
      navigate(path);
      return;
    }

    const newTab: AppTab = {
      id: generateTabId(),
      path,
      title: title || getRouteTitle(path),
      icon,
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
    navigate(path);
  }, [tabs, navigate]);

  const closeTab = useCallback((tabId: string) => {
    const tabIndex = tabs.findIndex(t => t.id === tabId);
    const newTabs = tabs.filter(t => t.id !== tabId);
    setTabs(newTabs);

    // If we're closing the active tab, switch to another
    if (activeTabId === tabId) {
      if (newTabs.length > 0) {
        // Try to switch to the tab to the left, or the first remaining tab
        const newActiveIndex = Math.max(0, tabIndex - 1);
        const newActiveTab = newTabs[newActiveIndex];
        setActiveTabId(newActiveTab.id);
        navigate(newActiveTab.path);
      } else {
        setActiveTabId(null);
        // Stay on current page when all tabs are closed
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
  const updateActiveTabPath = useCallback((newPath: string) => {
    if (!activeTabId) return;
    setTabs(prev => prev.map(tab => 
      tab.id === activeTabId ? { ...tab, path: newPath } : tab
    ));
  }, [activeTabId]);

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
