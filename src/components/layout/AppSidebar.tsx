import { useState } from "react";
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
  HardHat
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
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
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

type UserRole = 'admin' | 'user' | 'magazine_editor' | 'production';

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
  roles?: UserRole[];
  excludeRoles?: ('production')[];
  subItems?: NavSubItem[];
}

const mainNavItems: NavItem[] = [
  { 
    title: "Dashboard", 
    url: "/", 
    icon: LayoutDashboard,
    excludeRoles: ['production']
  },
  { 
    title: "Palisades", 
    url: "https://palisades.ca-probuilders.com", 
    icon: ExternalLink,
    external: true,
    excludeRoles: ['production']
  },
  { 
    title: "Follow-up", 
    url: "/follow-up", 
    icon: ListChecks,
    excludeRoles: ['production']
  },
  { 
    title: "Magazine Sales", 
    url: "/magazine-sales", 
    icon: BookOpen,
    roles: ['admin', 'magazine_editor']
  },
  { 
    title: "Production", 
    icon: Briefcase,
    roles: ['admin', 'production'],
    subItems: [
      { title: "Projects", url: "/production?view=projects", icon: FolderKanban },
      { title: "Analytics", url: "/production?view=analytics", icon: BarChart3 },
      { title: "Subcontractors", url: "/production?view=subcontractors", icon: HardHat },
    ]
  },
  { 
    title: "Audit Log", 
    url: "/audit-log", 
    icon: FileText,
    roles: ['admin']
  },
];

// Reports sub-menus removed for now - can be added when routes are created

interface AdminMenuItem {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  action: string;
}

const adminMenuItems: AdminMenuItem[] = [
  { title: "Data Cleanup", icon: Settings, action: "cleanup" },
  { title: "Manage Sources", icon: Pencil, action: "sources" },
  { title: "User Management", icon: Users, action: "users" },
  { title: "Audit Log", icon: FileText, action: "audit" },
];

interface AppSidebarProps {
  onAdminAction?: (action: string) => void;
  onChangePassword?: () => void;
}

export function AppSidebar({ onAdminAction, onChangePassword }: AppSidebarProps) {
  const { state, setOpenMobile, setOpen, isMobile } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, isAdmin, isMagazineEditor, isProduction, signOut } = useAuth();
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
          case 'admin': return isAdmin;
          case 'magazine_editor': return isMagazineEditor;
          case 'production': return isProduction;
          case 'user': return true;
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

  const visibleNavItems = mainNavItems.filter(canViewItem);
  

  const renderNavItem = (item: NavItem) => {
    const isActive = !item.external && !item.subItems && location.pathname === item.url;
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
                        <NavLink 
                          to={subItem.url} 
                          end
                          className="flex items-center gap-2"
                          activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                        >
                          {subItem.icon && <subItem.icon className="h-3 w-3" />}
                          <span>{subItem.title}</span>
                        </NavLink>
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

    // Regular nav link
    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton 
          asChild 
          isActive={isActive}
          tooltip={item.title}
          onClick={closeSidebar}
        >
          <NavLink 
            to={item.url || "/"} 
            end 
            className="flex items-center gap-2"
            activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          >
            <item.icon className="h-4 w-4" />
            {!collapsed && <span>{item.title}</span>}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

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
              <span className="text-xs text-muted-foreground">Dashboard v2.5</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent onClickCapture={handleSidebarContentClickCapture}>
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleNavItems.map(renderNavItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>


        {/* Admin Tools */}
        {isAdmin && onAdminAction && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Admin Tools</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                {adminMenuItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        tooltip={item.title}
                        onClick={() => {
                          closeSidebar();
                          if (item.action === 'audit') {
                            navigate('/audit-log');
                          } else {
                            onAdminAction(item.action);
                          }
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
