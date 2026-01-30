import { useLocation, useNavigate } from "react-router-dom";
import { 
  Building2, 
  Settings, 
  Users, 
  CreditCard, 
  Mail, 
  ArrowLeft,
  LayoutDashboard,
  FileText,
  Shield,
  Archive
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
}

const platformItems: NavItem[] = [
  { 
    title: "Dashboard", 
    url: "/super-admin", 
    icon: LayoutDashboard,
    description: "Platform overview"
  },
  { 
    title: "Tenant Management", 
    url: "/super-admin/tenants", 
    icon: Building2,
    description: "Manage companies"
  },
  { 
    title: "Platform Admins", 
    url: "/super-admin/admins", 
    icon: Users,
    description: "Super admin users"
  },
];

const settingsItems: NavItem[] = [
  { 
    title: "App Defaults", 
    url: "/super-admin/app-settings", 
    icon: Settings,
    description: "Default settings for new companies"
  },
  { 
    title: "Subscription Plans", 
    url: "/super-admin/plans", 
    icon: CreditCard,
    description: "Manage pricing plans"
  },
  { 
    title: "Email Templates", 
    url: "/super-admin/email-settings", 
    icon: Mail,
    description: "Platform email configuration"
  },
  { 
    title: "Backup & Restore", 
    url: "/super-admin/backups", 
    icon: Archive,
    description: "Database and storage backups"
  },
];

export function SuperAdminSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const collapsed = state === "collapsed";

  const isActive = (url: string) => {
    if (url === "/super-admin") {
      return location.pathname === "/super-admin";
    }
    return location.pathname.startsWith(url);
  };

  const renderNavItem = (item: NavItem) => (
    <SidebarMenuItem key={item.title}>
      <SidebarMenuButton 
        asChild 
        tooltip={item.title}
        isActive={isActive(item.url)}
      >
        <a 
          href={item.url}
          onClick={(e) => {
            e.preventDefault();
            navigate(item.url);
          }}
          className="flex items-center gap-2"
        >
          <item.icon className="h-4 w-4" />
          {!collapsed && (
            <div className="flex flex-col">
              <span>{item.title}</span>
            </div>
          )}
        </a>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Shield className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div>
              <h2 className="font-semibold text-lg">Super Admin</h2>
              <p className="text-xs text-muted-foreground">Platform Management</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {platformItems.map(renderNavItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsItems.map(renderNavItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <SidebarSeparator className="mb-4" />
        <div className="space-y-3">
          {!collapsed && (
            <div className="flex items-center gap-2 px-2">
              <Badge variant="outline" className="text-xs">
                Super Admin
              </Badge>
              <span className="text-xs text-muted-foreground truncate">
                {profile?.email}
              </span>
            </div>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {!collapsed && "Back to App"}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
