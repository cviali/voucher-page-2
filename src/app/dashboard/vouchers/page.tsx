"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useAuth } from "@/hooks/use-auth";
import { getOptimizedImageUrl } from "@/lib/utils";
import { getApiUrl } from "@/lib/api-config";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Calendar,
  User,
  Phone,
  Upload,
  Image as ImageIcon,
  BookMarked,
  Search,
  ListFilter
} from "lucide-react";
import { formatDate, resizeImage } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { VoucherStatusBadge } from "@/components/voucher-status-badge";

interface Voucher {
  id: string;
  code: string;
  name: string | null;
  status: "available" | "active" | "claimed";
  bindedToPhoneNumber: string | null;
  createdAt: string;
  expiryDate: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  usedAt: string | null;
  imageUrl: string | null;
  description: string | null;
  claimRequestedAt: string | null;
  customerName?: string;
  customerId?: number;
}

interface Template {
  id: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
}

export default function VouchersPage() {
  const { user, logout, isLoading: authLoading } = useAuth();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isBatchSheetOpen, setIsBatchSheetOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [batchForm, setBatchForm] = useState({
    count: 10,
    name: "",
    imageUrl: "",
    description: ""
  });
  const [batchImageFile, setBatchImageFile] = useState<File | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(30);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchPhone, setSearchPhone] = useState("");
  const [debouncedSearchPhone, setDebouncedSearchPhone] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1); // Reset to first page on search
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchPhone(searchPhone);
      setPage(1); // Reset to first page on search
    }, 500);
    return () => clearTimeout(timer);
  }, [searchPhone]);

  const fetchVouchers = useCallback(async (currentPage: number) => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const statusParam = statusFilter !== "all" ? `&status=${statusFilter}` : "";
      const searchParam = debouncedSearch ? `&search=${debouncedSearch}` : "";
      const phoneParam = debouncedSearchPhone ? `&phoneNumber=${debouncedSearchPhone}` : "";
      const res = await fetch(
        getApiUrl(`/vouchers?page=${currentPage}&limit=${limit}${statusParam}${searchParam}${phoneParam}`),
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (res.status === 401) {
        logout();
        return;
      }
      if (res.ok) {
        const result = (await res.json()) as {
          data: Voucher[];
          pagination: {
            totalPages: number;
            total: number;
          };
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
  }, [logout, statusFilter, debouncedSearch, debouncedSearchPhone, limit]);

  const fetchTemplates = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(getApiUrl("/templates"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setTemplates(await res.json());
      }
    } catch {
      console.error("Failed to fetch templates");
    }
  }, []);

  useEffect(() => {
    fetchVouchers(page);
  }, [page, fetchVouchers]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  if (authLoading || !user) return null;

  const handleBatchCreate = async () => {
    if (!batchForm.name) {
      toast.error("Voucher name is required");
      return;
    }
    setIsGenerating(true);
    try {
      const token = localStorage.getItem("token");
      let currentImageUrl = batchForm.imageUrl;

      // Handle file upload if present
      if (batchImageFile) {
        const resizedBlob = await resizeImage(batchImageFile, 1200, 1200);
        const resizedFile = new File([resizedBlob], "batch-image.jpg", { type: 'image/jpeg' });

        const formData = new FormData();
        formData.append("file", resizedFile);

        const uploadRes = await fetch(getApiUrl("/vouchers/upload"), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        if (uploadRes.ok) {
          const { url } = (await uploadRes.json()) as { url: string };
          currentImageUrl = url;
        } else {
          toast.error("Failed to upload image. Rolling back...");
          setIsGenerating(false);
          return;
        }
      }

      // If user checked "Save as Template", do it now
      if (saveAsTemplate) {
        await fetch(getApiUrl("/templates"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: batchForm.name,
            description: batchForm.description,
            imageUrl: currentImageUrl,
          }),
        });
        fetchTemplates();
      }

      const res = await fetch(getApiUrl("/vouchers/batch"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...batchForm,
          imageUrl: currentImageUrl
        }),
      });
      if (res.ok) {
        toast.success(`Successfully created ${batchForm.count} vouchers`);
        setIsBatchSheetOpen(false);
        setBatchImageFile(null);
        setSaveAsTemplate(false);
        setBatchForm({ count: 10, name: "", imageUrl: "", description: "" });
        fetchVouchers(page);
      } else {
        toast.error("Failed to generate vouchers");
      }
    } catch (err) {
      console.error(err);
      toast.error("Connection error during batch creation");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRowClick = (voucher: Voucher) => {
    setSelectedVoucher(voucher);
    setIsSheetOpen(true);
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
        fetchVouchers(page);
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

  const handleUpdateVoucher = async (updates: Partial<Voucher>) => {
    if (!selectedVoucher) return;
    setIsUpdating(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(getApiUrl(`/vouchers/${selectedVoucher.id}`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        const updated = (await res.json()) as Voucher;
        setVouchers(vouchers.map((v) => (v.id === updated.id ? updated : v)));
        setSelectedVoucher(updated);
        toast.success("Voucher updated");
      } else {
        toast.error("Failed to update voucher");
      }
    } catch {
      toast.error("Error updating voucher");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedVoucher) return;

    setIsUploading(true);
    try {
      // Frontend Resize
      const resizedBlob = await resizeImage(file, 1200, 1200);
      const resizedFile = new File([resizedBlob], file.name, { type: 'image/jpeg' });

      const formData = new FormData();
      formData.append("file", resizedFile);

      const token = localStorage.getItem("token");
      const res = await fetch(getApiUrl("/vouchers/upload"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (res.ok) {
        const { url } = (await res.json()) as { url: string };
        await handleUpdateVoucher({ imageUrl: url });
      } else {
        toast.error("Failed to upload image");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error resizing or uploading image");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col p-8 gap-8">
      <div>
        <h1 className="text-2xl font-bold">Vouchers</h1>
        <p className="text-muted-foreground">
          Manage and monitor all voucher codes in the system.
        </p>
      </div>

      <div className="flex flex-col gap-y-3">
        {/* Filters & Actions Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
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
                        <Label htmlFor="search-mobile" className="text-xs font-bold uppercase text-muted-foreground">Search Code/Name</Label>
                        <div className="relative">
                          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="search-mobile"
                            placeholder="Code or name..."
                            className="pl-8 bg-background"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="search-phone-mobile" className="text-xs font-bold uppercase text-muted-foreground">Search Phone</Label>
                        <div className="relative">
                          <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="search-phone-mobile"
                            placeholder="Phone number..."
                            className="pl-8 bg-background"
                            value={searchPhone}
                            onChange={(e) => setSearchPhone(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label className="text-xs font-bold uppercase text-muted-foreground">Status</Label>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                          <SelectTrigger className="w-full bg-background">
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">ALL STATUS</SelectItem>
                            <SelectItem value="available">AVAILABLE</SelectItem>
                            <SelectItem value="active">ACTIVE</SelectItem>
                            <SelectItem value="claimed">REDEEMED</SelectItem>
                            <SelectItem value="expired">EXPIRED</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            {/* Desktop/Tablet Filters */}
            <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="search-desktop" className="text-[10px] font-bold uppercase text-muted-foreground px-1">Search Code/Name</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search-desktop"
                    placeholder="Code or name..."
                    className="pl-8 bg-background"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="search-phone-desktop" className="text-[10px] font-bold uppercase text-muted-foreground px-1">Search Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search-phone-desktop"
                    placeholder="Phone number..."
                    className="pl-8 bg-background"
                    value={searchPhone}
                    onChange={(e) => setSearchPhone(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground px-1">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full bg-background">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ALL STATUS</SelectItem>
                    <SelectItem value="available">AVAILABLE</SelectItem>
                    <SelectItem value="active">ACTIVE</SelectItem>
                    <SelectItem value="claimed">REDEEMED</SelectItem>
                    <SelectItem value="expired">EXPIRED</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              className="w-full md:w-auto"
              onClick={() => setIsBatchSheetOpen(true)}
              disabled={isGenerating}
            >
              <Plus className="h-4 w-4" />
              Create Vouchers
            </Button>
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
                    <TableHead>Created At</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead>Approved By</TableHead>
                    <TableHead>Approved At</TableHead>
                    <TableHead className="pr-6">Used At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vouchers.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center py-8 text-muted-foreground pl-6 pr-6"
                      >
                        No vouchers found matching your criteria.
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
                            {voucher.imageUrl && (
                              <Image
                                src={getOptimizedImageUrl(voucher.imageUrl, 80)}
                                alt="Voucher"
                                width={40}
                                height={40}
                                className="w-10 h-10 rounded-md object-cover border shadow-sm"
                              />
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
                          {voucher.bindedToPhoneNumber || "-"}
                        </TableCell>
                        <TableCell>
                          {formatDate(voucher.createdAt)}
                        </TableCell>
                        <TableCell>
                          {formatDate(voucher.expiryDate)}
                        </TableCell>
                        <TableCell>{voucher.approvedBy || "-"}</TableCell>
                        <TableCell>
                          {formatDate(voucher.approvedAt)}
                        </TableCell>
                        <TableCell className="pr-6">
                          {formatDate(voucher.usedAt)}
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
                  Showing {vouchers.length} of {total} vouchers
                </p>
              </div>
              <div className="flex items-center space-x-2 order-1 sm:order-2">
                <div className="flex items-center gap-2">
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
            <SheetTitle>Voucher Details</SheetTitle>
            <SheetDescription>
              Detailed information for voucher {selectedVoucher?.code}.
            </SheetDescription>
          </SheetHeader>

          <div className="grid gap-6 p-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase text-muted-foreground font-bold">
                Voucher Name
              </Label>
              <Input
                placeholder="Enter voucher name..."
                defaultValue={selectedVoucher?.name || ""}
                onBlur={(e) => {
                  if (e.target.value !== selectedVoucher?.name) {
                    handleUpdateVoucher({ name: e.target.value });
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase text-muted-foreground font-bold">
                Voucher Image
              </Label>
              <div className="relative group">
                {selectedVoucher?.imageUrl ? (
                  <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-muted">
                    <Image
                      src={getOptimizedImageUrl(selectedVoucher.imageUrl)}
                      alt="Voucher"
                      fill
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Label htmlFor="image-upload" className="cursor-pointer bg-white/20 hover:bg-white/30 p-2 rounded-full backdrop-blur-sm transition-colors">
                        <Upload className="h-5 w-5 text-white" />
                      </Label>
                    </div>
                  </div>
                ) : (
                  <Label htmlFor="image-upload" className="flex flex-col items-center justify-center aspect-video w-full rounded-lg border border-dashed bg-muted/50 hover:bg-muted transition-colors cursor-pointer">
                    {isUploading ? (
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    ) : (
                      <>
                        <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                        <span className="text-sm text-muted-foreground">Upload Image</span>
                      </>
                    )}
                  </Label>
                )}
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                  disabled={isUploading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase text-muted-foreground font-bold">
                Description
              </Label>
              <Textarea
                placeholder="Enter voucher description..."
                className="min-h-[150px] resize-none"
                defaultValue={selectedVoucher?.description || ""}
                onBlur={(e) => {
                  if (e.target.value !== selectedVoucher?.description) {
                    handleUpdateVoucher({ description: e.target.value });
                  }
                }}
              />
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground italic">
                  Changes are saved automatically when you click away.
                </p>
                {isUpdating && (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase text-muted-foreground font-bold">
                Voucher Info
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
                  {selectedVoucher && (
                    <VoucherStatusBadge
                      status={selectedVoucher.status}
                      expiryDate={selectedVoucher.expiryDate}
                      claimRequestedAt={selectedVoucher.claimRequestedAt}
                    />
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created:</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(selectedVoucher?.createdAt)}
                  </span>
                </div>
                {selectedVoucher?.expiryDate && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Expires:</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(selectedVoucher.expiryDate)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {selectedVoucher?.bindedToPhoneNumber && (
              <div className="space-y-2">
                <Label className="text-xs uppercase text-muted-foreground font-bold">
                  Customer Info
                </Label>
                <div className="rounded-lg border p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold">
                        {selectedVoucher.customerName || "Customer"}
                      </p>
                      {selectedVoucher.customerId && (
                        <span className="text-[10px] font-mono font-bold text-muted-foreground bg-muted px-1.5 rounded">
                          #{selectedVoucher.customerId}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Phone className="h-3 w-3" />
                      {selectedVoucher.bindedToPhoneNumber}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {selectedVoucher?.approvedBy && (
              <div className="space-y-2">
                <Label className="text-xs uppercase text-muted-foreground font-bold">
                  Approval Info
                </Label>
                <div className="rounded-lg border p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Approved By:</span>
                    <span>{selectedVoucher.approvedBy}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Approved At:</span>
                    <span>{formatDate(selectedVoucher.approvedAt)}</span>
                  </div>
                </div>
              </div>
            )}

            {selectedVoucher?.usedAt && (
              <div className="space-y-2">
                <Label className="text-xs uppercase text-muted-foreground font-bold">
                  Usage Info
                </Label>
                <div className="rounded-lg border p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Used At:</span>
                    <span>{formatDate(selectedVoucher.usedAt)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <SheetFooter className="mt-6">
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

      <Sheet open={isBatchSheetOpen} onOpenChange={setIsBatchSheetOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Batch Create Vouchers</SheetTitle>
            <SheetDescription>
              Create multiple vouchers with the same details.
            </SheetDescription>
          </SheetHeader>

          <div className="grid gap-6 p-4">
            {templates.length > 0 && (
              <div className="space-y-2">
                <Label>Load from Template</Label>
                <Select onValueChange={(value) => {
                  const template = templates.find(t => t.id.toString() === value);
                  if (template) {
                    setBatchForm({
                      ...batchForm,
                      name: template.name,
                      description: template.description || "",
                      imageUrl: template.imageUrl || ""
                    });
                    setBatchImageFile(null);
                  }
                }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id.toString()}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="batch-count">Number of Vouchers</Label>
              <Input
                id="batch-count"
                type="number"
                value={batchForm.count}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setBatchForm({ ...batchForm, count: isNaN(val) ? 0 : val });
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="batch-name">Voucher Name</Label>
              <Input
                id="batch-name"
                placeholder="e.g. Welcome Discount"
                value={batchForm.name}
                onChange={(e) => setBatchForm({ ...batchForm, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="batch-image">Voucher Image</Label>
              <div
                className="relative aspect-video w-full rounded-lg border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors overflow-hidden group"
                onClick={() => document.getElementById('batch-image-upload')?.click()}
              >
                {batchImageFile || batchForm.imageUrl ? (
                  <>
                    <Image
                      src={batchImageFile ? URL.createObjectURL(batchImageFile) : getOptimizedImageUrl(batchForm.imageUrl)}
                      alt="Preview"
                      fill
                      className="object-cover transition-opacity group-hover:opacity-40"
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Upload className="h-8 w-8 text-primary" />
                    </div>
                  </>
                ) : (
                  <>
                    <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-xs text-muted-foreground font-medium">Click to upload image</p>
                    <p className="text-[10px] text-muted-foreground mt-1 text-center px-4">
                      Image will be used for all {batchForm.count} vouchers
                    </p>
                  </>
                )}
                <input
                  id="batch-image-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setBatchImageFile(file);
                    if (file) setBatchForm(prev => ({ ...prev, imageUrl: "" }));
                  }}
                />
              </div>
              {(batchImageFile || batchForm.imageUrl) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-[10px] h-6 mt-1 text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    setBatchImageFile(null);
                    setBatchForm({ ...batchForm, imageUrl: "" });
                  }}
                >
                  Remove Image
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="batch-description">Description / Terms</Label>
              <Textarea
                id="batch-description"
                placeholder="Enter terms and conditions (one per line)"
                className="min-h-[150px]"
                value={batchForm.description}
                onChange={(e) => setBatchForm({ ...batchForm, description: e.target.value })}
              />
            </div>

            <div className="flex items-center space-x-2 pt-2 border-t">
              <Checkbox
                id="save-template"
                checked={saveAsTemplate}
                onCheckedChange={(checked) => setSaveAsTemplate(!!checked)}
              />
              <label
                htmlFor="save-template"
                className="text-xs font-medium leading-none cursor-pointer flex items-center gap-1.5"
              >
                <BookMarked className="h-3.5 w-3.5 text-primary" />
                Save these details as a template
              </label>
            </div>
          </div>

          <SheetFooter className="mt-6">
            <Button
              className="w-full"
              disabled={isGenerating}
              onClick={handleBatchCreate}
            >
              {isGenerating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Create {batchForm.count} Vouchers
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
