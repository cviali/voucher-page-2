"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useAuth } from "@/hooks/use-auth";
import { useDebounce } from "@/hooks/use-debounce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Search,
  User,
  Phone,
  ChevronLeft,
  ChevronRight,
  X,
  Trash2,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Voucher {
  id: number;
  code: string;
  status: string;
  createdAt: string;
  imageUrl: string | null;
}

interface UserResult {
  id: number;
  name: string;
  phoneNumber: string;
}

export default function BindPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;

  // Form state
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserResult | null>(null);
  const [expiryDate, setExpiryDate] = useState("");
  const [isBinding, setIsBinding] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchAvailableVouchers = async (currentPage: number) => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `/api/vouchers?status=available&page=${currentPage}&limit=${limit}`,
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
      fetchAvailableVouchers(page);
    }
  }, [user, page]);

  useEffect(() => {
    const searchUsers = async () => {
      if (debouncedSearch.length < 2) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(
          `/api/users/search?q=${encodeURIComponent(debouncedSearch)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (res.ok) {
          const data = (await res.json()) as UserResult[];
          setSearchResults(data);
        }
      } catch (err) {
        console.error("Search error", err);
      } finally {
        setIsSearching(false);
      }
    };
    searchUsers();
  }, [debouncedSearch]);

  if (authLoading) return null;
  if (!user || (user.role !== "cashier" && user.role !== "admin")) return null;

  const formatToApiDate = (date: string) => {
    if (!date || !date.includes("/")) return date;
    const [day, month, year] = date.split("/");
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  };

  const formatToDisplayDate = (date: string) => {
    if (!date || !date.includes("-")) return date;
    const [year, month, day] = date.split("-");
    return `${day}/${month}/${year}`;
  };

  const handleRowClick = (voucher: Voucher) => {
    setSelectedVoucher(voucher);
    setSelectedUser(null);
    setSearchQuery("");

    // Set default expiry date to 30 days from now
    const date = new Date();
    date.setDate(date.getDate() + 30);
    setExpiryDate(formatToDisplayDate(date.toISOString().split("T")[0]));

    setIsSheetOpen(true);
  };

  const handleBind = async () => {
    if (!selectedVoucher || !selectedUser) return;

    setIsBinding(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/vouchers/bind", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          code: selectedVoucher.code,
          phoneNumber: selectedUser.phoneNumber,
          expiryDate: formatToApiDate(expiryDate),
        }),
      });

      if (res.ok) {
        toast.success("Voucher successfully binded");
        setIsSheetOpen(false);
        fetchAvailableVouchers(page);
      } else {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error || "Failed to bind voucher");
      }
    } catch {
      toast.error("Connection error");
    } finally {
      setIsBinding(false);
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
        fetchAvailableVouchers(page);
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
        <h1 className="text-2xl font-bold">Bind Vouchers</h1>
        <p className="text-muted-foreground">
          Select an available voucher to assign it to a registered customer.
        </p>
      </div>

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
                  <TableHead>Created At</TableHead>
                  <TableHead className="text-right pr-6">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vouchers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No available vouchers found.
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
                        {formatDate(voucher.createdAt)}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <Badge variant="secondary">Available</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {vouchers.length} of {total} available vouchers
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

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Bind Voucher</SheetTitle>
            <SheetDescription>
              Assign voucher {selectedVoucher?.code} to a customer.
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
                  <span className="text-muted-foreground">Created:</span>
                  <span>
                    {formatDate(selectedVoucher?.createdAt)}
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

            <div className="space-y-4">
              <Label className="text-xs uppercase text-muted-foreground font-bold">
                Expiry Date
              </Label>
              <Input
                placeholder="DD/MM/YYYY"
                value={expiryDate}
                onChange={(e) => {
                  let val = e.target.value.replace(/\D/g, "");
                  if (val.length > 2 && val.length <= 4) {
                    val = val.slice(0, 2) + "/" + val.slice(2);
                  } else if (val.length > 4) {
                    val = val.slice(0, 2) + "/" + val.slice(2, 4) + "/" + val.slice(4, 8);
                  }
                  setExpiryDate(val);
                }}
                required
              />
            </div>

            <div className="space-y-4">
              <Label className="text-xs uppercase text-muted-foreground font-bold">
                Customer Search
              </Label>

              {selectedUser ? (
                <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{selectedUser.name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {selectedUser.phoneNumber}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedUser(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 relative">
                  <div className="relative flex gap-2">
                    <div className="flex items-center justify-center px-3 rounded-md border bg-muted text-muted-foreground text-sm font-medium">
                      +62
                    </div>
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by name or phone..."
                        className="pl-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>

                  {isSearching && (
                    <div className="absolute z-10 w-full bg-background border rounded-md shadow-lg p-4 flex justify-center">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  )}

                  {!isSearching && searchResults.length > 0 && (
                    <div className="absolute z-10 w-full bg-background border rounded-md shadow-lg overflow-hidden divide-y">
                      {searchResults.map((u) => (
                        <button
                          key={u.id}
                          className="w-full px-4 py-3 text-left hover:bg-muted transition-colors flex flex-col gap-0.5"
                          onClick={() => setSelectedUser(u)}
                        >
                          <span className="text-sm font-medium">{u.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {u.phoneNumber}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {!isSearching &&
                    searchQuery.length >= 2 &&
                    searchResults.length === 0 && (
                      <div className="absolute z-10 w-full bg-background border rounded-md shadow-lg p-4 text-center text-sm text-muted-foreground">
                        No customers found
                      </div>
                    )}
                </div>
              )}
            </div>
          </div>

          <SheetFooter className="mt-6 flex flex-col gap-3">
            <Button
              className="w-full"
              disabled={!selectedUser || isBinding}
              onClick={handleBind}
            >
              {isBinding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Binding
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
