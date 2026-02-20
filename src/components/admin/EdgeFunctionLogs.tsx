import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, AlertCircle, CheckCircle2, Clock, X, Filter, Activity } from "lucide-react";
import { format } from "date-fns";

interface EdgeFunctionLog {
  id: string;
  function_name: string;
  company_id: string | null;
  status: string;
  duration_ms: number | null;
  request_summary: Record<string, unknown> | null;
  response_summary: Record<string, unknown> | null;
  error_message: string | null;
  error_details: string | null;
  user_id: string | null;
  created_at: string;
}

export function EdgeFunctionLogs() {
  const { companyId } = useCompanyContext();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [functionFilter, setFunctionFilter] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<EdgeFunctionLog | null>(null);

  const { data: logs, isLoading } = useQuery({
    queryKey: ["edge-function-logs", companyId, statusFilter, functionFilter],
    queryFn: async () => {
      let query = supabase
        .from("edge_function_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (companyId) {
        query = query.eq("company_id", companyId);
      }
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      if (functionFilter !== "all") {
        query = query.eq("function_name", functionFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as EdgeFunctionLog[];
    },
    enabled: !!companyId,
  });

  // Get unique function names for filter
  const functionNames = [...new Set((logs || []).map(l => l.function_name))].sort();

  const statusIcon = (status: string) => {
    switch (status) {
      case "success": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "error": return <AlertCircle className="h-4 w-4 text-destructive" />;
      case "timeout": return <Clock className="h-4 w-4 text-warning" />;
      default: return null;
    }
  };

  const statusBadge = (status: string) => {
    const variant = status === "success" ? "default" : status === "error" ? "destructive" : "secondary";
    return <Badge variant={variant} className="text-xs">{status}</Badge>;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-4 w-4" /> Edge Function Logs
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px] h-8">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="timeout">Timeout</SelectItem>
                </SelectContent>
              </Select>
              <Select value={functionFilter} onValueChange={setFunctionFilter}>
                <SelectTrigger className="w-[180px] h-8">
                  <SelectValue placeholder="Function" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Functions</SelectItem>
                  {functionNames.map(fn => (
                    <SelectItem key={fn} value={fn}>{fn}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(statusFilter !== "all" || functionFilter !== "all") && (
                <Button variant="ghost" size="sm" onClick={() => { setStatusFilter("all"); setFunctionFilter("all"); }}>
                  <X className="h-3 w-3 mr-1" /> Clear
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !logs?.length ? (
            <p className="text-center text-muted-foreground py-8">No edge function logs found</p>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[160px]">Time</TableHead>
                    <TableHead>Function</TableHead>
                    <TableHead className="w-[90px]">Status</TableHead>
                    <TableHead className="w-[90px]">Duration</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map(log => (
                    <TableRow
                      key={log.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedLog(log)}
                    >
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {format(new Date(log.created_at), "MMM d HH:mm:ss")}
                      </TableCell>
                      <TableCell className="font-medium text-sm">{log.function_name}</TableCell>
                      <TableCell>{statusBadge(log.status)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.duration_ms != null ? `${log.duration_ms}ms` : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-destructive truncate max-w-[300px]">
                        {log.error_message || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {selectedLog && statusIcon(selectedLog.status)}
              {selectedLog?.function_name}
            </SheetTitle>
          </SheetHeader>
          {selectedLog && (
            <ScrollArea className="h-[calc(100vh-120px)] mt-4">
              <div className="space-y-4 pr-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <div className="mt-1">{statusBadge(selectedLog.status)}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Duration</Label>
                    <p className="text-sm mt-1">
                      {selectedLog.duration_ms != null ? `${selectedLog.duration_ms}ms` : "Unknown"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Time</Label>
                    <p className="text-sm mt-1 font-mono">
                      {format(new Date(selectedLog.created_at), "MMM d, yyyy HH:mm:ss")}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">User ID</Label>
                    <p className="text-sm mt-1 font-mono truncate">
                      {selectedLog.user_id || "—"}
                    </p>
                  </div>
                </div>

                {selectedLog.error_message && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Error Message</Label>
                    <p className="text-sm mt-1 text-destructive bg-destructive/10 p-2 rounded">
                      {selectedLog.error_message}
                    </p>
                  </div>
                )}

                {selectedLog.error_details && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Stack Trace</Label>
                    <pre className="text-xs mt-1 bg-muted p-3 rounded overflow-x-auto whitespace-pre-wrap font-mono">
                      {selectedLog.error_details}
                    </pre>
                  </div>
                )}

                {selectedLog.request_summary && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Request Summary</Label>
                    <pre className="text-xs mt-1 bg-muted p-3 rounded overflow-x-auto whitespace-pre-wrap font-mono">
                      {JSON.stringify(selectedLog.request_summary, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.response_summary && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Response Summary</Label>
                    <pre className="text-xs mt-1 bg-muted p-3 rounded overflow-x-auto whitespace-pre-wrap font-mono">
                      {JSON.stringify(selectedLog.response_summary, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
