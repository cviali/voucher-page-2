"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { getApiUrl } from "@/lib/api-config";
import { getOptimizedImageUrl } from "@/lib/utils";
import {
  Loader2,
  User,
  Phone,
  Calendar,
  CheckCircle2,
  Trash2,
  Banknote,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Voucher {
  id: string;
  code: string;
  name: string | null;
  status: string;
  expiryDate?: string | null;
  imageUrl?: string | null;
  customerName?: string | null;
  bindedToPhoneNumber?: string | null;
}

interface VoucherClaimDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  voucher: Voucher | null;
  onSuccess?: () => void;
}

export function VoucherClaimDrawer({
  isOpen,
  onOpenChange,
  voucher,
  onSuccess,
}: VoucherClaimDrawerProps) {
  const [spentAmount, setSpentAmount] = useState("");
  const [isClaiming, setIsClaiming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleClaim = async () => {
    if (!voucher) return;
    if (!spentAmount || isNaN(Number(spentAmount))) {
      toast.error("Please enter a valid amount spent");
      return;
    }

    setIsClaiming(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(getApiUrl("/vouchers/claim"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          code: voucher.code,
          spentAmount: Number(spentAmount),
        }),
      });

      if (res.ok) {
        toast.success("Voucher successfully claimed");
        onOpenChange(false);
        setSpentAmount("");
        if (onSuccess) onSuccess();
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
    if (!voucher) return;
    if (!confirm("Are you sure you want to delete this voucher?")) return;

    setIsDeleting(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(getApiUrl(`/vouchers/${voucher.id}`), {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        toast.success("Voucher deleted successfully");
        onOpenChange(false);
        if (onSuccess) onSuccess();
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
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Claim Voucher</SheetTitle>
          <SheetDescription>
            Process the claim for voucher {voucher?.code}.
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-6 p-4">
          <div className="space-y-2">
            <Label className="text-xs uppercase text-muted-foreground font-bold px-1">
              Voucher Details
            </Label>
            <div className="rounded-xl border p-4 space-y-3 text-sm bg-muted/30">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-medium">Code:</span>
                <span className="font-bold">{voucher?.code}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-medium">Name:</span>
                <span className="font-semibold">{voucher?.name || "Unnamed"}</span>
              </div>
              {voucher?.expiryDate && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Expires:</span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    {formatDate(voucher.expiryDate)}
                  </span>
                </div>
              )}
              {voucher?.imageUrl && (
                <div className="pt-2">
                  <div className="relative aspect-video w-full rounded-lg overflow-hidden border bg-background shadow-xs">
                    <Image
                      src={getOptimizedImageUrl(voucher.imageUrl)}
                      alt="Voucher"
                      fill
                      className="object-cover"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase text-muted-foreground font-bold px-1">
              Customer Information
            </Label>
            <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-background flex items-center justify-center border-2 border-primary/20 shadow-xs">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-base truncate leading-tight">
                  {voucher?.customerName || "Unknown Customer"}
                </p>
                <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                  <Phone className="h-3.5 w-3.5" />
                  {voucher?.bindedToPhoneNumber}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <Label
              htmlFor="spent-amount"
              className="text-sm font-bold flex items-center gap-2 px-1"
            >
              <Banknote className="h-4 w-4 text-emerald-600 dark:text-emerald-500" />
              Transaction Amount Spent
            </Label>
            <div className="relative group">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold group-focus-within:text-primary transition-colors">
                Rp
              </span>
              <Input
                id="spent-amount"
                type="number"
                placeholder="0"
                className="pl-11 h-12 text-lg font-bold border-2 focus-visible:ring-offset-0 bg-background"
                value={spentAmount}
                onChange={(e) => setSpentAmount(e.target.value)}
                autoFocus
              />
            </div>
          </div>
        </div>

        <SheetFooter className="mt-8 flex flex-col gap-3 px-4 pb-4">
          <Button
            className="w-full font-bold bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600/80 dark:hover:bg-emerald-600 text-white"
            disabled={isClaiming || !spentAmount}
            onClick={handleClaim}
          >
            {isClaiming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Claim Voucher
          </Button>
          <Button
            variant="destructive"
            className="w-full font-bold opacity-80 hover:opacity-100 dark:bg-destructive/40 dark:hover:bg-destructive/60"
            disabled={isDeleting || isClaiming}
            onClick={handleDeleteVoucher}
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Void Voucher
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
