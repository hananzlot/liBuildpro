import { useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { NotificationBell } from "@/components/dashboard/NotificationBell";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { usePortalChatNotifications } from "@/hooks/usePortalChatNotifications";

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
  const { updatePassword } = useAuth();
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
      <div className="min-h-screen flex w-full overflow-x-hidden">
        <AppSidebar 
          onAdminAction={onAdminAction} 
          onChangePassword={() => setChangePasswordOpen(true)}
        />
        
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Header */}
          <header className="h-14 border-b border-border/50 sticky top-0 z-10 flex items-center justify-between px-4">
            <div className="flex items-center gap-2 min-w-0">
              <SidebarTrigger />
              {headerContent}
            </div>
            <div className="flex items-center gap-2">
              {showNotifications && <NotificationBell />}
            </div>
          </header>

          {/* Main content */}
          <main className="flex-1 min-w-0 overflow-hidden">
            <div className="h-full min-w-0 overflow-y-auto overflow-x-hidden">
              {children}
            </div>
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
