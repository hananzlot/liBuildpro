import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { AppTabBar } from "./AppTabBar";
import { GlobalAdminSearch } from "./GlobalAdminSearch";
import { NotificationBell } from "@/components/dashboard/NotificationBell";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { HelpCircle, ExternalLink } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePortalChatNotifications } from "@/hooks/usePortalChatNotifications";
import { useAppTabs } from "@/contexts/AppTabsContext";

const SIDEBAR_PINNED_KEY = "sidebar:pinned";

interface AppLayoutProps {
  children: React.ReactNode;
  onAdminAction?: (action: string) => void;
  showNotifications?: boolean;
  headerContent?: React.ReactNode;
}

export function AppLayout({ 
  children, 
  onAdminAction, 
  showNotifications = true,
  headerContent 
}: AppLayoutProps) {
  const { updatePassword, isAdmin, companyId } = useAuth();
  const { openTab, setTabCompanyId } = useAppTabs();

  // Sync company context into the tab system so tabs are isolated per tenant
  useEffect(() => {
    setTabCompanyId(companyId);
  }, [companyId, setTabCompanyId]);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Read pinned state from localStorage to control initial sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const pinned = localStorage.getItem(SIDEBAR_PINNED_KEY);
    // Default to open (uncollapsed) if no preference has been saved yet
    return pinned === null ? true : pinned === "true";
  });

  // Listen for pinned state changes from the sidebar
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === SIDEBAR_PINNED_KEY) {
        setSidebarOpen(e.newValue === "true");
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Listen for customer portal chat messages
  usePortalChatNotifications();

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    setIsChangingPassword(true);
    try {
      const { error } = await updatePassword(newPassword);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Password updated successfully");
        setChangePasswordOpen(false);
        setNewPassword("");
        setConfirmPassword("");
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <div className="h-screen flex w-full overflow-hidden">
        <AppSidebar 
          onAdminAction={onAdminAction} 
          onChangePassword={() => setChangePasswordOpen(true)}
        />
        
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="h-12 shadow-xs bg-card backdrop-blur-sm sticky top-0 z-30 flex items-center justify-between px-4 shrink-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <SidebarTrigger />
              {/* Always show GlobalAdminSearch for all authenticated users */}
              <GlobalAdminSearch />
              {headerContent}
            </div>
            <div className="flex items-center gap-2">
              {/* Quick Web Search - opens Google in popup window */}
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
                        'https://www.google.com',
                        'WebSearch',
                        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
                      );
                    }}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Open Web Search</TooltipContent>
              </Tooltip>
              
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

          {/* Inner Tab Bar */}
          <AppTabBar />

          {/* Main content - allows horizontal scroll within tables/content */}
          <main className="flex-1 min-w-0 overflow-auto">
            {children}
          </main>
        </div>
      </div>

      {/* Change Password Dialog */}
      <Dialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Enter your new password below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setChangePasswordOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleChangePassword}
              disabled={isChangingPassword}
            >
              {isChangingPassword ? "Updating..." : "Update Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
