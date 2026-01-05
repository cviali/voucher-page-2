"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2,
  User,
  Phone,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Trash2,
  Ticket,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Voucher {
  id: number;
  code: string;
  status: string;
  createdAt: string;
  expiryDate: string | null;
  imageUrl: string | null;
  bindedToPhoneNumber: string | null;
  customerName: string | null;
}

export default function ClaimsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [requestedVouchers, setRequestedVouchers] = useState<Voucher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRequestedLoading, setIsRequestedLoading] = useState(true);
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;

  const fetchRequestedVouchers = async () => {
    setIsRequestedLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `/api/vouchers?requested=true&limit=100`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.ok) {
        const result = (await res.json()) as { data: Voucher[] };
        setRequestedVouchers(result.data);
      }
    } catch {
      console.error("Failed to fetch requested vouchers");
    } finally {
      setIsRequestedLoading(false);
    }
  };

  const fetchActiveVouchers = async (currentPage: number) => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `/api/vouchers?status=active&page=${currentPage}&limit=${limit}`,
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
  };

  useEffect(() => {
    if (user && (user.role === "cashier" || user.role === "admin")) {
      fetchRequestedVouchers();
      fetchActiveVouchers(page);
    }
  }, [user, page]);

  if (authLoading) return null;
  if (!user || (user.role !== "cashier" && user.role !== "admin")) return null;

  const handleRowClick = (voucher: Voucher) => {
    setSelectedVoucher(voucher);
    setIsSheetOpen(true);
  };

  const handleClaim = async () => {
    if (!selectedVoucher) return;

    setIsClaiming(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/vouchers/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: selectedVoucher.code }),
      });

      if (res.ok) {
        toast.success("Voucher successfully claimed");
        setIsSheetOpen(false);
        fetchRequestedVouchers();
        fetchActiveVouchers(page);
      } else {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error || "Failed to claim voucher");
      }
    } catch {
      toast.error("Connection error");
    } finally {
      setIsClaiming(false);
    }
  };

  const handleDeleteVoucher = async () => {
    if (!selectedVoucher) return;
    if (!confirm("Are you sure you want to delete this voucher?")) return;

    setIsDeleting(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/vouchers/${selectedVoucher.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        toast.success("Voucher deleted successfully");
        setIsSheetOpen(false);
        fetchActiveVouchers(page);
      } else {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error || "Failed to delete voucher");
      }
    } catch {
      toast.error("Connection error");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col p-8 gap-8">
      <div className="flex flex-col">
        <h1 className="text-2xl font-bold">Claim Vouchers</h1>
        <p className="text-muted-foreground">
          Approve and process voucher claims for customers.
        </p>
      </div>

      {/* Requested Vouchers Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            Requested to Redeem
            {requestedVouchers.length > 0 && (
              <Badge variant="destructive" className="rounded-full px-2 py-0.5 text-[10px]">
                {requestedVouchers.length}
              </Badge>
            )}
          </h2>
          <Button variant="ghost" size="sm" onClick={fetchRequestedVouchers} disabled={isRequestedLoading}>
            {isRequestedLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
          </Button>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {requestedVouchers.length === 0 ? (
            <div className="col-span-full py-8 text-center border rounded-xl bg-muted/20 text-muted-foreground text-sm">
              No pending redemption requests.
            </div>
          ) : (
            requestedVouchers.map((voucher) => (
              <Card 
                key={voucher.id} 
                className="p-4 cursor-pointer hover:border-primary/50 transition-colors border-2 border-amber-100 bg-amber-50/30"
                onClick={() => handleRowClick(voucher)}
              >
                <div className="flex items-start gap-4">
                  {voucher.imageUrl ? (
                    <Image
                      src={voucher.imageUrl}
                      alt=""
                      width={48}
                      height={48}
                      className="w-12 h-12 rounded-lg object-cover border bg-white"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-zinc-200 flex items-center justify-center">
                      <Ticket className="w-6 h-6 text-zinc-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-mono font-bold text-sm truncate">{voucher.code}</p>
                    <p className="font-medium text-sm truncate">{voucher.customerName || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">{voucher.bindedToPhoneNumber}</p>
                  </div>
                  <Badge className="bg-amber-500 hover:bg-amber-600">Requested</Badge>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">All Active Vouchers</h2>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Code</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead className="text-right pr-6">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vouchers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center py-8 text-muted-foreground pl-6 pr-6"
                    >
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
                        <div className="flex items-center gap-2">
                          {voucher.imageUrl && (
                            <Image
                              src={voucher.imageUrl}
                              alt=""
                              width={32}
                              height={32}
                              className="w-8 h-8 rounded object-cover border"
                            />
                          )}
                          {voucher.code}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {voucher.customerName || "Unknown"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {voucher.bindedToPhoneNumber}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {formatDate(voucher.expiryDate)}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <Badge
                          variant="default"
                          className="bg-blue-500 hover:bg-blue-600"
                        >
                          Active
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {vouchers.length} of {total} active vouchers
            </p>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || isLoading}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <div className="text-sm font-medium">
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

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Claim Voucher</SheetTitle>
            <SheetDescription>
              Process the claim for voucher {selectedVoucher?.code}.
            </SheetDescription>
          </SheetHeader>

          <div className="grid gap-6 p-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase text-muted-foreground font-bold">
                Voucher Details
              </Label>
              <div className="rounded-lg border p-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Code:</span>
                  <span className="font-mono font-bold">
                    {selectedVoucher?.code}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant="default" className="bg-blue-500">
                    Active
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Expires:</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(selectedVoucher?.expiryDate)}
                  </span>
                </div>
                {selectedVoucher?.imageUrl && (
                  <div className="pt-2">
                    <Image
                      src={selectedVoucher.imageUrl}
                      alt="Voucher"
                      width={400}
                      height={128}
                      className="w-full h-32 rounded-md object-cover border"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase text-muted-foreground font-bold">
                Customer Information
              </Label>
              <div className="rounded-lg bg-muted/50 border p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-background flex items-center justify-center border">
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">
                    {selectedVoucher?.customerName || "Unknown Customer"}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" />{" "}
                    {selectedVoucher?.bindedToPhoneNumber}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4 text-sm text-yellow-800">
              <p className="font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Verification Required
              </p>
              <p className="mt-1">
                Please ensure the customer has presented the physical or digital
                voucher and their identity matches the information above.
              </p>
            </div>
          </div>

          <SheetFooter className="mt-6 flex flex-col gap-3">
            <Button
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              disabled={isClaiming}
              onClick={handleClaim}
            >
              {isClaiming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Approve & Claim Voucher
            </Button>
            <Button
              variant="destructive"
              className="w-full"
              disabled={isDeleting}
              onClick={handleDeleteVoucher}
            >
              {isDeleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete Voucher
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
