import { useState } from "react";
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
import { HelpCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePortalChatNotifications } from "@/hooks/usePortalChatNotifications";
import { AppTabsProvider } from "@/contexts/AppTabsContext";

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
  const { updatePassword, isAdmin } = useAuth();
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

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
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar 
          onAdminAction={onAdminAction} 
          onChangePassword={() => setChangePasswordOpen(true)}
        />
        
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="h-14 border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10 flex items-center justify-between px-4 shrink-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <SidebarTrigger />
              {/* Always show GlobalAdminSearch for admin users */}
              {isAdmin && <GlobalAdminSearch />}
              {headerContent}
            </div>
            <div className="flex items-center gap-2">
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
