import { useState } from "react";
import { useAppVersion } from "@/hooks/useAppVersion";
import { VersionBumpDialog } from "@/components/layout/VersionBumpDialog";
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
  Send
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
}

interface NavItem {
  title: string;
  url?: string;
  icon: React.ComponentType<{ className?: string }>;
  external?: boolean;
  roles?: AppRole[];
  excludeRoles?: AppRole[];
  subItems?: NavSubItem[];
}

interface NavSection {
  label: string;
  roles: AppRole[];
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    label: "Dispatch",
    roles: ['super_admin', 'admin', 'dispatch'],
    items: [
      { 
        title: "Dashboard", 
        url: "/", 
        icon: LayoutDashboard,
        roles: ['super_admin', 'admin', 'dispatch']
      },
      { 
        title: "Follow-up", 
        url: "/follow-up", 
        icon: ListChecks,
        roles: ['super_admin', 'admin', 'dispatch']
      },
    ],
  },
  {
    label: "Production",
    roles: ['super_admin', 'admin', 'production'],
    items: [
      { 
        title: "Projects", 
        url: "/production?view=projects", 
        icon: FolderKanban,
        roles: ['super_admin', 'admin', 'production']
      },
      { 
        title: "Analytics", 
        url: "/production?view=analytics", 
        icon: BarChart3,
        roles: ['super_admin', 'admin', 'production']
      },
      { 
        title: "Subcontractors", 
        url: "/production?view=subcontractors", 
        icon: HardHat,
        roles: ['super_admin', 'admin', 'production']
      },
    ],
  },
  {
    label: "Sales",
    roles: ['super_admin', 'admin', 'sales'],
    items: [
      { 
        title: "Palisades", 
        url: "https://palisades.ca-probuilders.com", 
        icon: ExternalLink,
        external: true,
        roles: ['super_admin', 'admin', 'sales']
      },
    ],
  },
  {
    label: "Estimates & Contracts",
    roles: ['super_admin', 'admin', 'contract_manager'],
    items: [
      { 
        title: "Estimates", 
        url: "/estimates?view=list", 
        icon: Calculator,
        roles: ['super_admin', 'admin', 'contract_manager']
      },
      { 
        title: "Proposals", 
        url: "/estimates?view=proposals", 
        icon: Send,
        roles: ['super_admin', 'admin', 'contract_manager']
      },
      { 
        title: "Contracts", 
        url: "/estimates?view=contracts", 
        icon: FileSignature,
        roles: ['super_admin', 'admin', 'contract_manager']
      },
      { 
        title: "Documents", 
        url: "/documents", 
        icon: FileText,
        roles: ['super_admin', 'admin', 'contract_manager']
      },
    ],
  },
  {
    label: "Magazines",
    roles: ['super_admin', 'admin', 'magazine'],
    items: [
      { 
        title: "Magazine Sales", 
        url: "/magazine-sales", 
        icon: BookOpen,
        roles: ['super_admin', 'admin', 'magazine']
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
  const { user, profile, isAdmin, isMagazine, isProduction, isDispatch, isSales, isContractManager, signOut, simulatedRole, isSimulating, setSimulatedRole, availableRoles } = useAuth();
  const { versionString, version } = useAppVersion();
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

  // Track which collapsible menus are open
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});

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

  const canViewItem = (item: NavItem): boolean => {
    if (item.roles && item.roles.length > 0) {
      const hasRequiredRole = item.roles.some(role => {
        switch (role) {
          case 'super_admin': return isAdmin;
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

  // Check if a section is visible based on user roles
  const canViewSection = (section: NavSection): boolean => {
    return section.roles.some(role => {
      switch (role) {
        case 'super_admin': return isAdmin;
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
    
    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton 
          asChild 
          isActive={isActive}
          tooltip={item.title}
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
              {!collapsed && <span>{item.title}</span>}
            </a>
          ) : (
            <NavLink 
              to={item.url || "/"} 
              end 
              className="flex items-center gap-2"
              activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
            >
              <item.icon className="h-4 w-4" />
              {!collapsed && <span>{item.title}</span>}
            </NavLink>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  // Get visible sections
  const visibleSections = navSections.filter(canViewSection);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm shrink-0">
            CA
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold truncate">CA Pro Builders</span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">{versionString}</span>
                {isAdmin && (
                  <VersionBumpDialog currentVersion={version} />
                )}
                {isSimulating && (
                  <Badge variant="outline" className="h-4 px-1 text-[9px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                    Simulating
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent onClickCapture={handleSidebarContentClickCapture}>
        {/* Navigation Sections */}
        {visibleSections.map((section, idx) => {
          const visibleItems = section.items.filter(canViewItem);
          if (visibleItems.length === 0) return null;
          
          return (
            <SidebarGroup key={section.label}>
              <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleItems.map(renderNavItem)}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
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
                              toast.info("Role simulation disabled");
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
