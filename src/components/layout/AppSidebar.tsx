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
  FileText
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
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  external?: boolean;
  roles?: ('admin' | 'user' | 'magazine_editor' | 'production')[];
  excludeRoles?: ('production')[];
}

const mainNavItems: NavItem[] = [
  { 
    title: "Dashboard", 
    url: "/", 
    icon: LayoutDashboard,
    excludeRoles: ['production'] // Hide from production-only users
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
    url: "/production", 
    icon: Briefcase,
    roles: ['admin', 'production']
  },
  { 
    title: "Audit Log", 
    url: "/audit-log", 
    icon: FileText,
    roles: ['admin', 'production']
  },
];

interface AdminMenuItem {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  action: string;
}

const adminMenuItems: AdminMenuItem[] = [
  { title: "Data Cleanup", icon: Settings, action: "cleanup" },
  { title: "Manage Sources", icon: Pencil, action: "sources" },
  { title: "User Management", icon: Users, action: "users" },
];

interface AppSidebarProps {
  onAdminAction?: (action: string) => void;
  onChangePassword?: () => void;
}

export function AppSidebar({ onAdminAction, onChangePassword }: AppSidebarProps) {
  const { state } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, isAdmin, isMagazineEditor, isProduction, signOut } = useAuth();
  const collapsed = state === "collapsed";

  const handleLogout = async () => {
    await signOut();
    toast.success("Signed out successfully");
  };

  const canViewItem = (item: NavItem): boolean => {
    // Check if user has a required role
    if (item.roles && item.roles.length > 0) {
      const hasRequiredRole = item.roles.some(role => {
        switch (role) {
          case 'admin': return isAdmin;
          case 'magazine_editor': return isMagazineEditor;
          case 'production': return isProduction;
          case 'user': return true; // All authenticated users
          default: return false;
        }
      });
      if (!hasRequiredRole) return false;
    }

    // Check if user should be excluded (e.g., production-only users)
    if (item.excludeRoles && item.excludeRoles.length > 0) {
      // Only exclude if user ONLY has the excluded role (not combined with admin)
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

  const handleItemClick = (item: NavItem, e: React.MouseEvent) => {
    if (item.external) {
      e.preventDefault();
      window.open(item.url, "_blank");
    }
  };

  const visibleNavItems = mainNavItems.filter(canViewItem);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            CA
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold">CA Pro Builders</span>
              <span className="text-xs text-muted-foreground">Dashboard v2.5</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleNavItems.map((item) => {
                const isActive = !item.external && location.pathname === item.url;
                
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={isActive}
                      tooltip={item.title}
                    >
                      {item.external ? (
                        <a 
                          href={item.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-2"
                        >
                          <item.icon className="h-4 w-4" />
                          {!collapsed && <span>{item.title}</span>}
                        </a>
                      ) : (
                        <NavLink 
                          to={item.url} 
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
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

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
                        onClick={() => onAdminAction(item.action)}
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
