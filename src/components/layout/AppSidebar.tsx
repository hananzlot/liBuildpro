import React, { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
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

import { useLocation, useNavigate } from "react-router-dom";
import { QuickCreateProjectSelector, type QuickCreateAction } from "./QuickCreateProjectSelector";
import { useAppTabs } from "@/contexts/AppTabsContext";
import { 
  LayoutDashboard, Briefcase, ListChecks, ExternalLink, LogOut, Key, User,
  Wrench, Settings, Pencil, Users, FileText, ChevronRight, ChevronDown, BarChart3,
  FolderKanban, HardHat, Eye, Calculator, FileSignature, Send,
  Building2, Calendar, CalendarDays, ClipboardList, Contact, BrainCircuit,
  Landmark, Pin, PinOff, Mail, MessageSquare, Link, DollarSign, Sparkles,
  Link2, Shield, Award, Plus, ChevronsUpDown, Activity, Receipt, CreditCard,
} from "lucide-react";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem,
  SidebarSeparator, useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

/* ─── Types ─── */
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
  /** Display label shown as muted heading */
  label: string;
  roles: AppRole[];
  items: NavItem[];
  requiredFeature?: string;
}

/* ─── Navigation structure (destinations unchanged, re-labelled groups) ─── */
const navSections: NavSection[] = [
  {
    label: "Pipeline and Dispatch",
    roles: ['super_admin', 'admin', 'dispatch'],
    requiredFeature: 'dashboard',
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, roles: ['super_admin', 'admin', 'dispatch'], requiredFeature: 'dashboard' },
      { title: "Opportunities", url: "/opportunities", icon: Briefcase, roles: ['super_admin', 'admin', 'dispatch'], requiredFeature: 'ghl_integration' },
      { title: "Appointments", url: "/appointments", icon: Calendar, roles: ['super_admin', 'admin', 'dispatch'], requiredFeature: 'ghl_integration' },
      { title: "Calendar", url: "/calendar", icon: CalendarDays, roles: ['super_admin', 'admin', 'dispatch'], requiredFeature: 'ghl_integration', dynamicSuffix: 'todayAppts' },
      { title: "Follow-up", url: "/follow-up", icon: ListChecks, roles: ['super_admin', 'admin', 'dispatch'], requiredFeature: 'ghl_integration' },
      { title: "Salespeople", url: "/production?view=salespeople", icon: Users, roles: ['super_admin', 'admin', 'dispatch'], requiredFeature: 'dashboard' },
      { title: "Contacts", url: "/contacts", icon: Contact, roles: ['super_admin', 'admin'], requiredFeature: 'ghl_integration' },
    ],
  },
  {
    label: "Propose & Sign",
    roles: ['super_admin', 'admin', 'contract_manager'],
    requiredFeature: 'estimates',
    items: [
      { title: "Estimates", url: "/estimates?view=list", icon: Calculator, roles: ['super_admin', 'admin', 'contract_manager'], requiredFeature: 'estimates' },
      { title: "Proposals", url: "/estimates?view=proposals", icon: Send, roles: ['super_admin', 'admin', 'contract_manager'], requiredFeature: 'estimates' },
      { title: "Contracts", url: "/estimates?view=contracts", icon: FileSignature, roles: ['super_admin', 'admin', 'contract_manager'], requiredFeature: 'estimates' },
      { title: "Scope Submissions", url: "/production?view=scope-submissions", icon: ClipboardList, roles: ['super_admin', 'admin', 'contract_manager'], requiredFeature: 'estimates', dynamicSuffix: 'pendingScopes' },
      { title: "E-Sign Misc Docs", url: "/documents", icon: FileText, roles: ['super_admin', 'admin', 'contract_manager'], requiredFeature: 'documents' },
    ],
  },
  {
    label: "Operations",
    roles: ['super_admin', 'admin', 'production'],
    requiredFeature: 'production',
    items: [
      { title: "Projects", url: "/production?view=projects", icon: FolderKanban, roles: ['super_admin', 'admin', 'production'], requiredFeature: 'production' },
      { title: "Pending Deposits", url: "/pending-deposits", icon: Landmark, roles: ['super_admin', 'admin', 'production'], requiredFeature: 'production', dynamicSuffix: 'pendingDeposits' },
      { title: "Vendors & Subs", url: "/production?view=subcontractors", icon: HardHat, roles: ['super_admin', 'admin', 'production'], requiredFeature: 'production' },
      { title: "Outstanding AR", url: "/outstanding-ar", icon: FileText, roles: ['super_admin', 'admin', 'production'], requiredFeature: 'production', dynamicSuffix: 'ar' },
      { title: "Outstanding AP", url: "/outstanding-ap?tab=scheduled", icon: Briefcase, roles: ['super_admin', 'admin', 'production'], requiredFeature: 'production', dynamicSuffix: 'ap' },
    ],
  },
  {
    label: "Insights",
    roles: ['super_admin', 'admin', 'production', 'dispatch', 'contract_manager', 'magazine', 'sales'],
    requiredFeature: 'analytics',
    items: [
      { title: "Analytics", url: "/analytics", icon: BarChart3, roles: ['super_admin', 'admin', 'production', 'dispatch', 'contract_manager', 'magazine', 'sales'], requiredFeature: 'analytics' },
    ],
  },
  {
    label: "Sales",
    roles: ['super_admin', 'admin', 'sales'],
    requiredFeature: 'sales_portal',
    items: [
      { title: "Palisades", url: "https://palisades.ca-probuilders.com", icon: ExternalLink, external: true, roles: ['super_admin', 'admin', 'sales'], requiredFeature: 'sales_portal' },
    ],
  },
];

/* ─── Admin sub-items (unchanged) ─── */
interface AdminMenuItem { title: string; icon: React.ComponentType<{ className?: string }>; tab: string; }
const ADMIN_SUB_ITEMS: { label: string; items: AdminMenuItem[] }[] = [
  { label: "Core Settings", items: [
    { title: "General", icon: Settings, tab: "settings" },
    { title: "Compliance", icon: FileSignature, tab: "compliance" }, { title: "Chat", icon: MessageSquare, tab: "chat" },
  ]},
  { label: "Sales & Operations", items: [
    { title: "Lead Sources", icon: Pencil, tab: "sources" }, { title: "Short Links", icon: Link2, tab: "shortlinks" },
    { title: "Accounting", icon: DollarSign, tab: "payables" },
  ]},
  { label: "Integrations", items: [
    { title: "GoHighLevel", icon: Link, tab: "integrations" }, { title: "QuickBooks", icon: DollarSign, tab: "quickbooks" },
    { title: "APIs & AI", icon: Sparkles, tab: "custom" },
  ]},
  { label: "System", items: [
    { title: "Reports", icon: Eye, tab: "reports" },
    { title: "Data Cleanup", icon: Wrench, tab: "cleanup" }, { title: "Audit Log", icon: FileText, tab: "audit" },
    { title: "Edge Logs", icon: Activity, tab: "edge-logs" },
  ]},
];

/* ─── Constants ─── */
interface AppSidebarProps { onAdminAction?: (action: string) => void; onChangePassword?: () => void; }
const SIDEBAR_PINNED_KEY = "sidebar:pinned";

/* ═══════════════════════════════════════════════
   AppSidebar — Card-first CRM premium sidebar
   ═══════════════════════════════════════════════ */
export function AppSidebar({ onAdminAction, onChangePassword }: AppSidebarProps) {
  const { state, setOpenMobile, setOpen, isMobile } = useSidebar();
  const location = useLocation();
  const { openTab } = useAppTabs();
  const { 
    user, profile, company, isAdmin, isSuperAdmin, isCorpAdmin, isMagazine, isProduction, 
    isDispatch, isSales, isContractManager, signOut, simulatedRole, isSimulating, 
    setSimulatedRole, availableRoles, canUseFeature, isViewingOtherCompany,
    hasMultipleCompanies
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

  /* Pinned / collapsed persistence */
  const [isPinned, setIsPinned] = useState(() => {
    const stored = localStorage.getItem(SIDEBAR_PINNED_KEY);
    return stored === "true";
  });
  useEffect(() => { localStorage.setItem(SIDEBAR_PINNED_KEY, isPinned ? "true" : "false"); }, [isPinned]);
  const togglePinned = () => { const v = !isPinned; setIsPinned(v); setOpen(v); };

  const handleNavClick = (e: React.MouseEvent, url: string, title: string) => { e.preventDefault(); openTab(url, title); closeSidebar(); };
  const [aiQueueOpen, setAiQueueOpen] = useState(false);
  const closeSidebar = () => {
    if (isMobile) { setTimeout(() => setOpenMobile(false), 100); }
    else if (!isPinned) { setTimeout(() => setOpen(false), 100); }
  };

  const handleSidebarContentClickCapture = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const linkEl = target.closest("a");
    if (!linkEl) return;
    if (linkEl.closest('[data-sidebar="menu-button"], [data-sidebar="menu-sub-button"]')) closeSidebar();
  };


  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();
  const handleLogout = async () => { await signOut(); toast.success("Signed out successfully"); };
  const toggleMenu = (title: string) => { setOpenMenus(prev => ({ ...prev, [title]: !prev[title] })); };

  // Quick Create project selector state
  const [quickCreateProjectSelectorOpen, setQuickCreateProjectSelectorOpen] = useState(false);
  const [quickCreateAction, setQuickCreateAction] = useState<QuickCreateAction | null>(null);
  const handleQuickCreateFinance = (action: QuickCreateAction) => {
    setQuickCreateAction(action);
    setQuickCreateProjectSelectorOpen(true);
    closeSidebar();
  };
  const handleProjectSelectedForQuickCreate = (projectId: string, action: QuickCreateAction) => {
    openTab(`/production/${projectId}?autoOpen=${action.replace('new-', '')}`, 'Project');
    navigate(`/production/${projectId}?autoOpen=${action.replace('new-', '')}`);
  };

  // Collapsible sidebar sections (default collapsed, persisted to localStorage)
  const SECTIONS_STORAGE_KEY = 'sidebar-open-sections';
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem(SECTIONS_STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });
  const toggleSection = (label: string) => {
    setOpenSections(prev => {
      const next = { ...prev, [label]: !prev[label] };
      localStorage.setItem(SECTIONS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };
  const isSectionOpen = (label: string) => !!openSections[label]; // default collapsed

  /* ─── Visibility helpers (unchanged logic) ─── */
  const canViewItem = (item: NavItem): boolean => {
    if (item.requiredFeature && !isSuperAdmin && !canUseFeature(item.requiredFeature)) return false;
    if (item.roles?.length) {
      const has = item.roles.some(r => {
        switch (r) {
          case 'super_admin': return isSuperAdmin; case 'admin': return isAdmin;
          case 'magazine': return isMagazine; case 'production': return isProduction;
          case 'dispatch': return isDispatch; case 'sales': return isSales;
          case 'contract_manager': return isContractManager; default: return false;
        }
      });
      if (!has) return false;
    }
    if (item.excludeRoles?.length) {
      if (item.excludeRoles.some(r => r === 'production' ? isProduction && !isAdmin : false)) return false;
    }
    return true;
  };

  const isUrlActive = (url: string | undefined): boolean => {
    if (!url) return false;
    if (url.includes('?')) {
      const [path, qs] = url.split('?');
      if (location.pathname !== path) return false;
      const p = new URLSearchParams(qs), s = new URLSearchParams(location.search);
      return Array.from(p.entries()).every(([k, v]) => s.get(k) === v);
    }
    return location.pathname === url;
  };

  const isSubItemUrlActive = (subUrl: string) => isUrlActive(subUrl);
  const isSubItemActive = (item: NavItem) => item.subItems?.some(s => isSubItemUrlActive(s.url)) ?? false;

  const canViewSection = (section: NavSection): boolean => {
    if (section.requiredFeature && !isSuperAdmin && !canUseFeature(section.requiredFeature)) return false;
    return section.roles.some(r => {
      switch (r) {
        case 'super_admin': return isSuperAdmin; case 'admin': return isAdmin;
        case 'magazine': return isMagazine; case 'production': return isProduction;
        case 'dispatch': return isDispatch; case 'sales': return isSales;
        case 'contract_manager': return isContractManager; default: return false;
      }
    });
  };

  /* ─── Shared item styling constants ─── */
  const ITEM_CLS = "h-9 px-3 gap-2.5 rounded-md text-[13px] leading-none transition-colors";
  const ICON_CLS = "h-[18px] w-[18px] shrink-0";
  const ACTIVE_CLS = "bg-sidebar-surface-active text-sidebar-accent-foreground font-medium";
  const DEFAULT_CLS = "text-sidebar-muted-foreground hover:bg-sidebar-surface-hover hover:text-sidebar-foreground";

  /* ─── Render a single nav item ─── */
  const renderNavItem = (item: NavItem) => {
    const isActive = !item.external && !item.subItems && isUrlActive(item.url);
    const hasActiveSubItem = isSubItemActive(item);
    const isOpen = openMenus[item.title] || hasActiveSubItem;

    // Collapsible sub-items
    if (item.subItems?.length) {
      return (
        <Collapsible key={item.title} open={isOpen} onOpenChange={() => toggleMenu(item.title)} className="group/collapsible">
          <SidebarMenuItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton tooltip={item.title} isActive={hasActiveSubItem} className={cn(ITEM_CLS, hasActiveSubItem ? ACTIVE_CLS : DEFAULT_CLS)}>
                <item.icon className={ICON_CLS} />
                {!collapsed && (
                  <>
                    <span className="flex-1 truncate">{item.title}</span>
                    <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 transition-transform duration-200", isOpen && "rotate-90")} />
                  </>
                )}
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                {item.subItems.map(sub => {
                  const isSubActive = isSubItemUrlActive(sub.url);
                  return (
                    <SidebarMenuSubItem key={sub.title}>
                      <SidebarMenuSubButton asChild isActive={isSubActive}>
                        <a href={sub.url} onClick={(e) => handleNavClick(e, sub.url, sub.title)}
                          className={cn("flex items-center gap-2 rounded-md transition-colors", isSubActive
                            ? "bg-sidebar-surface-active text-sidebar-accent-foreground border-l-2 border-sidebar-primary pl-[calc(0.5rem-2px)] font-medium"
                            : "text-sidebar-muted-foreground hover:bg-sidebar-surface-hover hover:text-sidebar-foreground"
                          )}>
                          {sub.icon && <sub.icon className="h-3.5 w-3.5" />}
                          <span>{sub.title}</span>
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
          <SidebarMenuButton asChild tooltip={item.title} className={cn(ITEM_CLS, DEFAULT_CLS)}>
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
              <item.icon className={ICON_CLS} />{!collapsed && <span className="truncate">{item.title}</span>}
            </a>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    }

    // Regular nav link with optional count badge
    const getDynamicAmount = () => {
      if (item.dynamicSuffix === 'ar' && totalUnpaidAR > 0) return formatCompactCurrency(totalUnpaidAR);
      if (item.dynamicSuffix === 'ap' && apDueByFocusDay > 0) return formatCompactCurrency(apDueByFocusDay);
      if (item.dynamicSuffix === 'todayAppts') return todayAppointmentsCount.toString();
      if (item.dynamicSuffix === 'pendingScopes' && pendingScopesCount > 0) return pendingScopesCount.toString();
      if (item.dynamicSuffix === 'pendingDeposits' && pendingDepositsCount > 0) return pendingDepositsCount.toString();
      return null;
    };
    const dynamicAmount = getDynamicAmount();
    const displayTitle = dynamicAmount ? `${item.title} (${dynamicAmount})` : item.title;

    const renderBadge = () => {
      if (!dynamicAmount) return null;
      if (item.dynamicSuffix === 'pendingDeposits') {
        return <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-none">{dynamicAmount}</span>;
      }
      const color = item.dynamicSuffix === 'ar' ? "text-green-400" : item.dynamicSuffix === 'ap' ? "text-blue-400" : item.dynamicSuffix === 'pendingScopes' ? "text-blue-300" : "text-sidebar-primary";
      return <span className={cn("ml-auto text-[11px] tabular-nums", color)}>{dynamicAmount}</span>;
    };

    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton asChild isActive={isActive} tooltip={displayTitle}
          className={cn(ITEM_CLS, "relative", isActive ? ACTIVE_CLS : DEFAULT_CLS)}>
          <a href={item.url} onClick={(e) => handleNavClick(e, item.url || '/', item.title)} className="flex items-center gap-2.5">
            {/* Left accent bar for active item */}
            {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-sidebar-primary" />}
            <item.icon className={ICON_CLS} />
            {!collapsed && (
              <>
                <span className="flex-1 truncate">{item.title}</span>
                {renderBadge()}
              </>
            )}
          </a>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  /* ─── Dynamic analytics section ─── */
  const dynamicSections = useMemo(() => {
    return navSections.map(section => {
      if (section.label !== "Insights") return section;
      if (!hasAnyAnalyticsAccess) return section;
      const tabs = ANALYTICS_REPORTS.filter(r => !r.key.startsWith('outstanding_'));
      const visible = tabs.filter(r => visibleReports.includes(r.key));
      const items: NavItem[] = visible.map(report => ({
        title: report.label, url: report.route, icon: BarChart3,
        roles: ['super_admin', 'admin', 'production', 'dispatch', 'contract_manager', 'magazine', 'sales'] as AppRole[],
        requiredFeature: 'analytics',
      }));
      return { ...section, items };
    });
  }, [visibleReports, hasAnyAnalyticsAccess]);

  const visibleSections = dynamicSections.filter(section => {
    if (section.label === "Insights" && !hasAnyAnalyticsAccess) return false;
    return canViewSection(section);
  });

  const noCompanyContext = isSuperAdmin && !company;

  /* ─── Quick Create menu items ─── */
  const quickCreateItems = (
    <>
      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openTab('/dashboard?action=new-opportunity', 'Dashboard'); closeSidebar(); }}>
        <Briefcase className="h-4 w-4 mr-2" />New Opportunity
      </DropdownMenuItem>
      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openTab('/dashboard?action=new-contact', 'Dashboard'); closeSidebar(); }}>
        <Contact className="h-4 w-4 mr-2" />New Contact
      </DropdownMenuItem>
      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openTab('/dashboard?action=new-appointment', 'Dashboard'); closeSidebar(); }}>
        <Calendar className="h-4 w-4 mr-2" />New Appointment
      </DropdownMenuItem>
      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openTab('/estimate/new', 'New Estimate'); closeSidebar(); }}>
        <FileText className="h-4 w-4 mr-2" />New Estimate
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleQuickCreateFinance('new-invoice'); }}>
        <Receipt className="h-4 w-4 mr-2" />New Invoice
      </DropdownMenuItem>
      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleQuickCreateFinance('new-payment'); }}>
        <DollarSign className="h-4 w-4 mr-2" />New A/R Collection
      </DropdownMenuItem>
      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleQuickCreateFinance('new-bill'); }}>
        <CreditCard className="h-4 w-4 mr-2" />New Bill
      </DropdownMenuItem>
    </>
  );

  /* ═══════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════ */
  return (
    <Sidebar collapsible="icon">
      {/* ─── Workspace Header ─── */}
      <SidebarHeader className="border-b border-sidebar-border p-0">
        <div
          className={cn(
            "flex items-center gap-2.5 px-3 py-2.5 transition-colors",
            collapsed ? "justify-center" : "",
            isViewingOtherCompany && "bg-blue-500/10",
            noCompanyContext && "bg-destructive/10",
          )}
          onClick={() => { if (collapsed) setOpen(true); }}
        >
          {/* Logo */}
          {company?.logo_url ? (
            <img src={company.logo_url} alt={company.name || "Company"} className="h-7 w-7 rounded-md object-contain shrink-0" />
          ) : (
            <div className={cn(
              "h-7 w-7 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0",
              noCompanyContext ? "bg-destructive/20 text-destructive"
                : isViewingOtherCompany ? "bg-blue-500 text-white"
                : "bg-sidebar-primary text-sidebar-primary-foreground"
            )}>
              {noCompanyContext ? "?" : (company?.name || "CO").substring(0, 2).toUpperCase()}
            </div>
          )}

          {!collapsed && (
            <>
              {/* Name + version */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={cn("text-[13px] font-semibold truncate text-sidebar-foreground", noCompanyContext && "text-destructive")}>
                    {noCompanyContext ? "Select Company" : company?.name || "Company"}
                  </span>
                  {isViewingOtherCompany && (
                    <span className="inline-flex items-center h-4 px-1.5 rounded text-[9px] font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                      Working
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-sidebar-muted-foreground">{versionString}</span>
                  {isAdmin && <VersionBumpDialog currentVersion={version} />}
                  {isSimulating && <span className="inline-flex items-center h-4 px-1 rounded text-[9px] font-medium bg-blue-500/20 text-blue-400">Sim</span>}
                </div>
              </div>

              {/* Pin toggle */}
              {!isMobile && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button onClick={(e) => { e.stopPropagation(); togglePinned(); }}
                      className="h-6 w-6 rounded-md flex items-center justify-center text-sidebar-muted-foreground hover:bg-sidebar-surface-active hover:text-sidebar-foreground transition-colors shrink-0"
                      aria-label={isPinned ? "Unpin sidebar" : "Pin sidebar open"}>
                      {isPinned ? <Pin className="h-3.5 w-3.5" /> : <PinOff className="h-3.5 w-3.5" />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">{isPinned ? "Unpin sidebar" : "Pin sidebar open"}</TooltipContent>
                </Tooltip>
              )}
            </>
          )}

        </div>

        {/* Company Switcher */}
        {(isSuperAdmin || isCorpAdmin || hasMultipleCompanies) && !collapsed && <CompanySwitcher />}

        {/* Quick Create button — below company switcher */}
        {!collapsed ? (
          <div className="px-3 pb-2.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 w-full h-8 px-3 rounded-md text-[13px] font-medium bg-sidebar-primary/90 text-sidebar-primary-foreground hover:bg-sidebar-primary transition-colors">
                  <Plus className="h-3.5 w-3.5" />
                  Quick Create
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start" className="w-56">
                {quickCreateItems}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <div className="flex justify-center pb-2">
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button className="h-7 w-7 rounded-md flex items-center justify-center bg-sidebar-primary/90 text-sidebar-primary-foreground hover:bg-sidebar-primary transition-colors">
                      <Plus className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="right">Quick Create</TooltipContent>
              </Tooltip>
              <DropdownMenuContent side="right" align="start" className="w-56">
                {quickCreateItems}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </SidebarHeader>

      {/* ─── Main navigation ─── */}
      <SidebarContent onClickCapture={handleSidebarContentClickCapture} className="py-1">
        {visibleSections.map((section) => {
          const items = section.items.filter(canViewItem);
          if (!items.length) return null;
          const sectionOpen = isSectionOpen(section.label);
          return (
            <Collapsible key={section.label} open={collapsed || sectionOpen} onOpenChange={() => toggleSection(section.label)}>
              <SidebarGroup className="px-2 py-0.5">
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className={cn("h-7 px-3 text-[10px] uppercase tracking-widest font-semibold text-sidebar-muted-foreground select-none", !collapsed && "cursor-pointer hover:text-sidebar-foreground transition-colors")}>
                    {section.label}
                    {!collapsed && <ChevronDown className={cn("ml-auto h-3 w-3 shrink-0 transition-transform duration-200", !sectionOpen && "-rotate-90")} />}
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu className="gap-0.5">
                      {items.map(renderNavItem)}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}

        {/* Admin Tools */}
        {(isAdmin || isSimulating) && (
          <Collapsible open={collapsed || isSectionOpen('Admin')} onOpenChange={() => toggleSection('Admin')}>
            <SidebarGroup className="px-2 py-0.5">
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel className={cn("h-7 px-3 text-[10px] uppercase tracking-widest font-semibold text-sidebar-muted-foreground select-none", !collapsed && "cursor-pointer hover:text-sidebar-foreground transition-colors")}>
                  Admin
                  {!collapsed && <ChevronDown className={cn("ml-auto h-3 w-3 shrink-0 transition-transform duration-200", !isSectionOpen('Admin') && "-rotate-90")} />}
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu className="gap-0.5">
                    {/* Super Admin Portal */}
                    {isSuperAdmin && (
                      <SidebarMenuItem>
                        <SidebarMenuButton tooltip="Super Admin Portal" isActive={location.pathname.startsWith('/super-admin')}
                          className={cn(ITEM_CLS, "relative", location.pathname.startsWith('/super-admin') ? ACTIVE_CLS : DEFAULT_CLS)}
                          onClick={() => { closeSidebar(); openTab('/super-admin', 'Super Admin'); }}>
                          {location.pathname.startsWith('/super-admin') && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-sidebar-primary" />}
                          <Building2 className={ICON_CLS} />{!collapsed && <span>Super Admin</span>}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )}


                    {/* AI Queue */}
                    <SidebarMenuItem>
                      <SidebarMenuButton tooltip={`AI Queue${aiQueueCount > 0 ? ` (${aiQueueCount})` : ''}`}
                        onClick={() => setAiQueueOpen(true)} className={cn(ITEM_CLS, DEFAULT_CLS)}>
                        <BrainCircuit className={ICON_CLS} />
                        {!collapsed && (
                          <>
                            <span className="flex-1 truncate">AI Queue</span>
                            {aiQueueCount > 0 && <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-sidebar-primary text-sidebar-primary-foreground text-[10px] font-bold leading-none">{aiQueueCount}</span>}
                          </>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>

                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        )}
      </SidebarContent>

      {/* ─── Bottom dock (user/profile) ─── */}
      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton tooltip={profile?.full_name || user?.email || "User"}
                  className={cn(ITEM_CLS, "h-10", DEFAULT_CLS)}>
                  <div className="h-7 w-7 rounded-full bg-sidebar-surface-active flex items-center justify-center text-[11px] font-semibold text-sidebar-foreground shrink-0">
                    {(profile?.full_name || user?.email || "U").substring(0, 1).toUpperCase()}
                  </div>
                  {!collapsed && (
                    <>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-[13px] font-medium truncate text-sidebar-foreground">{profile?.full_name || "User"}</span>
                        <span className="text-[11px] truncate text-sidebar-muted-foreground">{user?.email}</span>
                      </div>
                      <ChevronsUpDown className="h-3.5 w-3.5 text-sidebar-muted-foreground shrink-0" />
                    </>
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
                    <Key className="h-4 w-4 mr-2" />Change Password
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" />Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <AIQueueSheet open={aiQueueOpen} onOpenChange={setAiQueueOpen} />
      <QuickCreateProjectSelector
        open={quickCreateProjectSelectorOpen}
        onOpenChange={setQuickCreateProjectSelectorOpen}
        action={quickCreateAction}
        onProjectSelected={handleProjectSelectedForQuickCreate}
      />
    </Sidebar>
  );
}
