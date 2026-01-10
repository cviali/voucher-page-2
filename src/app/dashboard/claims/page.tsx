"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useAuth } from "@/hooks/use-auth";
import { getApiUrl } from "@/lib/api-config";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Ticket,
  Search,
  ListFilter,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { formatDate } from "@/lib/utils";
import { VoucherClaimDrawer } from "@/components/voucher-claim-drawer";
import { VoucherStatusBadge } from "@/components/voucher-status-badge";

interface Voucher {
  id: string;
  code: string;
  status: string;
  createdAt: string;
  expiryDate: string | null;
  imageUrl: string | null;
  bindedToPhoneNumber: string | null;
  customerName: string | null;
  name: string | null;
  claimRequestedAt?: string | null;
}

export default function ClaimsPage() {
  const { user, logout } = useAuth();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [requestedVouchers, setRequestedVouchers] = useState<Voucher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRequestedLoading, setIsRequestedLoading] = useState(true);
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // Pagination & Filters
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(30);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchRequestedVouchers = useCallback(async () => {
    setIsRequestedLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        getApiUrl(`/vouchers?requested=true&limit=100`),
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.status === 401) {
        logout();
        return;
      }
      if (res.ok) {
        const result = (await res.json()) as { data: Voucher[] };
        setRequestedVouchers(result.data);
      }
    } catch {
      console.error("Failed to fetch requested vouchers");
    } finally {
      setIsRequestedLoading(false);
    }
  }, [logout]);

  const fetchActiveVouchers = useCallback(async (currentPage: number) => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        getApiUrl(`/vouchers?status=active&page=${currentPage}&limit=${limit}&search=${debouncedSearch}`),
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.ok) {
        const result = (await res.json()) as {
          data: Voucher[];
          pagination: { totalPages: number; total: number };
        };
        setVouchers(result.data);
        setTotalPages(result.pagination.totalPages);
        setTotal(result.pagination.total);
      }
    } catch {
      toast.error("Failed to fetch vouchers");
    } finally {
      setIsLoading(false);
    }
  }, [limit, debouncedSearch]);

  useEffect(() => {
    if (user && (user.role === "cashier" || user.role === "admin")) {
      fetchRequestedVouchers();
    }
  }, [user, fetchRequestedVouchers]);

  useEffect(() => {
    if (user && (user.role === "cashier" || user.role === "admin")) {
      fetchActiveVouchers(page);
    }
  }, [user, page, limit, debouncedSearch, fetchActiveVouchers]);

  const handleRowClick = (voucher: Voucher) => {
    setSelectedVoucher(voucher);
    setIsSheetOpen(true);
  };

  return (
    <div className="flex flex-1 flex-col p-8 gap-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold">Claim Vouchers</h1>
          <p className="text-muted-foreground ">
            Approve and process voucher claims for customers.
          </p>
        </div>
      </div>

      <div className="space-y-3">

        {/* Requested Vouchers Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              Redeem Requests
              {requestedVouchers.length > 0 && (
                <Badge variant="destructive" className="rounded-full px-2 py-0.5 text-[10px]">
                  {requestedVouchers.length}
                </Badge>
              )}
            </h2>
            <Button
              variant="outline"
              className="w-full md:w-auto"
              onClick={fetchRequestedVouchers}
              disabled={isRequestedLoading}
            >
              {isRequestedLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ListFilter className="h-4 w-4 mr-2" />}
              Refresh Requests
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {requestedVouchers.length === 0 ? (
              <div className="col-span-full py-8 text-center border rounded-xl bg-muted/20 text-muted-foreground text-sm">
                No pending redemption requests.
              </div>
            ) : (
              requestedVouchers.map((voucher) => (
                <div
                  key={voucher.id}
                  className="p-4 cursor-pointer hover:border-amber-500/50 transition-all border-2 border-amber-100 bg-amber-50/30 dark:bg-amber-950/20 dark:border-amber-900/50 active:scale-95 rounded-xl"
                  onClick={() => handleRowClick(voucher)}
                >
                  <div className="flex items-start gap-3">
                    {voucher.imageUrl ? (
                      <Image
                        src={voucher.imageUrl}
                        alt=""
                        width={40}
                        height={40}
                        className="w-10 h-10 rounded-lg object-cover border bg-white shadow-xs"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
                        <Ticket className="w-5 h-5 text-zinc-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-mono font-bold text-[13px] truncate uppercase tracking-wider">{voucher.code}</p>
                      <p className="font-medium text-xs truncate leading-tight mt-0.5">{voucher.customerName || "Unknown"}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{voucher.bindedToPhoneNumber}</p>
                    </div>
                    <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[9px] px-1.5 h-5 shadow-sm">NEW</Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4 pt-4">
          <div className="flex-1 space-y-4">
            <div className="md:hidden">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="filters" className="border-none">
                  <AccordionTrigger className="flex gap-2 py-0 hover:no-underline">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <ListFilter className="h-4 w-4" />
                      Filter Vouchers
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-4 pb-0">
                    <div className="grid gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="search-mobile" className="text-xs font-bold uppercase text-muted-foreground">Search Voucher</Label>
                        <div className="relative">
                          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="search-mobile"
                            placeholder="Search code or name..."
                            className="pl-8 bg-background"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            {/* Desktop/Tablet Filters */}
            <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="search-desktop" className="text-[10px] font-bold uppercase text-muted-foreground px-1">Search Voucher</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search-desktop"
                    placeholder="Search by code or name..."
                    className="pl-8 bg-background"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Voucher</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead className="pr-6 text-right">Expiry Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vouchers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground pl-6 pr-6">
                          No active vouchers found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      vouchers.map((voucher) => (
                        <TableRow
                          key={voucher.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleRowClick(voucher)}
                        >
                          <TableCell className="font-mono font-medium pl-6">
                            <div className="flex items-center gap-3">
                              {voucher.imageUrl ? (
                                <Image
                                  src={voucher.imageUrl}
                                  alt=""
                                  width={40}
                                  height={40}
                                  className="w-10 h-10 rounded-md object-cover border shadow-sm"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center border">
                                  <Ticket className="h-5 w-5 text-muted-foreground/50" />
                                </div>
                              )}
                              <div className="flex flex-col">
                                <span className="text-sm font-bold uppercase tracking-wider text-foreground">{voucher.code}</span>
                                <span className="text-[10px] text-muted-foreground leading-tight">{voucher.name || "Unnamed Voucher"}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <VoucherStatusBadge
                              status={voucher.status}
                              expiryDate={voucher.expiryDate}
                              claimRequestedAt={voucher.claimRequestedAt}
                              className="text-[10px]"
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium text-sm">
                                {voucher.customerName || "Unknown Customer"}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {voucher.bindedToPhoneNumber}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            {formatDate(voucher.expiryDate)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination bar matching Voucher List */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4 order-2 sm:order-1">
                  <p className="text-sm text-muted-foreground">
                    Showing {vouchers.length} of {total} active
                  </p>
                </div>
                <div className="flex items-center space-x-2 order-1 sm:order-2">
                  <div className="flex items-center gap-2 mr-2">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">Rows per page</span>
                    <Select value={limit.toString()} onValueChange={(v) => {
                      setLimit(parseInt(v));
                      setPage(1);
                    }}>
                      <SelectTrigger size="sm" className="w-[70px]">
                        <SelectValue placeholder={limit.toString()} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1 || isLoading}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <div className="text-sm font-medium px-2 min-w-[80px] text-center">
                    Page {page} of {totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || isLoading}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <VoucherClaimDrawer
        isOpen={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        voucher={selectedVoucher}
        onSuccess={() => {
          fetchRequestedVouchers();
          fetchActiveVouchers(page);
        }}
      />
    </div>
  );
}
