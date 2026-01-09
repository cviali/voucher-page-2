"use client";

import { Badge } from "@/components/ui/badge";
import { VOUCHER_STATUS_COLORS, VoucherStatus } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface VoucherStatusBadgeProps {
  status: string;
  expiryDate?: string | Date | null;
  claimRequestedAt?: string | Date | null;
  className?: string;
}

export function VoucherStatusBadge({ status, expiryDate, claimRequestedAt, className }: VoucherStatusBadgeProps) {
  const isExpired = expiryDate && new Date(expiryDate) < new Date();
  const isRequested = !!claimRequestedAt;
  
  let statusKey: VoucherStatus = "available";
  let label = status?.toUpperCase() || "";

  if (status === "claimed") {
    statusKey = "claimed";
    label = "REDEEMED";
  } else if (isExpired) {
    statusKey = "expired";
    label = "EXPIRED";
  } else if (isRequested || status === "pending" || status === "requested") {
    statusKey = "pending";
    label = "PENDING";
  } else if (status === "active") {
    statusKey = "active";
    label = "ACTIVE";
  } else if (status === "available") {
    statusKey = "available";
    label = "AVAILABLE";
  }

  return (
    <Badge className={cn("font-bold tracking-wider px-2 py-0.5", VOUCHER_STATUS_COLORS[statusKey], className)}>
      {label}
    </Badge>
  );
}
