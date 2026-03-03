import { Link } from "react-router-dom";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { GlobalAdminSearch } from "./GlobalAdminSearch";
import ibuildproLogo from "@/assets/ibuildpro-logo.png";
import { NotificationBell } from "@/components/dashboard/NotificationBell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HelpCircle, ExternalLink, Settings, Mail, FileSignature, Shield, Award, MessageSquare, Link as LinkIcon, DollarSign, Sparkles, Pencil, Link2, Users, Eye, EyeOff, Wrench, FileText, Activity } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { useAppTabs } from "@/contexts/AppTabsContext";
import { UserSimulationPicker } from "./UserSimulationPicker";
import { toast } from "sonner";
import type { AppRole } from "@/contexts/AuthContext";

const ADMIN_QUICK_MENU = [
  { label: "Core Settings", items: [
    { title: "General", icon: Settings, tab: "settings" },
    { title: "Compliance", icon: FileSignature, tab: "compliance" },
    { title: "Chat", icon: MessageSquare, tab: "chat" },
  ]},
  { label: "Sales & Operations", items: [
    { title: "Lead Sources", icon: Pencil, tab: "sources" },
    { title: "Short Links", icon: Link2, tab: "shortlinks" },
    { title: "Accounting", icon: DollarSign, tab: "payables" },
  ]},
  { label: "Integrations", items: [
    { title: "GoHighLevel", icon: LinkIcon, tab: "integrations" },
    { title: "QuickBooks", icon: DollarSign, tab: "quickbooks" },
    { title: "APIs & AI", icon: Sparkles, tab: "custom" },
  ]},
  { label: "System", items: [
    
    { title: "Reports", icon: Eye, tab: "reports" },
    { title: "Data Cleanup", icon: Wrench, tab: "cleanup" },
    { title: "Audit Log", icon: FileText, tab: "audit" },
    { title: "Edge Logs", icon: Activity, tab: "edge-logs" },
  ]},
];

interface TopBarProps {
  showNotifications?: boolean;
  headerContent?: React.ReactNode;
}

export function TopBar({ showNotifications = true, headerContent }: TopBarProps) {
  const { isAdmin, isSuperAdmin, isSimulating, simulatedRole, simulatedUserId, simulatedUserName, setSimulatedRole, simulateAsUser, clearSimulation, availableRoles } = useAuth();
  const { openTab } = useAppTabs();

  const showAdminSettings = isAdmin || isSuperAdmin;

  return (
    <header className="h-12 shadow-xs bg-card backdrop-blur-sm sticky top-0 z-30 flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <SidebarTrigger />
        <img src={ibuildproLogo} alt="iBuildPro" className="h-7 w-auto shrink-0" />
        <GlobalAdminSearch />
        {headerContent}
      </div>
      <div className="flex items-center gap-2">
        {/* Quick Web Search */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                const width = 1024;
                const height = 768;
                const left = window.screenX + (window.outerWidth - width) / 2;
                const top = window.screenY + (window.outerHeight - height) / 2;
                window.open(
                  "https://www.google.com",
                  "WebSearch",
                  `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
                );
              }}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open Web Search</TooltipContent>
        </Tooltip>

        {/* Simulate - Super Admin only */}
        {isSuperAdmin && (
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className={`h-8 w-8 ${isSimulating ? 'text-blue-500' : ''}`}>
                    {isSimulating ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>
                {isSimulating 
                  ? `Simulating: ${simulatedUserId ? (simulatedUserName || 'User') : simulatedRole}`
                  : 'Simulate'
                }
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>View as Role</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value={simulatedUserId ? '' : (simulatedRole || '')} onValueChange={(v) => {
                if (v === '') { clearSimulation(); toast.info("Simulation disabled"); openTab('/', 'Dashboard'); }
                else { setSimulatedRole(v as AppRole); toast.info(`Now viewing as: ${v}`); }
              }}>
                <DropdownMenuRadioItem value="">
                  <span className="flex items-center gap-2">My Actual Role {!isSimulating && <Badge variant="outline" className="h-4 px-1 text-[9px]">Active</Badge>}</span>
                </DropdownMenuRadioItem>
                <DropdownMenuSeparator />
                {availableRoles.map(r => <DropdownMenuRadioItem key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1).replace(/_/g, ' ')}</DropdownMenuRadioItem>)}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>View as User</DropdownMenuLabel>
              <UserSimulationPicker
                onSelectUser={simulateAsUser}
                trigger={
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="cursor-pointer">
                    <Users className="h-4 w-4 mr-2" />
                    {simulatedUserId ? (
                      <span className="flex items-center gap-2">
                        {simulatedUserName}
                        <Badge variant="outline" className="h-4 px-1 text-[9px]">Active</Badge>
                      </span>
                    ) : (
                      "Pick a user…"
                    )}
                  </DropdownMenuItem>
                }
              />
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Admin Settings Quick Access */}
        {showAdminSettings && (
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Settings className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Admin Settings</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-52 max-h-80 overflow-y-auto">
              {ADMIN_QUICK_MENU.map((group, gi) => (
                <div key={group.label}>
                  {gi > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuLabel className="text-xs text-muted-foreground">{group.label}</DropdownMenuLabel>
                  {group.items.map((item) => (
                    <DropdownMenuItem
                      key={item.tab}
                      onClick={() => openTab(`/admin/settings?tab=${item.tab}`, item.title)}
                      className="gap-2 cursor-pointer"
                    >
                      <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
                      {item.title}
                    </DropdownMenuItem>
                  ))}
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Help</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link to="/help/quickbooks" target="_blank">
                QuickBooks Setup Guide
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {showNotifications && <NotificationBell />}
      </div>
    </header>
  );
}
