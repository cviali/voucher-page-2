"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { getApiUrl } from "@/lib/api-config";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface AuditLog {
  id: number;
  action: string;
  details: string | null;
  userId: number | null;
  username: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export default function AuditLogPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(30);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLogs = useCallback(async (currentPage: number) => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const offset = (currentPage - 1) * limit;
      const res = await fetch(getApiUrl(`/audit-logs?limit=${limit}&offset=${offset}`), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        return;
      }

      if (res.ok) {
        const result = (await res.json()) as { data: AuditLog[]; total: number };
        setLogs(result.data);
        setTotal(result.total);
        setTotalPages(Math.ceil(result.total / limit));
      } else {
        toast.error("Failed to fetch audit logs");
      }
    } catch {
      toast.error("An error occurred while fetching logs");
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchLogs(page);
  }, [page, fetchLogs]);

  const formatDateTime = (dateStr: string) => {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(dateStr));
  };

  if (authLoading || !user) return null;

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Audit Logs</h1>
          </div>
          <p className="text-muted-foreground">
            Monitor system activities and administrative actions.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6 w-[200px]">Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Details</TableHead>
                <TableHead className="pr-6 text-right">IP Address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      <span>Loading logs...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-12 text-muted-foreground pl-6 pr-6"
                  >
                    No audit logs found.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-muted/30">
                    <TableCell className="pl-6">
                      {formatDateTime(log.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        {log.username || "System"}
                      </div>
                    </TableCell>
                    <TableCell>
                      {log.action.replace(/_/g, " ")}
                    </TableCell>
                    <TableCell className="max-w-xs md:max-w-md lg:max-w-xl" title={log.details || ""}>
                      {log.details}
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      {log.ipAddress || "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 order-2 sm:order-1">
            <p className="text-sm text-muted-foreground">
              Showing {logs.length} of {total} activities
            </p>
          </div>
          <div className="flex items-center space-x-2 order-1 sm:order-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">Rows per page</span>
              <Select
                value={limit.toString()}
                onValueChange={(v) => {
                  setLimit(parseInt(v));
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue placeholder={limit.toString()} />
                </SelectTrigger>
                <SelectContent side="top">
                  <SelectItem value="30">30</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 shadow-sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || isLoading}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <div className="text-sm font-medium px-2">
              Page {page} of {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 shadow-sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || isLoading}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
