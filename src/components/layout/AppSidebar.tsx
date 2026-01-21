import { useState } from "react";
import { useAppVersion } from "@/hooks/useAppVersion";
import { useSidebarFinancials } from "@/hooks/useSidebarFinancials";
import { VersionBumpDialog } from "@/components/layout/VersionBumpDialog";
import { CompanySwitcher } from "@/components/layout/CompanySwitcher";
import { useLocation, useNavigate } from "react-router-dom";
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
  Calendar
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
  dynamicSuffix?: 'ar' | 'ap';
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
        url: "/", 
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
        title: "Follow-up", 
        url: "/follow-up", 
        icon: ListChecks,
        roles: ['super_admin', 'admin', 'dispatch'],
        requiredFeature: 'ghl_integration'
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
        title: "Analytics", 
        url: "/production?view=analytics", 
        icon: BarChart3,
        roles: ['super_admin', 'admin'],
        requiredFeature: 'analytics'
      },
      { 
        title: "Outstanding AR", 
        dynamicSuffix: "ar",
        url: "/production?view=analytics&tab=cashflow&kpi=outstandingAR", 
        icon: FileText,
        roles: ['super_admin', 'admin', 'production'],
        requiredFeature: 'production'
      },
      { 
        title: "Outstanding AP", 
        dynamicSuffix: "ap",
        url: "/production?view=analytics&tab=cashflow&section=payables", 
        icon: Briefcase,
        roles: ['super_admin', 'admin', 'production'],
        requiredFeature: 'production'
      },
      { 
        title: "Subcontractors", 
        url: "/production?view=subcontractors", 
        icon: HardHat,
        roles: ['super_admin', 'admin', 'production'],
        requiredFeature: 'production'
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
        title: "E-Sign Misc Docs", 
        url: "/documents", 
        icon: FileText,
        roles: ['super_admin', 'admin', 'contract_manager'],
        requiredFeature: 'documents'
      },
    ],
  },
  {
    label: "Magazines",
    roles: ['super_admin', 'admin', 'magazine'],
    requiredFeature: 'magazine_sales',
    items: [
      { 
        title: "Magazine Sales", 
        url: "/magazine-sales", 
        icon: BookOpen,
        roles: ['super_admin', 'admin', 'magazine'],
        requiredFeature: 'magazine_sales'
      },
    ],
  },
  {
    label: "Super Admin",
    roles: ['super_admin'],
    items: [
      { 
        title: "Admin Portal", 
        url: "/super-admin", 
        icon: Building2,
        roles: ['super_admin']
      },
    ],
  },
];

// Reports sub-menus removed for now - can be added when routes are created

interface AdminMenuItem {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  action: string;
}

const adminMenuItems: AdminMenuItem[] = [
  { title: "Admin Settings", icon: Settings, action: "settings" },
];

interface AppSidebarProps {
  onAdminAction?: (action: string) => void;
  onChangePassword?: () => void;
}

export function AppSidebar({ onAdminAction, onChangePassword }: AppSidebarProps) {
  const { state, setOpenMobile, setOpen, isMobile } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { 
    user, profile, company, isAdmin, isSuperAdmin, isMagazine, isProduction, 
    isDispatch, isSales, isContractManager, signOut, simulatedRole, isSimulating, 
    setSimulatedRole, availableRoles, canUseFeature, isViewingOtherCompany 
  } = useAuth();
  const { versionString, version } = useAppVersion();
  const { totalUnpaidAR, apDueByFocusDay, formatCompactCurrency } = useSidebarFinancials();
  const collapsed = state === "collapsed";

  const closeSidebar = () => {
    // Close sidebar on both mobile and desktop
    setTimeout(() => {
      if (isMobile) {
        setOpenMobile(false);
      } else {
        setOpen(false);
      }
    }, 100);
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
                        onClick={closeSidebar}
                      >
                        <a 
                          href={subItem.url}
                          onClick={(e) => {
                            e.preventDefault();
                            navigate(subItem.url);
                          }}
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
      return null;
    };
    
    const dynamicAmount = getDynamicAmount();
    const displayTitle = dynamicAmount ? `${item.title} (${dynamicAmount})` : item.title;
    
    const renderTitleWithAmount = () => {
      if (!dynamicAmount) return <span>{item.title}</span>;
      // AR in dark green, AP in orange
      const colorClass = item.dynamicSuffix === 'ar' 
        ? "text-green-700 dark:text-green-500" 
        : "text-orange-500";
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
          onClick={closeSidebar}
        >
          {hasQueryParams ? (
            <a 
              href={item.url}
              onClick={(e) => {
                e.preventDefault();
                navigate(item.url || '/');
              }}
              className={`flex items-center gap-2 ${isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : ''}`}
            >
              <item.icon className="h-4 w-4" />
              {!collapsed && renderTitleWithAmount()}
            </a>
          ) : (
            <NavLink 
              to={item.url || "/"} 
              end 
              className="flex items-center gap-2"
              activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
            >
              <item.icon className="h-4 w-4" />
              {!collapsed && renderTitleWithAmount()}
            </NavLink>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  // Get visible sections
  const visibleSections = navSections.filter(canViewSection);

  // For super admins, show warning if no company selected
  const noCompanyContext = isSuperAdmin && !company;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div 
          className={`flex items-center gap-2 px-2 py-2 cursor-pointer hover:bg-sidebar-accent/50 rounded-md transition-colors ${isViewingOtherCompany ? 'bg-amber-500/5 border border-amber-500/30' : ''} ${noCompanyContext ? 'bg-destructive/5 border border-destructive/30' : ''}`}
          onClick={() => {
            if (collapsed) {
              setOpen(true);
            }
          }}
        >
          {company?.logo_url ? (
            <img 
              src={company.logo_url} 
              alt={company.name || "Company"} 
              className="h-8 w-8 rounded-lg object-contain shrink-0"
            />
          ) : (
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg font-bold text-sm shrink-0 ${noCompanyContext ? 'bg-destructive/20 text-destructive' : isViewingOtherCompany ? 'bg-amber-500 text-white' : 'bg-primary text-primary-foreground'}`}>
              {noCompanyContext ? "?" : (company?.name || "CO").substring(0, 2).toUpperCase()}
            </div>
          )}
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1">
                <span className={`text-sm font-semibold truncate ${noCompanyContext ? 'text-destructive' : ''}`}>
                  {noCompanyContext ? "Select a Company" : company?.name || "Company"}
                </span>
                {isViewingOtherCompany && (
                  <Badge variant="outline" className="h-4 px-1 text-[9px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                    Working
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
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
        
        {/* Company Switcher for Super Admins */}
        {isSuperAdmin && !collapsed && <CompanySwitcher />}
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
                              navigate('/');
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

                  {adminMenuItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        tooltip={item.title}
                        onClick={() => {
                          closeSidebar();
                          navigate('/admin/settings');
                        }}
                      >
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
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
    </Sidebar>
  );
}
