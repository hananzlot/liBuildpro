import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell, Check, CheckCheck, Calendar, DollarSign,
  ClipboardList, AlertTriangle, Receipt, FileText,
  MoreHorizontal, EyeOff, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNotifications } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";

type NotificationType = "reminder" | "overdue_invoice" | "overdue_task" | "stale_opportunity" | "bill_due" | "proposal_activity";
type FilterTab = "all" | "appointments" | "financial" | "tasks";

const typeConfig: Record<NotificationType, { icon: typeof Bell; bg: string; text: string }> = {
  reminder: { icon: Calendar, bg: "bg-amber-500/20", text: "text-amber-500" },
  overdue_invoice: { icon: DollarSign, bg: "bg-destructive/20", text: "text-destructive" },
  overdue_task: { icon: ClipboardList, bg: "bg-orange-500/20", text: "text-orange-500" },
  stale_opportunity: { icon: AlertTriangle, bg: "bg-yellow-500/20", text: "text-yellow-600" },
  bill_due: { icon: Receipt, bg: "bg-violet-500/20", text: "text-violet-500" },
  proposal_activity: { icon: FileText, bg: "bg-emerald-500/20", text: "text-emerald-500" },
};

const tabFilters: Record<FilterTab, NotificationType[]> = {
  all: [],
  appointments: ["reminder"],
  financial: ["overdue_invoice", "bill_due", "proposal_activity"],
  tasks: ["overdue_task", "stale_opportunity"],
};

const actionableTypes: NotificationType[] = ["stale_opportunity", "overdue_task", "overdue_invoice", "bill_due"];

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead, dismissNotification, snoozeNotification } = useNotifications();

  const filteredNotifications =
    activeTab === "all"
      ? notifications
      : notifications.filter((n) =>
          tabFilters[activeTab].includes(n.type as NotificationType)
        );

  // Today's Focus counts
  const todayCounts = {
    invoices: notifications.filter((n) => !n.read && n.type === "overdue_invoice").length,
    tasks: notifications.filter((n) => !n.read && n.type === "overdue_task").length,
    stale: notifications.filter((n) => !n.read && n.type === "stale_opportunity").length,
    bills: notifications.filter((n) => !n.read && n.type === "bill_due").length,
    proposals: notifications.filter((n) => !n.read && n.type === "proposal_activity").length,
  };

  const focusParts: string[] = [];
  if (todayCounts.invoices) focusParts.push(`${todayCounts.invoices} overdue invoice${todayCounts.invoices > 1 ? "s" : ""}`);
  if (todayCounts.tasks) focusParts.push(`${todayCounts.tasks} overdue task${todayCounts.tasks > 1 ? "s" : ""}`);
  if (todayCounts.stale) focusParts.push(`${todayCounts.stale} stale lead${todayCounts.stale > 1 ? "s" : ""}`);
  if (todayCounts.bills) focusParts.push(`${todayCounts.bills} bill${todayCounts.bills > 1 ? "s" : ""} due`);
  if (todayCounts.proposals) focusParts.push(`${todayCounts.proposals} proposal update${todayCounts.proposals > 1 ? "s" : ""}`);

  const handleNotificationClick = (notification: typeof notifications[0]) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    if (notification.reference_url) {
      setOpen(false);
      navigate(notification.reference_url);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-destructive"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b">
          <h4 className="font-semibold text-sm">Notifications</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => markAllAsRead()}
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        {/* Today's Focus */}
        {focusParts.length > 0 && (
          <div className="px-3 py-2 border-b bg-muted/30">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Today's Focus:</span>{" "}
              {focusParts.join(", ")}
            </p>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="px-3 pt-2">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FilterTab)}>
            <TabsList className="h-7 w-full">
              <TabsTrigger value="all" className="text-xs h-6 flex-1">All</TabsTrigger>
              <TabsTrigger value="appointments" className="text-xs h-6 flex-1">Appts</TabsTrigger>
              <TabsTrigger value="financial" className="text-xs h-6 flex-1">Financial</TabsTrigger>
              <TabsTrigger value="tasks" className="text-xs h-6 flex-1">Tasks</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Notification List */}
        <ScrollArea className="h-80">
          {filteredNotifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No notifications
            </div>
          ) : (
            <div className="divide-y">
              {filteredNotifications.map((notification) => {
                const config = typeConfig[notification.type as NotificationType] || typeConfig.reminder;
                const Icon = config.icon;
                const isActionable = actionableTypes.includes(notification.type as NotificationType);

                return (
                  <div
                    key={notification.id}
                    role="button"
                    tabIndex={0}
                    className={`p-3 hover:bg-muted/50 cursor-pointer transition-colors active:bg-muted ${
                      !notification.read ? "bg-primary/5" : ""
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleNotificationClick(notification); }}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`rounded-full p-1.5 ${config.bg} ${config.text}`}>
                        <Icon className="h-3 w-3" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-medium truncate ${notification.reference_url ? "text-primary hover:underline" : ""}`}>
                            {notification.title}
                          </p>
                          {!notification.read && (
                            <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(notification.created_at), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                      {isActionable && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem onClick={() => dismissNotification(notification.id)}>
                              <EyeOff className="h-3.5 w-3.5 mr-2" />
                              Dismiss
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => snoozeNotification({ notificationId: notification.id, days: 1 })}>
                              <Clock className="h-3.5 w-3.5 mr-2" />
                              Snooze 1 day
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => snoozeNotification({ notificationId: notification.id, days: 3 })}>
                              <Clock className="h-3.5 w-3.5 mr-2" />
                              Snooze 3 days
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => snoozeNotification({ notificationId: notification.id, days: 7 })}>
                              <Clock className="h-3.5 w-3.5 mr-2" />
                              Snooze 7 days
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
