import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
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
const ACTIVE_TAB_SESSION_KEY = "app-inner-tabs-active-session";

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
  
  // Use sessionStorage for activeTabId - this is per browser tab, preventing
  // cross-tab conflicts when multiple Chrome tabs have the app open
  const [activeTabId, setActiveTabId] = useState<string | null>(() => {
    try {
      // First try sessionStorage (per browser tab)
      const sessionSaved = sessionStorage.getItem(ACTIVE_TAB_SESSION_KEY);
      if (sessionSaved) return sessionSaved;
      
      // Fall back to localStorage for initial load (e.g., page refresh)
      const localSaved = localStorage.getItem(`${STORAGE_KEY}-active`);
      return localSaved || null;
    } catch {
      return null;
    }
  });

  // Persist tabs to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
  }, [tabs]);

  // Persist activeTabId to BOTH sessionStorage (for this browser tab) and 
  // localStorage (for page refreshes and initial entries calculation)
  useEffect(() => {
    if (activeTabId) {
      sessionStorage.setItem(ACTIVE_TAB_SESSION_KEY, activeTabId);
      localStorage.setItem(`${STORAGE_KEY}-active`, activeTabId);
    } else {
      sessionStorage.removeItem(ACTIVE_TAB_SESSION_KEY);
      localStorage.removeItem(`${STORAGE_KEY}-active`);
    }
  }, [activeTabId]);

  // Keep a ref to the current location to avoid stale closures
  const locationRef = useRef(location);
  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  // Restore location when browser tab regains focus.
  // Source of truth is the persisted tab state (localStorage) because many "nested"
  // in-tab navigation updates the tab path via updateActiveTabPath, not necessarily
  // via react-router location.search. Never downgrade a stored tab path based on
  // a less-specific current router location.
  // Use a ref to debounce and prevent multiple handlers from competing.
  const isProcessingVisibility = useRef(false);
  
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      
      // Debounce - prevent multiple handlers from running simultaneously
      if (isProcessingVisibility.current) {
        console.log('[TabRestore] Skipping duplicate visibility handler');
        return;
      }
      isProcessingVisibility.current = true;
      
      // Use setTimeout to ensure we run after React has settled
      setTimeout(() => {
        try {
          // Use sessionStorage first (per browser tab), fall back to localStorage
          const savedActiveId = sessionStorage.getItem(ACTIVE_TAB_SESSION_KEY) 
            || localStorage.getItem(`${STORAGE_KEY}-active`);
          const savedTabs = localStorage.getItem(STORAGE_KEY);
          
          // Use ref to get current location (avoids stale closure issues)
          const currentLocation = locationRef.current;
          const currentPath = currentLocation.pathname + currentLocation.search;
          
          console.log('[TabRestore] Visibility changed to visible');
          console.log('[TabRestore] savedActiveId:', savedActiveId);
          console.log('[TabRestore] currentPath from location:', currentPath);
          
          if (savedActiveId && savedTabs) {
            const parsedTabs = JSON.parse(savedTabs) as AppTab[];
            const activeTab = parsedTabs.find(t => t.id === savedActiveId);
            
            console.log('[TabRestore] activeTab found:', activeTab);
            
            if (activeTab) {
              // Ensure the in-memory state is aligned with persisted state.
              // (Helps after suspension/reload where React state might lag.)
              setTabs(parsedTabs);
              setActiveTabId(savedActiveId);

              if (activeTab.path !== currentPath) {
                console.log('[TabRestore] Restoring navigation to:', activeTab.path);
                navigate(activeTab.path);
              } else {
                console.log('[TabRestore] Already on active tab path, no navigation needed');
              }
            }
          }
        } finally {
          isProcessingVisibility.current = false;
        }
      }, 50); // Small delay to let React settle
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [navigate]); // Remove location from deps - we use ref instead

  // Update active tab when location changes.
  // If the router location changes within the currently active tab, keep the active
  // tab's stored path in sync *without* ever downgrading a more-specific stored path
  // (e.g., one that includes query params) to a less-specific one.
  useEffect(() => {
    const currentPath = location.pathname + location.search;
    const matchingTab = tabs.find(tab => tab.path === currentPath);
    if (matchingTab) {
      if (matchingTab.id !== activeTabId) setActiveTabId(matchingTab.id);
      return;
    }

    if (!activeTabId) return;
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab) return;

    const activeBase = activeTab.path.split('?')[0];
    const currentBase = location.pathname;
    if (activeBase !== currentBase) return;

    const activeHasSearch = activeTab.path.includes('?');
    const currentHasSearch = !!location.search;

    // Never overwrite a stored path that has query params with a path that doesn't.
    if (activeHasSearch && !currentHasSearch) return;

    if (activeTab.path !== currentPath) {
      setTabs(prev => prev.map(t => (t.id === activeTabId ? { ...t, path: currentPath } : t)));
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
