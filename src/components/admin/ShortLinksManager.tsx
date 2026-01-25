import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Plus, Copy, ExternalLink, BarChart3, Trash2, Link2, MousePointerClick, Calendar, RefreshCw } from "lucide-react";
import { format } from "date-fns";

interface ShortLink {
  id: string;
  short_code: string;
  custom_alias: string | null;
  long_url: string;
  title: string | null;
  is_active: boolean;
  click_count: number;
  expires_at: string | null;
  max_clicks: number | null;
  created_by_type: string;
  created_at: string;
  last_clicked_at: string | null;
  short_url?: string;
}

interface AnalyticsData {
  link: ShortLink;
  analytics: {
    total_clicks: number;
    clicks_last_30_days: number;
    daily_clicks: { date: string; clicks: number }[];
    top_referers: { referer: string; count: number }[];
    device_breakdown: { device: string; count: number }[];
  };
}

export function ShortLinksManager() {
  const { companyId } = useAuth();
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [analyticsSheetOpen, setAnalyticsSheetOpen] = useState(false);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [newLink, setNewLink] = useState({
    long_url: "",
    custom_alias: "",
    title: "",
    expires_at: "",
    max_clicks: "",
  });
  const [isCreating, setIsCreating] = useState(false);

  // Fetch short links
  const { data: linksData, isLoading: linksLoading, refetch } = useQuery({
    queryKey: ["short-links", companyId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("list-short-links", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.error) throw response.error;
      return response.data as { links: ShortLink[]; total: number };
    },
    enabled: !!companyId,
  });

  // Fetch analytics for selected link
  const { data: analyticsData, isLoading: analyticsLoading } = useQuery({
    queryKey: ["short-link-analytics", selectedLinkId],
    queryFn: async () => {
      if (!selectedLinkId) return null;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke(`short-link-analytics/${selectedLinkId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.error) throw response.error;
      return response.data as AnalyticsData;
    },
    enabled: !!selectedLinkId && analyticsSheetOpen,
  });

  // Create short link
  const createLink = async () => {
    setIsCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const payload: Record<string, any> = {
        long_url: newLink.long_url,
      };

      if (newLink.custom_alias.trim()) {
        payload.custom_alias = newLink.custom_alias.trim();
      }
      if (newLink.title.trim()) {
        payload.title = newLink.title.trim();
      }
      if (newLink.expires_at) {
        payload.expires_at = new Date(newLink.expires_at).toISOString();
      }
      if (newLink.max_clicks) {
        payload.max_clicks = parseInt(newLink.max_clicks);
      }

      const response = await supabase.functions.invoke("create-short-link", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: payload,
      });

      if (response.error) throw response.error;

      toast.success("Short link created!", {
        description: response.data.short_url,
        action: {
          label: "Copy",
          onClick: () => copyToClipboard(response.data.short_url),
        },
      });

      setCreateDialogOpen(false);
      setNewLink({ long_url: "", custom_alias: "", title: "", expires_at: "", max_clicks: "" });
      queryClient.invalidateQueries({ queryKey: ["short-links"] });
    } catch (error: any) {
      console.error("Create link error:", error);
      toast.error("Failed to create short link", {
        description: error.message || "Please try again",
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Delete short link
  const deleteLink = async (linkId: string) => {
    try {
      const { error } = await supabase
        .from("short_links")
        .delete()
        .eq("id", linkId);

      if (error) throw error;

      toast.success("Short link deleted");
      queryClient.invalidateQueries({ queryKey: ["short-links"] });
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error("Failed to delete link", { description: error.message });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const openAnalytics = (linkId: string) => {
    setSelectedLinkId(linkId);
    setAnalyticsSheetOpen(true);
  };

  const getCreatorBadge = (type: string) => {
    switch (type) {
      case "internal_user":
        return <Badge variant="default">Internal</Badge>;
      case "customer":
        return <Badge variant="secondary">Customer</Badge>;
      case "salesperson":
        return <Badge variant="outline">Salesperson</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Short Links
              </CardTitle>
              <CardDescription>
                Create and manage shortened URLs with click tracking
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Link
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-background">
                  <DialogHeader>
                    <DialogTitle>Create Short Link</DialogTitle>
                    <DialogDescription>
                      Create a new shortened URL for easy sharing
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="long_url">Destination URL *</Label>
                      <Input
                        id="long_url"
                        placeholder="https://example.com/very/long/url"
                        value={newLink.long_url}
                        onChange={(e) => setNewLink({ ...newLink, long_url: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="title">Title (optional)</Label>
                      <Input
                        id="title"
                        placeholder="My Campaign Link"
                        value={newLink.title}
                        onChange={(e) => setNewLink({ ...newLink, title: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="custom_alias">Custom Alias (optional)</Label>
                      <Input
                        id="custom_alias"
                        placeholder="my-custom-link"
                        value={newLink.custom_alias}
                        onChange={(e) => setNewLink({ ...newLink, custom_alias: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        3-40 characters, letters, numbers, underscores, and hyphens only
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="expires_at">Expires At (optional)</Label>
                        <Input
                          id="expires_at"
                          type="datetime-local"
                          value={newLink.expires_at}
                          onChange={(e) => setNewLink({ ...newLink, expires_at: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="max_clicks">Max Clicks (optional)</Label>
                        <Input
                          id="max_clicks"
                          type="text"
                          inputMode="numeric"
                          placeholder="100"
                          value={newLink.max_clicks}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^\d]/g, "");
                            setNewLink({ ...newLink, max_clicks: val });
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={createLink} disabled={!newLink.long_url || isCreating}>
                      {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Create Link
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {linksLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !linksData?.links?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <Link2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No short links created yet</p>
              <p className="text-sm mt-1">Create your first link to get started</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Link</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Clicks</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linksData.links.map((link) => (
                    <TableRow key={link.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <code className="text-sm bg-muted px-2 py-0.5 rounded">
                              {link.custom_alias || link.short_code}
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyToClipboard(link.short_url || "")}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            {link.short_url && (
                              <a
                                href={link.short_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate max-w-[250px]">
                            {link.long_url}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{link.title || "-"}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <MousePointerClick className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{link.click_count}</span>
                          {link.max_clicks && (
                            <span className="text-muted-foreground">/ {link.max_clicks}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getCreatorBadge(link.created_by_type)}</TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(link.created_at), "MMM d, yyyy")}
                        </span>
                      </TableCell>
                      <TableCell>
                        {!link.is_active ? (
                          <Badge variant="destructive">Inactive</Badge>
                        ) : link.expires_at && new Date(link.expires_at) < new Date() ? (
                          <Badge variant="secondary">Expired</Badge>
                        ) : link.max_clicks && link.click_count >= link.max_clicks ? (
                          <Badge variant="secondary">Limit Reached</Badge>
                        ) : (
                          <Badge variant="default">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openAnalytics(link.id)}
                          >
                            <BarChart3 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm("Are you sure you want to delete this link?")) {
                                deleteLink(link.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analytics Sheet */}
      <Sheet open={analyticsSheetOpen} onOpenChange={setAnalyticsSheetOpen}>
        <SheetContent className="w-full sm:max-w-xl bg-background">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Link Analytics
            </SheetTitle>
            <SheetDescription>
              Click statistics and performance data
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-120px)] mt-4">
            {analyticsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : analyticsData ? (
              <div className="space-y-6 pr-4">
                {/* Link Info */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Link Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div>
                      <Label className="text-muted-foreground text-xs">Short URL</Label>
                      <div className="flex items-center gap-2">
                        <code className="text-sm">{analyticsData.link.short_url}</code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyToClipboard(analyticsData.link.short_url || "")}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Destination</Label>
                      <p className="text-sm break-all">{analyticsData.link.long_url}</p>
                    </div>
                    {analyticsData.link.title && (
                      <div>
                        <Label className="text-muted-foreground text-xs">Title</Label>
                        <p className="text-sm">{analyticsData.link.title}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Click Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2">
                        <MousePointerClick className="h-5 w-5 text-primary" />
                        <div>
                          <p className="text-2xl font-bold">{analyticsData.analytics.total_clicks}</p>
                          <p className="text-xs text-muted-foreground">Total Clicks</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-primary" />
                        <div>
                          <p className="text-2xl font-bold">{analyticsData.analytics.clicks_last_30_days}</p>
                          <p className="text-xs text-muted-foreground">Last 30 Days</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Daily Clicks Chart (simple text-based) */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Daily Clicks (Last 30 Days)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {analyticsData.analytics.daily_clicks.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No click data yet</p>
                    ) : (
                      <div className="space-y-1 max-h-[200px] overflow-y-auto">
                        {analyticsData.analytics.daily_clicks
                          .filter((d) => d.clicks > 0)
                          .slice(-14)
                          .map((day) => (
                            <div key={day.date} className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground w-20">
                                {format(new Date(day.date), "MMM d")}
                              </span>
                              <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full"
                                  style={{
                                    width: `${Math.min(100, (day.clicks / Math.max(...analyticsData.analytics.daily_clicks.map((d) => d.clicks))) * 100)}%`,
                                  }}
                                />
                              </div>
                              <span className="text-xs font-medium w-8 text-right">{day.clicks}</span>
                            </div>
                          ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Device Breakdown */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Device Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {analyticsData.analytics.device_breakdown.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No device data yet</p>
                    ) : (
                      <div className="space-y-2">
                        {analyticsData.analytics.device_breakdown.map((device) => (
                          <div key={device.device} className="flex items-center justify-between">
                            <span className="text-sm capitalize">{device.device}</span>
                            <Badge variant="secondary">{device.count}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Top Referers */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Top Referers</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {analyticsData.analytics.top_referers.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No referer data yet</p>
                    ) : (
                      <div className="space-y-2">
                        {analyticsData.analytics.top_referers.slice(0, 5).map((ref) => (
                          <div key={ref.referer} className="flex items-center justify-between">
                            <span className="text-sm truncate max-w-[180px]">{ref.referer}</span>
                            <Badge variant="secondary">{ref.count}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">No analytics data available</p>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}
