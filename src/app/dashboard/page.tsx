"use client";

import { useEffect, useState } from "react";
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
    customerName: string | null;
  }[];
  chartData: {
    date: string;
    binds: number;
    claims: number;
  }[];
}

export default function Page() {
  const { user, isLoading: authLoading } = useAuth();

  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("/api/stats", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = (await res.json()) as Stats;
          setStats(data);
        }
      } catch (err) {
        console.error("Failed to fetch stats:", err);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchStats();
    }
  }, [user]);

  if (authLoading || loading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-8">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex flex-1 flex-col gap-8 p-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {user.name}. Here&apos;s what&apos;s happening today.
        </p>
      </div>
      <div className="w-full">{stats && <DashboardStats stats={stats} />}</div>
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartAreaInteractive data={stats?.chartData} />
        </div>
        <div className="flex flex-col gap-8">
          <Card className="flex h-full flex-col">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest voucher updates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative space-y-6 pl-2">
                {/* Timeline line */}
                <div className="absolute left-[13px] top-2 bottom-2 w-px bg-border" />

                {stats?.recentActivity.map((activity) => (
                  <div key={activity.id} className="relative flex items-center gap-4">
                    <div
                      className={`relative z-10 h-2.5 w-2.5 rounded-full border-2 border-background ${
                        activity.status === "claimed"
                          ? "bg-green-500"
                          : activity.status === "active"
                          ? "bg-blue-500"
                          : "bg-gray-300"
                      }`}
                    />
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {activity.name || activity.code}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {activity.customerName
                          ? `Bound to ${activity.customerName}`
                          : activity.code}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {activity.status}
                    </Badge>
                  </div>
                ))}
                {(!stats?.recentActivity || stats.recentActivity.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No recent activity
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
