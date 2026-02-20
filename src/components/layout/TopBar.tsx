import { Link } from "react-router-dom";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { GlobalAdminSearch } from "./GlobalAdminSearch";
import { NotificationBell } from "@/components/dashboard/NotificationBell";
import { Button } from "@/components/ui/button";
import { HelpCircle, ExternalLink } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface TopBarProps {
  showNotifications?: boolean;
  headerContent?: React.ReactNode;
}

export function TopBar({ showNotifications = true, headerContent }: TopBarProps) {
  return (
    <header className="h-12 shadow-xs bg-card backdrop-blur-sm sticky top-0 z-30 flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <SidebarTrigger />
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
