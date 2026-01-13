"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { Info, Check, Loader2 } from "lucide-react";
import { getApiUrl } from "@/lib/api-config";

export default function MembershipProgressPage() {
    const { user, isLoading: authLoading } = useAuth();
    const [progress, setProgress] = useState<{ activeCount: number } | null>(null);
    const [isDataLoading, setIsDataLoading] = useState(true);

    useEffect(() => {
        if (user?.phoneNumber) {
            setIsDataLoading(true);
            fetch(getApiUrl(`/visits/customer/${user.phoneNumber}`), {
                headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
            })
                .then((res) => res.json())
                .then((data: unknown) => {
                    setProgress(data as { activeCount: number });
                    setIsDataLoading(false);
                })
                .catch((err) => {
                    console.error("Failed to fetch progress", err);
                    setIsDataLoading(false);
                });
        } else if (!authLoading) {
            setIsDataLoading(false);
        }
    }, [user, authLoading]);

    if (authLoading || isDataLoading) return (
        <div className="flex h-[80vh] w-full items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary opacity-80" />
                <p className="text-sm font-medium text-muted-foreground animate-pulse">Loading your loyalty status...</p>
            </div>
        </div>
    );

    if (!user || user.role !== "customer") return null;

    const stamps = Array.from({ length: 10 });
    const activeCount = progress?.activeCount ?? 0;

    return (
        <div className="w-full flex flex-col items-center">
            <main className="w-full max-w-[690px] p-6 space-y-6 flex flex-col">
                <Card className="overflow-hidden border-2">
                    <CardContent className="p-0">
                        {/* Top Banner */}
                        <div className="bg-primary p-6 text-primary-foreground">
                            <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                    <h2 className="text-2xl font-bold tracking-tight">Stamp Card</h2>
                                    <p className="text-sm opacity-90">Collect 10 stamps for a reward</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 space-y-8">
                            {/* Progress Summary */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-black">{activeCount}</span>
                                    <span className="text-muted-foreground font-medium">/ 10 stamps</span>
                                </div>
                                {activeCount === 10 ? (
                                    <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">
                                        REWARD READY!
                                    </div>
                                ) : (
                                    <div className="text-xs text-muted-foreground font-medium">
                                        {10 - activeCount} more to go
                                    </div>
                                )}
                            </div>

                            {/* Stamp Grid */}
                            <div className="grid grid-cols-5 gap-3">
                                {stamps.map((_, i) => {
                                    const isStamped = i < activeCount;
                                    return (
                                        <div key={i} className="aspect-square relative flex items-center justify-center">
                                            <div className={`w-full h-full rounded-2xl border-2 flex items-center justify-center transition-all duration-300 ${isStamped
                                                ? "bg-primary border-primary shadow-lg shadow-primary/20 scale-105"
                                                : "bg-muted/50 border-dashed border-muted-foreground/30"
                                                }`}>
                                                {isStamped ? (
                                                    <Check className="w-6 h-6 text-primary-foreground stroke-[3px]" />
                                                ) : (
                                                    <span className="text-sm font-bold text-muted-foreground/40">{i + 1}</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Info Box */}
                            <div className="bg-muted/50 rounded-xl p-4 flex gap-3 items-start border border-border/50">
                                <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Stamps are added when you visit. Once you hit 10 visits, confirm with the staff to be rewarded.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Action Button */}
                <div className="space-y-3">
                    <Link href="/customer/vouchers" className="block w-full">
                        <Button size="lg" className="w-full font-bold text-base h-12 rounded-xl shadow-sm">
                            View My Rewards
                        </Button>
                    </Link>
                    <p className="text-center text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                        Thank you for being a regular!
                    </p>
                </div>
            </main>
        </div>
    );
}
