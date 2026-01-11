"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useAuth } from "@/hooks/use-auth";
import { useDebounce } from "@/hooks/use-debounce";
import { getApiUrl } from "@/lib/api-config";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Loader2,
  Search,
  User,
  Phone,
  ChevronLeft,
  ChevronRight,
  X,
  Trash2,
  MessageCircle,
  Users,
  Ticket,
  Link,
  Calendar,
} from "lucide-react";
import { formatDate, VOUCHER_STATUS_COLORS, getOptimizedImageUrl } from "@/lib/utils";

interface Voucher {
  id: string;
  code: string;
  name: string | null;
  status: string;
  createdAt: string;
  expiryDate: string | null;
  imageUrl: string | null;
  description?: string | null;
  bindedToPhoneNumber?: string;
  customerName?: string;
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
  const [activeTab, setActiveTab] = useState<"available" | "active" | "bulk">(
    "available"
  );

  // Bulk Bind state
  const [bulkPhoneNumbers, setBulkPhoneNumbers] = useState("");
  const [bulkVoucherName, setBulkVoucherName] = useState("");
  const [isBulkBinding, setIsBulkBinding] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(30);

  // Form state
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserResult | null>(null);
  const [expiryDate, setExpiryDate] = useState("");
  const [isBinding, setIsBinding] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchVouchers = useCallback(
    async (currentPage: number, status: string) => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(
          getApiUrl(`/vouchers?status=${status}&page=${currentPage}&limit=${limit}`),
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
    },
    [limit]
  );

  useEffect(() => {
    fetchVouchers(page, activeTab);
  }, [page, activeTab, fetchVouchers]);

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
          getApiUrl(`/users/search?q=${encodeURIComponent(debouncedSearch)}`),
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

  if (authLoading || !user) return null;

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
      const res = await fetch(getApiUrl("/vouchers/bind"), {
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
        fetchVouchers(page, activeTab);
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

  const handleBulkBind = async () => {
    if (!bulkVoucherName || !bulkPhoneNumbers) {
      toast.error("Please provide both voucher name and phone numbers");
      return;
    }

    const phoneNumbers = bulkPhoneNumbers
      .split(/[\n,]+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    if (phoneNumbers.length === 0) {
      toast.error("No valid phone numbers found");
      return;
    }

    setIsBulkBinding(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(getApiUrl("/vouchers/bulk-bind"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          voucherName: bulkVoucherName,
          phoneNumbers,
          expiryDate: formatToApiDate(expiryDate),
        }),
      });

      if (res.ok) {
        const result = (await res.json()) as { count: number };
        toast.success(`Successfully binded ${result.count} vouchers`);
        setBulkPhoneNumbers("");
        setBulkVoucherName("");
        setActiveTab("active");
      } else {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error || "Failed to bulk bind vouchers");
      }
    } catch {
      toast.error("Connection error");
    } finally {
      setIsBulkBinding(false);
    }
  };

  const handleDeleteVoucher = async () => {
    if (!selectedVoucher) return;
    if (!confirm("Are you sure you want to delete this voucher?")) return;

    setIsDeleting(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(getApiUrl(`/vouchers/${selectedVoucher.id}`), {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        toast.success("Voucher deleted successfully");
        setIsSheetOpen(false);
        fetchVouchers(page, activeTab);
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

  const handleWhatsAppShare = (voucher: Voucher) => {
    if (!voucher.bindedToPhoneNumber) return;

    const phoneNumber = voucher.bindedToPhoneNumber.replace(/\+/g, "");
    const baseUrl = window.location.origin;
    const message = `Hi ${voucher.customerName || "Customer"
      }, here is your voucher link: ${baseUrl}/customer/vouchers/${voucher.id}`;
    const encodedMessage = encodeURIComponent(message);

    window.open(
      `https://wa.me/${phoneNumber}?text=${encodedMessage}`,
      "_blank"
    );
  };

  return (
    <div className="flex flex-1 flex-col p-8 gap-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold">Bind Vouchers</h1>
          <p className="text-muted-foreground">
            Manage and assign vouchers to registered customers.
          </p>
        </div>
      </div>

      <Tabs
        defaultValue="available"
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v as "available" | "active" | "bulk");
          setPage(1);
        }}
        className="w-full"
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="available">Available</TabsTrigger>
            <TabsTrigger value="active">Binded</TabsTrigger>
            <TabsTrigger value="bulk">Bulk Bind</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="bulk" className="mt-0">
          <div className="max-w-2xl mx-auto space-y-6 bg-card p-6 rounded-xl border shadow-sm">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold flex items-center gap-4">
                <Users className="h-5 w-5 text-primary" />
                Bulk Assign Vouchers
              </h2>
              <p className="text-sm text-muted-foreground">
                Assign multiple vouchers of the same type to a list of
                customers.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="voucher-name"
                  className="text-xs uppercase font-bold text-muted-foreground px-1"
                >
                  Voucher Name (Batch Name)
                </Label>
                <Input
                  id="voucher-name"
                  placeholder="e.g. Welcome Discount 2024"
                  value={bulkVoucherName}
                  onChange={(e) => setBulkVoucherName(e.target.value)}
                  className="bg-background"
                />
                <p className="text-[10px] text-muted-foreground italic">
                  * Must match the name used when creating the batch.
                </p>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="phone-numbers"
                  className="text-xs uppercase font-bold text-muted-foreground px-1"
                >
                  Phone Numbers
                </Label>
                <Textarea
                  id="phone-numbers"
                  placeholder="Enter phone numbers separated by commas or new lines..."
                  className="min-h-[200px] font-mono text-sm bg-background"
                  value={bulkPhoneNumbers}
                  onChange={(e) => setBulkPhoneNumbers(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">
                  Example: +60123456789, +60198765432 or one per line.
                </p>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="bulk-expiry"
                  className="text-xs uppercase font-bold text-muted-foreground px-1"
                >
                  Expiry Date
                </Label>
                <Input
                  id="bulk-expiry"
                  placeholder="DD/MM/YYYY"
                  value={expiryDate}
                  onChange={(e) => {
                    let val = e.target.value.replace(/\D/g, "");
                    if (val.length > 2 && val.length <= 4) {
                      val = val.slice(0, 2) + "/" + val.slice(2);
                    } else if (val.length > 4) {
                      val =
                        val.slice(0, 2) +
                        "/" +
                        val.slice(2, 4) +
                        "/" +
                        val.slice(4, 8);
                    }
                    setExpiryDate(val);
                  }}
                  className="bg-background"
                />
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={handleBulkBind}
                disabled={
                  isBulkBinding || !bulkVoucherName || !bulkPhoneNumbers
                }
              >
                {isBulkBinding ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Binding Vouchers...
                  </>
                ) : (
                  <>
                    <Ticket className="mr-2 h-5 w-5" />
                    Assign Vouchers to Customers
                  </>
                )}
              </Button>
            </div>
          </div>
        </TabsContent>

        {(activeTab === "available" || activeTab === "active") && (
          <div className="space-y-6">
            <div className="md:hidden space-y-4">
              {isLoading ? (
                <div className="flex flex-col gap-4">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-24 w-full bg-muted animate-pulse rounded-lg"
                    />
                  ))}
                </div>
              ) : vouchers.length === 0 ? (
                <div className="text-center py-12 bg-muted/20 rounded-lg border border-dashed">
                  <p className="text-sm text-muted-foreground">
                    No {activeTab} vouchers found.
                  </p>
                </div>
              ) : (
                <Accordion
                  type="single"
                  collapsible
                  className="w-full space-y-3"
                >
                  {vouchers.map((voucher) => (
                    <AccordionItem
                      key={voucher.id}
                      value={voucher.id.toString()}
                      className="border rounded-lg px-4 bg-card shadow-sm"
                    >
                      <AccordionTrigger className="hover:no-underline py-4">
                        <div className="flex items-center gap-3 text-left">
                          <div className="relative h-12 w-12 rounded-md overflow-hidden border bg-muted shrink-0 shadow-sm">
                            {voucher.imageUrl ? (
                              <Image
                                src={getOptimizedImageUrl(voucher.imageUrl)}
                                alt=""
                                fill
                                className="object-cover"
                              />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center">
                                <Ticket className="h-6 w-6 text-muted-foreground/40" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-mono font-bold text-[13px] truncate uppercase tracking-wider text-foreground">
                              {voucher.code}
                            </p>
                            <p className="font-medium text-[11px] truncate leading-tight mt-0.5 text-muted-foreground">
                              {voucher.name || "Unnamed Voucher"}
                            </p>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-4 space-y-4 border-t pt-4">
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          {activeTab === "available" ? (
                            <div className="space-y-1">
                              <p className="text-muted-foreground uppercase font-bold text-[10px]">
                                Created At
                              </p>
                              <p className="font-medium flex items-center gap-1.5 px-0.5">
                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                {formatDate(voucher.createdAt)}
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <p className="text-muted-foreground uppercase font-bold text-[10px]">
                                Customer
                              </p>
                              <p className="font-medium truncate">
                                {voucher.customerName || "Unknown"}
                              </p>
                              <p className="text-muted-foreground font-mono text-[10px]">
                                {voucher.bindedToPhoneNumber}
                              </p>
                            </div>
                          )}
                          <div className="space-y-1">
                            <p className="text-muted-foreground uppercase font-bold text-[10px]">
                              Status
                            </p>
                            <div>
                              {activeTab === "available" ? (
                                <Badge className={VOUCHER_STATUS_COLORS.available}>
                                  AVAILABLE
                                </Badge>
                              ) : (
                                <Badge className={VOUCHER_STATUS_COLORS.active}>
                                  Active
                                </Badge>
                              )}
                            </div>
                          </div>
                          {activeTab === "active" && (
                            <div className="space-y-1 col-span-2 pt-2 border-t border-dashed text-muted-foreground">
                              <p className="text-muted-foreground uppercase font-bold text-[10px]">
                                Expires On
                              </p>
                              <p className="font-medium flex items-center gap-1.5">
                                <Calendar className="h-3 w-3" />
                                {formatDate(voucher.expiryDate)}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 pt-2 border-t mt-2">
                          {activeTab === "available" ? (
                            <Button
                              className="w-full h-9 gap-2 shadow-sm text-[11px] font-bold uppercase tracking-wider"
                              onClick={() => handleRowClick(voucher)}
                            >
                              <Link className="h-4 w-4" />
                              Bind Voucher
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              className="w-full h-9 gap-2 shadow-sm text-[11px] font-bold uppercase tracking-wider"
                              onClick={() => handleWhatsAppShare(voucher)}
                            >
                              <MessageCircle className="h-4 w-4" />
                              Share on WhatsApp
                            </Button>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </div>

            <div className="hidden md:block rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Voucher</TableHead>
                    <TableHead>
                      {activeTab === "available" ? "Created At" : "Customer"}
                    </TableHead>
                    {activeTab === "active" && (
                      <TableHead className="text-center">Expiry Date</TableHead>
                    )}
                    <TableHead className="text-right pr-6">
                      {activeTab === "available" ? "Status" : "Action"}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    [1, 2, 3, 4, 5].map((i) => (
                      <TableRow key={i}>
                        <TableCell className="pl-6">
                          <div className="h-12 w-48 bg-muted animate-pulse rounded" />
                        </TableCell>
                        <TableCell>
                          <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                        </TableCell>
                        {activeTab === "active" && (
                          <TableCell>
                            <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                          </TableCell>
                        )}
                        <TableCell className="pr-6">
                          <div className="h-8 w-24 bg-muted animate-pulse rounded ml-auto" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : vouchers.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={activeTab === "active" ? 4 : 3}
                        className="h-32 text-center text-muted-foreground"
                      >
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Ticket className="h-8 w-8 text-muted-foreground/30" />
                          <p>No {activeTab} vouchers found.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    vouchers.map((voucher) => (
                      <TableRow
                        key={voucher.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() =>
                          activeTab === "available" && handleRowClick(voucher)
                        }
                      >
                        <TableCell className="font-mono font-medium pl-6">
                          <div className="flex items-center gap-3">
                            <div className="relative h-10 w-10 rounded-md overflow-hidden border bg-muted shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                              {voucher.imageUrl ? (
                                <Image
                                  src={getOptimizedImageUrl(voucher.imageUrl)}
                                  alt=""
                                  fill
                                  className="object-cover"
                                />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center bg-zinc-100">
                                  <Ticket className="h-5 w-5 text-zinc-400" />
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm font-bold uppercase tracking-wider text-foreground">{voucher.code}</span>
                              <span className="text-[10px] text-muted-foreground leading-tight">{voucher.name || "Unnamed Voucher"}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {activeTab === "available" ? (
                            <div>
                              {formatDate(voucher.createdAt)}
                            </div>
                          ) : (
                            <div className="flex flex-col">
                              <span className="font-medium text-sm">
                                {voucher.customerName || "Unknown Customer"}
                              </span>
                              <span className="text-xs">
                                {voucher.bindedToPhoneNumber}
                              </span>
                            </div>
                          )}
                        </TableCell>
                        {activeTab === "active" && (
                          <TableCell className="text-center">
                            {formatDate(voucher.expiryDate)}
                          </TableCell>
                        )}
                        <TableCell className="text-right pr-6">
                          {activeTab === "available" ? (
                            <Badge className={VOUCHER_STATUS_COLORS.available}>Available</Badge>
                          ) : (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 gap-2 shadow-sm px-3 font-bold"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleWhatsAppShare(voucher);
                                    }}
                                  >
                                    <MessageCircle className="h-3.5 w-3.5" />
                                    Share
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Share link via WhatsApp</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-4 order-2 sm:order-1">
                <p className="text-sm text-muted-foreground">
                  Showing {vouchers.length} of {total} vouchers
                </p>
              </div>
              <div className="flex items-center space-x-2 order-1 sm:order-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    Rows per page
                  </span>
                  <Select
                    value={limit.toString()}
                    onValueChange={(v) => {
                      setLimit(parseInt(v));
                      setPage(1);
                    }}
                  >
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
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1 || isLoading}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="text-sm font-medium min-w-[80px] text-center">
                    Page {page} of {totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || isLoading}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Tabs>

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
                  <span>{formatDate(selectedVoucher?.createdAt)}</span>
                </div>
                {selectedVoucher?.imageUrl && (
                  <div className="pt-2">
                    <Image
                      src={getOptimizedImageUrl(selectedVoucher.imageUrl)}
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
                    val =
                      val.slice(0, 2) +
                      "/" +
                      val.slice(2, 4) +
                      "/" +
                      val.slice(4, 8);
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
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{u.name}</span>
                            <span className="text-sm font-medium">Customer ID: {u.id}</span>
                          </div>
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
