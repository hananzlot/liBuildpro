import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAppVersion } from "@/hooks/useAppVersion";
import { useSidebarFinancials } from "@/hooks/useSidebarFinancials";
import { useTodayAppointmentsCount } from "@/hooks/useTodayAppointmentsCount";
import { usePendingScopeSubmissionsCount } from "@/hooks/usePendingScopeSubmissionsCount";
import { useAIGenerationQueue } from "@/hooks/useAIGenerationQueue";
import { useAnalyticsPermissions, ANALYTICS_REPORTS } from "@/hooks/useAnalyticsPermissions";
import { VersionBumpDialog } from "@/components/layout/VersionBumpDialog";
import { AIQueueSheet } from "@/components/admin/AIQueueSheet";
import { CompanySwitcher } from "@/components/layout/CompanySwitcher";
import { useLocation } from "react-router-dom";
import { useAppTabs } from "@/contexts/AppTabsContext";
import { 
  LayoutDashboard, 
  Briefcase, 
  ListChecks, 
  BookOpen, 
  ExternalLink,
  LogOut,
  Key,
  User,
  Wrench,
  Settings,
  Pencil,
  Users,
  FileText,
  ChevronRight,
  BarChart3,
  FolderKanban,
  HardHat,
  Eye,
  EyeOff,
  Calculator,
  FileSignature,
  Send,
  Building2,
  Calendar,
  CalendarDays,
  ClipboardList,
  Contact,
  BrainCircuit,
  Landmark,
  Pin,
  PinOff,
  Mail,
  MessageSquare,
  Link,
  DollarSign,
  Sparkles,
  Link2,
  Shield,
  Award,
} from "lucide-react";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface NavSubItem {
  title: string;
  url: string;
  icon?: React.ComponentType<{ className?: string }>;
  requiredFeature?: string;
}

interface NavItem {
  title: string;
  url?: string;
  icon: React.ComponentType<{ className?: string }>;
  external?: boolean;
  roles?: AppRole[];
  excludeRoles?: AppRole[];
  subItems?: NavSubItem[];
  dynamicSuffix?: 'ar' | 'ap' | 'todayAppts' | 'pendingScopes' | 'pendingDeposits';
  requiredFeature?: string;
}

interface NavSection {
  label: string;
  roles: AppRole[];
  items: NavItem[];
  requiredFeature?: string;
}

const navSections: NavSection[] = [
  {
    label: "Dispatch",
    roles: ['super_admin', 'admin', 'dispatch'],
    requiredFeature: 'dashboard',
    items: [
      { 
        title: "Dashboard", 
        url: "/dashboard", 
        icon: LayoutDashboard,
        roles: ['super_admin', 'admin', 'dispatch'],
        requiredFeature: 'dashboard'
      },
      { 
        title: "Opportunities", 
        url: "/opportunities", 
        icon: Briefcase,
        roles: ['super_admin', 'admin', 'dispatch'],
        requiredFeature: 'ghl_integration'
      },
      { 
        title: "Appointments", 
        url: "/appointments", 
        icon: Calendar,
        roles: ['super_admin', 'admin', 'dispatch'],
        requiredFeature: 'ghl_integration'
      },
      { 
        title: "Calendar", 
        url: "/calendar", 
        icon: CalendarDays,
        roles: ['super_admin', 'admin', 'dispatch'],
        requiredFeature: 'ghl_integration',
        dynamicSuffix: 'todayAppts'
      },
      { 
        title: "Follow-up", 
        url: "/follow-up", 
        icon: ListChecks,
        roles: ['super_admin', 'admin', 'dispatch'],
        requiredFeature: 'ghl_integration'
      },
      { 
        title: "Salespeople", 
        url: "/production?view=salespeople", 
        icon: Users,
        roles: ['super_admin', 'admin', 'dispatch'],
        requiredFeature: 'dashboard'
      },
      { 
        title: "Contacts", 
        url: "/contacts", 
        icon: Contact,
        roles: ['super_admin', 'admin'],
        requiredFeature: 'ghl_integration'
      },
    ],
  },
  {
    label: "Estimates & Contracts",
    roles: ['super_admin', 'admin', 'contract_manager'],
    requiredFeature: 'estimates',
    items: [
      { 
        title: "Estimates", 
        url: "/estimates?view=list", 
        icon: Calculator,
        roles: ['super_admin', 'admin', 'contract_manager'],
        requiredFeature: 'estimates'
      },
      { 
        title: "Proposals", 
        url: "/estimates?view=proposals", 
        icon: Send,
        roles: ['super_admin', 'admin', 'contract_manager'],
        requiredFeature: 'estimates'
      },
      { 
        title: "Contracts", 
        url: "/estimates?view=contracts", 
        icon: FileSignature,
        roles: ['super_admin', 'admin', 'contract_manager'],
        requiredFeature: 'estimates'
      },
      { 
        title: "Scope Submissions", 
        url: "/production?view=scope-submissions", 
        icon: ClipboardList,
        roles: ['super_admin', 'admin', 'contract_manager'],
        requiredFeature: 'estimates',
        dynamicSuffix: 'pendingScopes'
      },
      { 
        title: "E-Sign Misc Docs", 
        url: "/documents", 
        icon: FileText,
        roles: ['super_admin', 'admin', 'contract_manager'],
        requiredFeature: 'documents'
      },
    ],
  },
  {
    label: "Production",
    roles: ['super_admin', 'admin', 'production'],
    requiredFeature: 'production',
    items: [
      { 
        title: "Projects", 
        url: "/production?view=projects", 
        icon: FolderKanban,
        roles: ['super_admin', 'admin', 'production'],
        requiredFeature: 'production'
      },
      { 
        title: "Pending Deposits", 
        url: "/pending-deposits", 
        icon: Landmark,
        roles: ['super_admin', 'admin', 'production'],
        requiredFeature: 'production',
        dynamicSuffix: 'pendingDeposits'
      },
      { 
        title: "Subcontractors", 
        url: "/production?view=subcontractors", 
        icon: HardHat,
        roles: ['super_admin', 'admin', 'production'],
        requiredFeature: 'production'
      },
      { 
        title: "Outstanding AR", 
        url: "/outstanding-ar", 
        icon: FileText,
        roles: ['super_admin', 'admin', 'production'],
        requiredFeature: 'production',
        dynamicSuffix: 'ar'
      },
      { 
        title: "Outstanding AP", 
        url: "/outstanding-ap", 
        icon: Briefcase,
        roles: ['super_admin', 'admin', 'production'],
        requiredFeature: 'production',
        dynamicSuffix: 'ap'
      },
      { 
        title: "Salespeople", 
        url: "/production?view=salespeople", 
        icon: Users,
        roles: ['super_admin', 'admin', 'dispatch'],
        requiredFeature: 'production'
      },
    ],
  },
  {
    label: "Analytics",
    roles: ['super_admin', 'admin', 'production', 'dispatch', 'contract_manager', 'magazine', 'sales'],
    requiredFeature: 'analytics',
    items: [
      { 
        title: "Analytics", 
        url: "/analytics", 
        icon: BarChart3,
        roles: ['super_admin', 'admin', 'production', 'dispatch', 'contract_manager', 'magazine', 'sales'],
        requiredFeature: 'analytics'
      },
    ],
  },
  {
    label: "Sales",
    roles: ['super_admin', 'admin', 'sales'],
    requiredFeature: 'sales_portal',
    items: [
      { 
        title: "Palisades", 
        url: "https://palisades.ca-probuilders.com", 
        icon: ExternalLink,
        external: true,
        roles: ['super_admin', 'admin', 'sales'],
        requiredFeature: 'sales_portal'
      },
    ],
  },
];

// Reports sub-menus removed for now - can be added when routes are created

interface AdminMenuItem {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  tab: string;
}

const ADMIN_SUB_ITEMS: { label: string; items: AdminMenuItem[] }[] = [
  {
    label: "Core Settings",
    items: [
      { title: "General", icon: Settings, tab: "settings" },
      { title: "Emails", icon: Mail, tab: "emails" },
      { title: "Compliance", icon: FileSignature, tab: "compliance" },
      { title: "Insurance", icon: Shield, tab: "insurance" },
      { title: "Licenses", icon: Award, tab: "licenses" },
      { title: "Chat", icon: MessageSquare, tab: "chat" },
    ],
  },
  {
    label: "Integrations",
    items: [
      { title: "GoHighLevel", icon: Link, tab: "integrations" },
      { title: "QuickBooks", icon: DollarSign, tab: "quickbooks" },
      { title: "APIs & AI", icon: Sparkles, tab: "custom" },
    ],
  },
  {
    label: "Sales & Operations",
    items: [
      { title: "Lead Sources", icon: Pencil, tab: "sources" },
      { title: "Short Links", icon: Link2, tab: "shortlinks" },
      { title: "Accounting", icon: DollarSign, tab: "payables" },
    ],
  },
  {
    label: "System",
    items: [
      { title: "Users", icon: Users, tab: "users" },
      { title: "Reports", icon: Eye, tab: "reports" },
      { title: "Data Cleanup", icon: Wrench, tab: "cleanup" },
      { title: "Audit Log", icon: FileText, tab: "audit" },
    ],
  },
];

interface AppSidebarProps {
  onAdminAction?: (action: string) => void;
  onChangePassword?: () => void;
}

const SIDEBAR_PINNED_KEY = "sidebar:pinned";

export function AppSidebar({ onAdminAction, onChangePassword }: AppSidebarProps) {
  const { state, setOpenMobile, setOpen, isMobile } = useSidebar();
  const location = useLocation();
  const { openTab } = useAppTabs();
  const { 
    user, profile, company, isAdmin, isSuperAdmin, isCorpAdmin, isMagazine, isProduction, 
    isDispatch, isSales, isContractManager, signOut, simulatedRole, isSimulating, 
    setSimulatedRole, availableRoles, canUseFeature, isViewingOtherCompany 
  } = useAuth();
  const { versionString, version } = useAppVersion();
  const { totalUnpaidAR, apDueByFocusDay, formatCompactCurrency } = useSidebarFinancials();
  const { data: todayAppointmentsCount = 0 } = useTodayAppointmentsCount();
  const { data: pendingScopesCount = 0 } = usePendingScopeSubmissionsCount();
  const { activeCount: aiQueueCount } = useAIGenerationQueue();
  const { data: pendingDepositsCount = 0 } = useQuery({
    queryKey: ["pending-deposits-count", company?.id],
    queryFn: async () => {
      if (!company?.id) return 0;
      const { count, error } = await supabase
        .from("project_payments")
        .select("id", { count: "exact", head: true })
        .eq("company_id", company.id)
        .eq("payment_status", "Received")
        .eq("is_voided", false)
        .or("deposit_verified.is.null,deposit_verified.eq.false");
      if (error) throw error;
      return count || 0;
    },
    enabled: !!company?.id,
  });
  const { visibleReports, hasAnyAnalyticsAccess } = useAnalyticsPermissions();
  const collapsed = state === "collapsed";

  // Pinned state - persisted in localStorage
  const [isPinned, setIsPinned] = useState(() => {
    const stored = localStorage.getItem(SIDEBAR_PINNED_KEY);
    return stored === "true";
  });

  // Persist pinned state
  useEffect(() => {
    localStorage.setItem(SIDEBAR_PINNED_KEY, isPinned ? "true" : "false");
  }, [isPinned]);

  // Toggle pinned state
  const togglePinned = () => {
    const newPinned = !isPinned;
    setIsPinned(newPinned);
    // If pinning, expand the sidebar; if unpinning, collapse it
    setOpen(newPinned);
  };

  // Handle navigation - always opens as a tab
  const handleNavClick = (e: React.MouseEvent, url: string, title: string) => {
    e.preventDefault();
    openTab(url, title);
    closeSidebar();
  };

  // State for AI Queue sheet
  const [aiQueueOpen, setAiQueueOpen] = useState(false);

  const closeSidebar = () => {
    // On mobile, always close
    if (isMobile) {
      setTimeout(() => {
        setOpenMobile(false);
      }, 100);
    } else if (!isPinned) {
      // On desktop, only collapse if not pinned
      setTimeout(() => {
        setOpen(false);
      }, 100);
    }
  };

  const handleSidebarContentClickCapture = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    // Only close when a real navigation link inside the sidebar is clicked
    const linkEl = target.closest("a");
    if (!linkEl) return;

    const insideMenu = linkEl.closest('[data-sidebar="menu-button"], [data-sidebar="menu-sub-button"]');
    if (!insideMenu) return;

    closeSidebar();
  };

  // Track which collapsible menus are open (for items with subItems)
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  
  // Track which sections are open (collapsed by default, auto-expand active section)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const handleLogout = async () => {
    await signOut();
    toast.success("Signed out successfully");
  };

  const toggleMenu = (title: string) => {
    setOpenMenus(prev => ({
      ...prev,
      [title]: !prev[title]
    }));
  };

  const toggleSection = (label: string) => {
    setOpenSections(prev => ({
      ...prev,
      [label]: !prev[label]
    }));
  };

  const canViewItem = (item: NavItem): boolean => {
    // Check feature access first (super admins bypass this)
    if (item.requiredFeature && !isSuperAdmin && !canUseFeature(item.requiredFeature)) {
      return false;
    }

    if (item.roles && item.roles.length > 0) {
      const hasRequiredRole = item.roles.some(role => {
        switch (role) {
          case 'super_admin': return isSuperAdmin;
          case 'admin': return isAdmin;
          case 'magazine': return isMagazine;
          case 'production': return isProduction;
          case 'dispatch': return isDispatch;
          case 'sales': return isSales;
          case 'contract_manager': return isContractManager;
          default: return false;
        }
      });
      if (!hasRequiredRole) return false;
    }

    if (item.excludeRoles && item.excludeRoles.length > 0) {
      const shouldExclude = item.excludeRoles.some(role => {
        if (role === 'production') {
          return isProduction && !isAdmin;
        }
        return false;
      });
      if (shouldExclude) return false;
    }

    return true;
  };

  const isSubItemActive = (item: NavItem): boolean => {
    if (!item.subItems) return false;
    return item.subItems.some(sub => {
      // Handle URLs with query params (e.g., /production?view=projects)
      if (sub.url.includes('?')) {
        const [path, queryString] = sub.url.split('?');
        if (location.pathname !== path) return false;
        const params = new URLSearchParams(queryString);
        const searchParams = new URLSearchParams(location.search);
        return Array.from(params.entries()).every(([key, value]) => searchParams.get(key) === value);
      }
      return location.pathname === sub.url;
    });
  };

  const isSubItemUrlActive = (subUrl: string): boolean => {
    if (subUrl.includes('?')) {
      const [path, queryString] = subUrl.split('?');
      if (location.pathname !== path) return false;
      const params = new URLSearchParams(queryString);
      const searchParams = new URLSearchParams(location.search);
      return Array.from(params.entries()).every(([key, value]) => searchParams.get(key) === value);
    }
    return location.pathname === subUrl;
  };

  const canViewSection = (section: NavSection): boolean => {
    // Check feature access first (super admins bypass this)
    if (section.requiredFeature && !isSuperAdmin && !canUseFeature(section.requiredFeature)) {
      return false;
    }

    return section.roles.some(role => {
      switch (role) {
        case 'super_admin': return isSuperAdmin;
        case 'admin': return isAdmin;
        case 'magazine': return isMagazine;
        case 'production': return isProduction;
        case 'dispatch': return isDispatch;
        case 'sales': return isSales;
        case 'contract_manager': return isContractManager;
        default: return false;
      }
    });
  };

  // Check if any item in a section is currently active
  const isSectionActive = (section: NavSection): boolean => {
    return section.items.some(item => {
      if (item.url && isUrlActive(item.url)) return true;
      if (item.subItems) return item.subItems.some(sub => isSubItemUrlActive(sub.url));
      return false;
    });
  };

  // Check if a specific URL (with query params) is currently active
  const isUrlActive = (url: string | undefined): boolean => {
    if (!url) return false;
    
    if (url.includes('?')) {
      const [path, queryString] = url.split('?');
      if (location.pathname !== path) return false;
      const params = new URLSearchParams(queryString);
      const searchParams = new URLSearchParams(location.search);
      return Array.from(params.entries()).every(([key, value]) => searchParams.get(key) === value);
    }
    return location.pathname === url;
  };

  const renderNavItem = (item: NavItem) => {
    // Check if the current item's URL is active (handles query params)
    const isActive = !item.external && !item.subItems && isUrlActive(item.url);
    const hasActiveSubItem = isSubItemActive(item);
    const isOpen = openMenus[item.title] || hasActiveSubItem;

    // Item with sub-items (collapsible)
    if (item.subItems && item.subItems.length > 0) {
      return (
        <Collapsible
          key={item.title}
          open={isOpen}
          onOpenChange={() => toggleMenu(item.title)}
          className="group/collapsible"
        >
          <SidebarMenuItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton 
                tooltip={item.title}
                isActive={hasActiveSubItem}
              >
                <item.icon className="h-4 w-4" />
                {!collapsed && (
                  <>
                    <span className="flex-1">{item.title}</span>
                    <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
                  </>
                )}
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                {item.subItems.map((subItem) => {
                  const isSubActive = isSubItemUrlActive(subItem.url);
                  return (
                    <SidebarMenuSubItem key={subItem.title}>
                      <SidebarMenuSubButton 
                        asChild 
                        isActive={isSubActive}
                      >
                        <a 
                          href={subItem.url}
                          onClick={(e) => handleNavClick(e, subItem.url, subItem.title)}
                          className={`flex items-center gap-2 ${isSubActive ? 'bg-sidebar-accent text-sidebar-accent-foreground' : ''}`}
                        >
                          {subItem.icon && <subItem.icon className="h-3 w-3" />}
                          <span>{subItem.title}</span>
                        </a>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  );
                })}
              </SidebarMenuSub>
            </CollapsibleContent>
          </SidebarMenuItem>
        </Collapsible>
      );
    }

    // External link
    if (item.external && item.url) {
      return (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton 
            asChild 
            tooltip={item.title}
          >
            <a 
              href={item.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2"
            >
              <item.icon className="h-4 w-4" />
              {!collapsed && <span>{item.title}</span>}
            </a>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    }

    // Regular nav link - use custom active check for URLs with query params
    const hasQueryParams = item.url?.includes('?');
    
    // Build display title with dynamic suffix for AR/AP
    const getDynamicAmount = () => {
      if (item.dynamicSuffix === 'ar' && totalUnpaidAR > 0) {
        return formatCompactCurrency(totalUnpaidAR);
      }
      if (item.dynamicSuffix === 'ap' && apDueByFocusDay > 0) {
        return formatCompactCurrency(apDueByFocusDay);
      }
      if (item.dynamicSuffix === 'todayAppts') {
        return todayAppointmentsCount.toString();
      }
      if (item.dynamicSuffix === 'pendingScopes' && pendingScopesCount > 0) {
        return pendingScopesCount.toString();
      }
      if (item.dynamicSuffix === 'pendingDeposits' && pendingDepositsCount > 0) {
        return pendingDepositsCount.toString();
      }
      return null;
    };
    
    const dynamicAmount = getDynamicAmount();
    const displayTitle = dynamicAmount ? `${item.title} (${dynamicAmount})` : item.title;
    
    const renderTitleWithAmount = () => {
      if (!dynamicAmount) return <span>{item.title}</span>;
      // Pending deposits: red round badge
      if (item.dynamicSuffix === 'pendingDeposits') {
        return (
          <span className="flex items-center gap-2">
            <span>{item.title}</span>
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-none">
              {dynamicAmount}
            </span>
          </span>
        );
      }
      // AR in dark green, AP in orange, Today's appointments in blue, Pending scopes in amber
      const colorClass = item.dynamicSuffix === 'ar' 
        ? "text-green-700 dark:text-green-500" 
        : item.dynamicSuffix === 'ap'
        ? "text-orange-500"
        : item.dynamicSuffix === 'pendingScopes'
        ? "text-amber-500"
        : "text-primary";
      return (
        <span>
          {item.title} <span className={colorClass}>({dynamicAmount})</span>
        </span>
      );
    };
    
    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton 
          asChild 
          isActive={isActive}
          tooltip={displayTitle}
        >
          <a 
            href={item.url}
            onClick={(e) => handleNavClick(e, item.url || '/', item.title)}
            className={`flex items-center gap-2 ${isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : ''}`}
          >
            <item.icon className="h-4 w-4" />
            {!collapsed && renderTitleWithAmount()}
          </a>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  // Build dynamic analytics section with sub-items based on user permissions
  const dynamicSections = useMemo(() => {
    return navSections.map(section => {
      if (section.label !== "Analytics") return section;
      
      // If user has no analytics access at all, return section as-is (canViewSection will hide it)
      if (!hasAnyAnalyticsAccess) return section;
      
      // Build sub-items from visible reports (only analytics tabs, not outstanding AP/AR)
      const analyticsTabReports = ANALYTICS_REPORTS.filter(r => !r.key.startsWith('outstanding_'));
      const visibleAnalyticsTabs = analyticsTabReports.filter(r => visibleReports.includes(r.key));
      
      // Also check outstanding AP/AR visibility  
      const hasOutstandingAP = visibleReports.includes('outstanding_ap');
      const hasOutstandingAR = visibleReports.includes('outstanding_ar');
      
      const items: NavItem[] = [];
      
      // Add each visible analytics report as a direct nav item (no nested submenu)
      for (const report of visibleAnalyticsTabs) {
        items.push({
          title: report.label,
          url: report.route,
          icon: BarChart3,
          roles: ['super_admin', 'admin', 'production', 'dispatch', 'contract_manager', 'magazine', 'sales'],
          requiredFeature: 'analytics',
        });
      }
      
      // Outstanding AR/AP moved to Production section
      
      return { ...section, items };
    });
  }, [visibleReports, hasAnyAnalyticsAccess]);

  // Get visible sections
  const visibleSections = dynamicSections.filter(section => {
    // For analytics section, also check if user has any analytics access
    if (section.label === "Analytics" && !hasAnyAnalyticsAccess) return false;
    return canViewSection(section);
  });

  // For super admins, show warning if no company selected
  const noCompanyContext = isSuperAdmin && !company;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        {/* Pin Toggle - only visible when expanded on desktop */}
        {!isMobile && !collapsed && (
          <div className="flex justify-end -mb-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={togglePinned}
                  className="p-1 rounded-md hover:bg-sidebar-accent text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={isPinned ? "Unpin sidebar" : "Pin sidebar open"}
                >
                  {isPinned ? (
                    <Pin className="h-3.5 w-3.5" />
                  ) : (
                    <PinOff className="h-3.5 w-3.5" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {isPinned ? "Unpin sidebar (auto-collapse)" : "Pin sidebar open"}
              </TooltipContent>
            </Tooltip>
          </div>
        )}
        <div 
          className={`flex flex-col gap-2 px-2 py-2 cursor-pointer hover:bg-sidebar-accent/50 rounded-md transition-colors ${isViewingOtherCompany ? 'bg-amber-500/5 border border-amber-500/30' : ''} ${noCompanyContext ? 'bg-destructive/5 border border-destructive/30' : ''}`}
          onClick={() => {
            if (collapsed) {
              setOpen(true);
            }
          }}
        >
          {/* Logo - full width */}
          {company?.logo_url ? (
            <img 
              src={company.logo_url} 
              alt={company.name || "Company"} 
              className={collapsed ? "h-8 w-8 rounded-lg object-contain mx-auto" : "h-12 w-full rounded-lg object-contain"}
            />
          ) : (
            <div className={`flex items-center justify-center rounded-lg font-bold text-sm ${collapsed ? 'h-8 w-8 mx-auto' : 'h-12 w-full'} ${noCompanyContext ? 'bg-destructive/20 text-destructive' : isViewingOtherCompany ? 'bg-amber-500 text-white' : 'bg-primary text-primary-foreground'}`}>
              {noCompanyContext ? "?" : (company?.name || "CO").substring(0, 2).toUpperCase()}
            </div>
          )}
          {/* Company name - below logo */}
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1 justify-center">
                <span className={`text-sm font-semibold truncate text-center ${noCompanyContext ? 'text-destructive' : ''}`}>
                  {noCompanyContext ? "Select a Company" : company?.name || "Company"}
                </span>
                {isViewingOtherCompany && (
                  <Badge variant="outline" className="h-4 px-1 text-[9px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                    Working
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1 justify-center">
                {noCompanyContext ? (
                  <span className="text-xs text-muted-foreground">Use switcher below</span>
                ) : (
                  <>
                    <span className="text-xs text-muted-foreground">{versionString}</span>
                    {isAdmin && (
                      <VersionBumpDialog currentVersion={version} />
                    )}
                    {isSimulating && (
                      <Badge variant="outline" className="h-4 px-1 text-[9px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                        Simulating
                      </Badge>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* Company Switcher for Super Admins and Corp Admins */}
        {(isSuperAdmin || isCorpAdmin) && !collapsed && <CompanySwitcher />}
      </SidebarHeader>

      <SidebarContent onClickCapture={handleSidebarContentClickCapture}>
        {/* Navigation Sections - Collapsible, auto-expand active section */}
        {visibleSections.map((section) => {
          const visibleItems = section.items.filter(canViewItem);
          if (visibleItems.length === 0) return null;
          
          const sectionHasActiveItem = isSectionActive(section);
          const isSectionOpen = openSections[section.label] ?? sectionHasActiveItem;
          
          return (
            <Collapsible
              key={section.label}
              open={isSectionOpen}
              onOpenChange={() => toggleSection(section.label)}
              className="group/collapsible"
            >
              <SidebarGroup>
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className="cursor-pointer hover:bg-sidebar-accent/50 rounded-md transition-colors flex items-center justify-between pr-2">
                    <span>{section.label}</span>
                    <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${isSectionOpen ? 'rotate-90' : ''}`} />
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {visibleItems.map(renderNavItem)}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}


        {/* Admin Tools - always show for actual admins (even when simulating) */}
        {(isAdmin || isSimulating) && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Admin Tools</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {/* Super Admin Portal - first item for super admins */}
                  {isSuperAdmin && (
                    <SidebarMenuItem>
                      <SidebarMenuButton 
                        tooltip="Super Admin Portal"
                        isActive={location.pathname.startsWith('/super-admin')}
                        onClick={() => {
                          closeSidebar();
                          openTab('/super-admin', 'Super Admin');
                        }}
                      >
                        <Building2 className="h-4 w-4" />
                        {!collapsed && <span>Super Admin Portal</span>}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}

                  {/* Role Simulation Toggle */}
                  <SidebarMenuItem>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <SidebarMenuButton tooltip="Simulate Role">
                          {isSimulating ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          {!collapsed && (
                            <span className="flex items-center gap-2">
                              Simulate Role
                              {isSimulating && (
                                <Badge variant="outline" className="h-4 px-1.5 text-[9px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                                  {simulatedRole}
                                </Badge>
                              )}
                            </span>
                          )}
                        </SidebarMenuButton>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="right" align="start" className="w-48">
                        <DropdownMenuLabel>View as Role</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuRadioGroup 
                          value={simulatedRole || ''} 
                          onValueChange={(value) => {
                            if (value === '') {
                              setSimulatedRole(null);
                              // Reset welcome screen so admin sees it again
                              sessionStorage.removeItem('crm-welcome-dismissed');
                              toast.info("Role simulation disabled");
                              // Navigate to dashboard
                              openTab('/', 'Dashboard');
                            } else {
                              setSimulatedRole(value as AppRole);
                              toast.info(`Now viewing as: ${value}`);
                            }
                          }}
                        >
                          <DropdownMenuRadioItem value="">
                            <span className="flex items-center gap-2">
                              My Actual Role
                              {!simulatedRole && <Badge variant="outline" className="h-4 px-1 text-[9px]">Active</Badge>}
                            </span>
                          </DropdownMenuRadioItem>
                          <DropdownMenuSeparator />
                          {availableRoles.map((role) => (
                            <DropdownMenuRadioItem key={role} value={role}>
                              {role.charAt(0).toUpperCase() + role.slice(1).replace('_', ' ')}
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </SidebarMenuItem>

                  {/* AI Queue Management */}
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      tooltip={`AI Queue${aiQueueCount > 0 ? ` (${aiQueueCount})` : ''}`}
                      onClick={() => setAiQueueOpen(true)}
                    >
                      <BrainCircuit className="h-4 w-4" />
                      {!collapsed && (
                        <span className="flex items-center gap-2">
                          AI Queue
                          {aiQueueCount > 0 && (
                            <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-xs">
                              {aiQueueCount}
                            </Badge>
                          )}
                        </span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  {/* Admin Settings with sub-menus */}
                  <Collapsible
                    open={openMenus['Admin Settings'] || location.pathname === '/admin/settings'}
                    onOpenChange={() => toggleMenu('Admin Settings')}
                    className="group/collapsible"
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton 
                          tooltip="Admin Settings"
                          isActive={location.pathname === '/admin/settings'}
                        >
                          <Settings className="h-4 w-4" />
                          {!collapsed && (
                            <>
                              <span className="flex-1">Admin Settings</span>
                              <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${openMenus['Admin Settings'] || location.pathname === '/admin/settings' ? 'rotate-90' : ''}`} />
                            </>
                          )}
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {ADMIN_SUB_ITEMS.map((group) => (
                            <React.Fragment key={group.label}>
                              <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-1 first:mt-0">
                                {group.label}
                              </div>
                              {group.items.map((item) => {
                                const searchParams = new URLSearchParams(location.search);
                                const currentTab = searchParams.get('tab') || 'settings';
                                const isSubActive = location.pathname === '/admin/settings' && currentTab === item.tab;
                                return (
                                  <SidebarMenuSubItem key={item.tab}>
                                    <SidebarMenuSubButton 
                                      asChild 
                                      isActive={isSubActive}
                                    >
                                      <a 
                                        href={`/admin/settings?tab=${item.tab}`}
                                        onClick={(e) => {
                                          e.preventDefault();
                                          openTab(`/admin/settings?tab=${item.tab}`, item.title);
                                          closeSidebar();
                                        }}
                                        className={`flex items-center gap-2 ${isSubActive ? 'bg-sidebar-accent text-sidebar-accent-foreground' : ''}`}
                                      >
                                        <item.icon className="h-3 w-3" />
                                        <span>{item.title}</span>
                                      </a>
                                    </SidebarMenuSubButton>
                                  </SidebarMenuSubItem>
                                );
                              })}
                            </React.Fragment>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton tooltip={profile?.full_name || user?.email || "User"}>
                  <User className="h-4 w-4" />
                  {!collapsed && (
                    <span className="truncate">
                      {profile?.full_name || user?.email}
                    </span>
                  )}
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56">
                <div className="px-2 py-1.5 text-sm">
                  <p className="font-medium">{profile?.full_name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                {onChangePassword && (
                  <DropdownMenuItem onClick={onChangePassword}>
                    <Key className="h-4 w-4 mr-2" />
                    Change Password
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      {/* AI Queue Sheet */}
      <AIQueueSheet open={aiQueueOpen} onOpenChange={setAiQueueOpen} />
    </Sidebar>
  );
}
