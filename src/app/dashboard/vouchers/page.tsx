"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";
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
  Image as ImageIcon
} from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Voucher {
  id: number;
  code: string;
  status: "available" | "active" | "claimed";
  bindedToPhoneNumber: string | null;
  createdAt: string;
  expiryDate: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  usedAt: string | null;
  imageUrl: string | null;
  description: string | null;
}

export default function VouchersPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;

  const fetchVouchers = async (currentPage: number) => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `/api/vouchers?page=${currentPage}&limit=${limit}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
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
  };

  useEffect(() => {
    if (user && (user.role === "admin" || user.role === "cashier")) {
      fetchVouchers(page);
    }
  }, [user, page]);

  if (authLoading) return null;
  if (!user || (user.role !== "admin" && user.role !== "cashier")) return null;

  const generateVoucher = async () => {
    setIsGenerating(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/vouchers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          imageUrl:
            "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&auto=format&fit=crop&q=60",
        }),
      });

      if (res.ok) {
        toast.success("Voucher generated successfully");
        if (page === 1) {
          fetchVouchers(1);
        } else {
          setPage(1);
        }
      } else {
        toast.error("Failed to generate voucher");
      }
    } catch {
      toast.error("Connection error");
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
      const res = await fetch(`/api/vouchers/${selectedVoucher.id}`, {
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
      const res = await fetch(`/api/vouchers/${selectedVoucher.id}`, {
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
    const formData = new FormData();
    formData.append("file", file);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/vouchers/upload", {
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
    } catch {
      toast.error("Error uploading image");
    } finally {
      setIsUploading(false);
    }
  };

  const getStatusBadge = (status: Voucher["status"]) => {
    switch (status) {
      case "available":
        return <Badge variant="secondary">Available</Badge>;
      case "active":
        return (
          <Badge variant="default" className="bg-blue-500 hover:bg-blue-600">
            Active
          </Badge>
        );
      case "claimed":
        return (
          <Badge variant="outline" className="text-green-600 border-green-600">
            Claimed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="flex flex-1 flex-col p-8 gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Vouchers</h1>
          <p className="text-muted-foreground">
            Manage and monitor all voucher codes in the system.
          </p>
        </div>
        <Button onClick={generateVoucher} disabled={isGenerating}>
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Generate Voucher
        </Button>
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
                      No vouchers found.
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
                              alt="Voucher" 
                              width={32}
                              height={32}
                              className="w-8 h-8 rounded object-cover border"
                            />
                          )}
                          {voucher.code}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(voucher.status)}</TableCell>
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
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {vouchers.length} of {total} vouchers
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
            <SheetTitle>Voucher Details</SheetTitle>
            <SheetDescription>
              Detailed information for voucher {selectedVoucher?.code}.
            </SheetDescription>
          </SheetHeader>

          <div className="grid gap-6 p-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase text-muted-foreground font-bold">
                Voucher Image
              </Label>
              <div className="relative group">
                {selectedVoucher?.imageUrl ? (
                  <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-muted">
                    <Image
                      src={selectedVoucher.imageUrl}
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
                className="min-h-[100px] resize-none"
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
                  {selectedVoucher && getStatusBadge(selectedVoucher.status)}
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
                    <p className="text-sm font-medium">
                      {selectedVoucher.bindedToPhoneNumber}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" /> Customer
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
    </div>
  );
}
