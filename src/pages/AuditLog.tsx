import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, FileText, Filter, X } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";

interface AuditLog {
  id: string;
  table_name: string;
  record_id: string | null;
  action: string;
  user_id: string | null;
  user_email: string | null;
  changed_at: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  changes: Record<string, unknown> | null;
  description: string | null;
}

export default function AuditLog() {
  const navigate = useNavigate();
  const { isAdmin, isLoading: authLoading, companyId } = useAuth();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const { data: logs, isLoading } = useQuery({
    queryKey: ["audit-logs", companyId, startDate, endDate, tableFilter, actionFilter, userFilter],
    queryFn: async () => {
      let query = supabase
        .from("audit_logs")
        .select("*")
        .eq("company_id", companyId)
        .order("changed_at", { ascending: false })
        .limit(500);

      if (startDate) {
        query = query.gte("changed_at", `${startDate}T00:00:00`);
      }
      if (endDate) {
        query = query.lte("changed_at", `${endDate}T23:59:59`);
      }
      if (tableFilter && tableFilter !== "all") {
        query = query.eq("table_name", tableFilter);
      }
      if (actionFilter && actionFilter !== "all") {
        query = query.eq("action", actionFilter);
      }
      if (userFilter) {
        query = query.ilike("user_email", `%${userFilter}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AuditLog[];
    },
    enabled: isAdmin && !!companyId,
  });

  const { data: distinctTables } = useQuery({
    queryKey: ["audit-log-tables", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("table_name")
        .eq("company_id", companyId)
        .order("table_name");
      if (error) throw error;
      const unique = [...new Set(data.map((d) => d.table_name))];
      return unique;
    },
    enabled: isAdmin && !!companyId,
  });

  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
    setTableFilter("all");
    setActionFilter("all");
    setUserFilter("");
  };

  const getActionBadgeVariant = (action: string) => {
    switch (action) {
      case "INSERT":
        return "default";
      case "UPDATE":
        return "secondary";
      case "DELETE":
        return "destructive";
      default:
        return "outline";
    }
  };

  const handleAdminAction = (action: string) => {
    // No additional admin actions needed on this page
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <AppLayout onAdminAction={handleAdminAction}>
      <div className="px-6 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Audit Log</h1>
          <p className="text-muted-foreground">View all changes made to projects and related data</p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter className="h-4 w-4" /> Filters
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" /> Clear
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div>
                <Label>Table</Label>
                <Select value={tableFilter} onValueChange={setTableFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All tables" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All tables</SelectItem>
                    {distinctTables?.map((table) => (
                      <SelectItem key={table} value={table}>
                        {table}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Action</Label>
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All actions</SelectItem>
                    <SelectItem value="INSERT">INSERT</SelectItem>
                    <SelectItem value="UPDATE">UPDATE</SelectItem>
                    <SelectItem value="DELETE">DELETE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="user-filter">User Email</Label>
                <Input
                  id="user-filter"
                  placeholder="Search by email..."
                  value={userFilter}
                  onChange={(e) => setUserFilter(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activity Log</CardTitle>
            <CardDescription>
              Showing {logs?.length || 0} records (max 500)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[15%] whitespace-nowrap">Date/Time</TableHead>
                      <TableHead className="w-[18%]">User</TableHead>
                      <TableHead className="w-[12%]">Table</TableHead>
                      <TableHead className="w-[10%]">Action</TableHead>
                      <TableHead className="w-[38%]">Description</TableHead>
                      <TableHead className="w-[7%]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No audit logs found
                        </TableCell>
                      </TableRow>
                    ) : (
                      logs?.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="whitespace-nowrap text-sm">
                            {format(new Date(log.changed_at), "MM/dd/yy h:mm a")}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {log.user_email || "System"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{log.table_name}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getActionBadgeVariant(log.action)}>
                              {log.action}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[300px] truncate">
                            {log.description || "-"}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedLog(log)}
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Sheet open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <SheetContent className="w-[500px] sm:w-[600px]">
          <SheetHeader>
            <SheetTitle>Audit Log Details</SheetTitle>
            <SheetDescription>
              {selectedLog?.description || "Change details"}
            </SheetDescription>
          </SheetHeader>
          {selectedLog && (
            <ScrollArea className="h-[calc(100vh-120px)] mt-4">
              <div className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">Date/Time</Label>
                  <p className="font-medium">
                    {format(new Date(selectedLog.changed_at), "PPpp")}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">User</Label>
                  <p className="font-medium">{selectedLog.user_email || "System"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Table</Label>
                  <p className="font-medium">{selectedLog.table_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Action</Label>
                  <Badge variant={getActionBadgeVariant(selectedLog.action)}>
                    {selectedLog.action}
                  </Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Record ID</Label>
                  <p className="font-mono text-sm">{selectedLog.record_id}</p>
                </div>

                {selectedLog.changes && Object.keys(selectedLog.changes).length > 0 && (
                  <div>
                    <Label className="text-muted-foreground">Changes</Label>
                    <pre className="mt-1 p-3 bg-muted rounded-md text-sm overflow-x-auto">
                      {JSON.stringify(selectedLog.changes, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.old_values && (
                  <div>
                    <Label className="text-muted-foreground">Previous Values</Label>
                    <pre className="mt-1 p-3 bg-muted rounded-md text-sm overflow-x-auto">
                      {JSON.stringify(selectedLog.old_values, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.new_values && (
                  <div>
                    <Label className="text-muted-foreground">New Values</Label>
                    <pre className="mt-1 p-3 bg-muted rounded-md text-sm overflow-x-auto">
                      {JSON.stringify(selectedLog.new_values, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
