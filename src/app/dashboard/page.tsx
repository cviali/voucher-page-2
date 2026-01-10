"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { DashboardStats } from "@/components/dashboard-stats";
import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Ticket } from "lucide-react";
import Image from "next/image";
import { VoucherClaimDrawer } from "@/components/voucher-claim-drawer";
import { VoucherStatusBadge } from "@/components/voucher-status-badge";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";

import { getApiUrl } from "@/lib/api-config";

interface Voucher {
  id: string;
  code: string;
  name: string | null;
  status: string;
  createdAt: string;
  imageUrl: string | null;
  customerName?: string;
  bindedToPhoneNumber?: string;
}

interface Stats {
  vouchers: {
    total: number;
    available: number;
    active: number;
    claimed: number;
  };
  customers: {
    total: number;
  };
  recentActivity: {
    id: string;
    code: string;
    name: string;
    status: string;
    createdAt: string;
    expiryDate: string | null;
    claimRequestedAt: string | null;
    customerName: string | null;
  }[];
  chartData: {
    date: string;
    binds: number;
    claims: number;
  }[];
}

export default function Page() {
  const { user, logout, isLoading: authLoading } = useAuth();

  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(),
    to: new Date(),
  });
  const [stats, setStats] = useState<Stats | null>(null);
  const [requestedVouchers, setRequestedVouchers] = useState<Voucher[]>([]);
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const [isRequestedLoading, setIsRequestedLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    if (!user || !date?.from || !date?.to) return;

    setIsStatsLoading(true);
    setIsRequestedLoading(true);

    try {
      const token = localStorage.getItem("token");
      const from = encodeURIComponent(date.from.toISOString());
      const to = encodeURIComponent(date.to.toISOString());

      const [statsRes, vouchersRes] = await Promise.all([
        fetch(getApiUrl(`/stats?from=${from}&to=${to}`), {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(getApiUrl("/vouchers?requested=true&limit=5"), {
          headers: { Authorization: `Bearer ${token}` },
        })
      ]);

      if (statsRes.status === 401 || vouchersRes.status === 401) {
        logout();
        return;
      }

      if (statsRes.ok) {
        setStats((await statsRes.json()) as Stats);
      }
      if (vouchersRes.ok) {
        const result = (await vouchersRes.json()) as { data: Voucher[] };
        setRequestedVouchers(result.data);
      }
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
    } finally {
      setLoading(false);
      setIsStatsLoading(false);
      setIsRequestedLoading(false);
    }
  }, [user, date, logout]); // Removed stats from dependencies

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (authLoading) return null;

  if (!user) return null;

  return (
    <div className="flex flex-1 flex-col gap-8 p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {user.name}. Here&apos;s what&apos;s happening today.
          </p>
        </div>
        <DatePickerWithRange date={date} setDate={setDate} />
      </div>

      <div className="w-full">
        {loading || isStatsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
        ) : (
          stats && <DashboardStats stats={stats} />
        )}
      </div>

      {/* Requested Redemptions Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            Pending Redemption Requests
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {loading || isRequestedLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))
          ) : requestedVouchers.length === 0 ? (
            <div className="col-span-full py-8 text-center border rounded-xl bg-muted/20 text-muted-foreground text-sm">
              No pending redemption requests.
            </div>
          ) : (
            requestedVouchers.map((voucher) => (
              <div
                key={voucher.id}
                className="p-4 cursor-pointer hover:border-amber-500/50 transition-all border-2 border-amber-100 bg-amber-50/30 dark:bg-amber-950/20 dark:border-amber-900/50 active:scale-95 rounded-xl"
                onClick={() => {
                  setSelectedVoucher(voucher);
                  setIsSheetOpen(true);
                }}
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
                  <Badge className="bg-amber-500 hover:bg-amber-600 text-[9px] px-1.5 h-5">NEW</Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {loading || isStatsLoading ? (
            <Skeleton className="h-[450px] w-full rounded-xl" />
          ) : (
            <ChartAreaInteractive data={stats?.chartData} />
          )}
        </div>
        <div className="flex flex-col gap-8">
          <Card className="flex h-full flex-col overflow-hidden">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest voucher updates</CardDescription>
            </CardHeader>
            <CardContent>
              {loading || isStatsLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-3 w-3 rounded-full" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="relative space-y-6 pl-2 font-sans">
                  {/* Timeline line */}
                  <div className="absolute left-[13px] top-2 bottom-2 w-px bg-border text-primary/20" />

                  {stats?.recentActivity.map((activity) => (
                    <div key={activity.id} className="relative flex items-center gap-4 group">
                      <div
                        className={`relative z-10 h-2.5 w-2.5 rounded-full border-2 border-background transition-shadow duration-300 ${activity.status === "claimed" || activity.status === "redeemed"
                          ? "bg-zinc-800 shadow-[0_0_8px_rgba(39,39,42,0.4)]"
                          : activity.status === "active"
                            ? "bg-emerald-600 dark:bg-emerald-500 shadow-[0_0_8px_rgba(5,150,105,0.4)] dark:shadow-[0_0_8px_rgba(5,150,105,0.2)]"
                            : activity.status === "expired"
                              ? "bg-red-600 dark:bg-red-500 shadow-[0_0_8px_rgba(220,38,38,0.4)] dark:shadow-[0_0_8px_rgba(220,38,38,0.2)]"
                              : "bg-amber-500 dark:bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.4)] dark:shadow-[0_0_8px_rgba(245,158,11,0.2)] animate-pulse"
                          }`}
                      />
                      <div className="flex-1 space-y-0.5">
                        <p className="text-sm font-bold leading-none tracking-tight">
                          {activity.name || activity.code}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {activity.customerName
                            ? `Bound to ${activity.customerName}`
                            : activity.code}
                        </p>
                      </div>
                      <VoucherStatusBadge
                        status={activity.status}
                        expiryDate={activity.expiryDate}
                        claimRequestedAt={activity.claimRequestedAt}
                        className="text-[9px] px-1.5 h-5 shadow-xs"
                      />
                    </div>
                  ))}
                  {(!stats?.recentActivity || stats.recentActivity.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4 italic">
                      No recent activity
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <VoucherClaimDrawer
        isOpen={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        voucher={selectedVoucher}
        onSuccess={() => {
          fetchDashboardData();
        }}
      />
    </div>
  );
}
