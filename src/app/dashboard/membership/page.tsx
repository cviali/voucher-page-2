"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { getApiUrl } from "@/lib/api-config";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Plus, RotateCcw, CheckCircle2, User, Gift, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDate, VOUCHER_STATUS_COLORS, cn, formatDateTimeGMT7 } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { CustomerSearch, type DashboardUser } from "@/components/customer-search";

interface Visit {
    id: number;
    customerPhoneNumber: string;
    processedBy: string;
    createdAt: string;
    revokedAt: string | null;
    revokedBy: string | null;
    revocationReason: string | null;
    isRewardGenerated: boolean;
    rewardVoucherId: string | null;
    rewardVoucherCode?: string | null;
}

interface CustomerProgress {
    phoneNumber: string;
    activeCount: number;
    history: Visit[];
    customerName?: string;
}

interface Template {
    id: number;
    name: string;
}

export default function MembershipPage() {
    const { user } = useAuth();
    const [progress, setProgress] = useState<CustomerProgress | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isIssuingReward, setIsIssuingReward] = useState(false);
    const [isRevoking, setIsRevoking] = useState<number | null>(null);
    const [templates, setTemplates] = useState<Template[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

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

    const [expiryDate, setExpiryDate] = useState<string>(() => {
        const d = new Date();
        d.setMonth(d.getMonth() + 6);
        return formatToDisplayDate(d.toISOString().split('T')[0]);
    });

    // Customer search state
    const [selectedUser, setSelectedUser] = useState<DashboardUser | null>(null);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const totalPages = progress ? Math.ceil(progress.history.length / itemsPerPage) : 0;
    const paginatedHistory = progress ? progress.history.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    ) : [];

    useEffect(() => {
        fetchTemplates();
    }, []);

    useEffect(() => {
        if (selectedUser) {
            searchCustomer(selectedUser.phoneNumber);
            setCurrentPage(1); // Reset to first page
        } else {
            setProgress(null);
        }
    }, [selectedUser]);

    const fetchTemplates = async () => {
        try {
            const res = await fetch(getApiUrl("/templates"), {
                headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
            });
            if (res.ok) {
                const data = await res.json() as Template[];
                setTemplates(data);
                if (data.length > 0) setSelectedTemplateId(data[0].id.toString());
            }
        } catch {
            console.error("Failed to fetch templates");
        }
    };

    const searchCustomer = async (phoneToSearch: string) => {
        if (!phoneToSearch) return;

        setIsSearching(true);
        try {
            const res = await fetch(getApiUrl(`/visits/customer/${phoneToSearch}`), {
                headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
            });
            if (res.ok) {
                const data = await res.json() as CustomerProgress;
                setProgress(data);
            } else {
                const err = await res.json() as { error?: string };
                toast.error(err.error || "Failed to fetch customer progress");
                setProgress(null);
            }
        } catch {
            toast.error("Error searching customer");
        } finally {
            setIsSearching(false);
        }
    };

    const recordVisit = async () => {
        if (!selectedUser) return;

        setIsRecording(true);
        try {
            const res = await fetch(getApiUrl("/visits"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
                body: JSON.stringify({
                    phoneNumber: selectedUser.phoneNumber,
                    rewardTemplateId: selectedTemplateId ? parseInt(selectedTemplateId) : undefined
                }),
            });

            if (res.ok) {
                toast.success("Visit recorded successfully!");
                searchCustomer(selectedUser.phoneNumber); // Refresh
            } else {
                const err = await res.json() as { error?: string };
                toast.error(err.error || "Failed to record visit");
            }
        } catch {
            toast.error("Error recording visit");
        } finally {
            setIsRecording(false);
        }
    };

    const issueReward = async () => {
        if (!selectedUser) return;

        setIsIssuingReward(true);
        try {
            const res = await fetch(getApiUrl("/visits/issue-reward"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
                body: JSON.stringify({
                    phoneNumber: selectedUser.phoneNumber,
                    rewardTemplateId: selectedTemplateId ? parseInt(selectedTemplateId) : undefined,
                    expiresAt: formatToApiDate(expiryDate)
                }),
            });

            if (res.ok) {
                const data = await res.json() as { voucherCode: string };
                toast.success(`Reward Issued! Code: ${data.voucherCode}`);
                searchCustomer(selectedUser.phoneNumber); // Refresh
            } else {
                const err = await res.json() as { error?: string };
                toast.error(err.error || "Failed to issue reward");
            }
        } catch {
            toast.error("Error issuing reward");
        } finally {
            setIsIssuingReward(false);
        }
    };

    const revokeVisit = async (visitId: number) => {
        const reason = window.prompt("Reason for revocation:");
        if (reason === null) return;

        setIsRevoking(visitId);
        try {
            const res = await fetch(getApiUrl(`/visits/${visitId}/revoke`), {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
                body: JSON.stringify({ reason }),
            });

            if (res.ok) {
                toast.success("Visit revoked");
                if (selectedUser) searchCustomer(selectedUser.phoneNumber); // Refresh
            } else {
                const err = await res.json() as { error?: string };
                toast.error(err.error || "Failed to revoke visit");
            }
        } catch {
            toast.error("Error revoking visit");
        } finally {
            setIsRevoking(null);
        }
    };

    return (
        <div className="flex flex-1 flex-col p-8 gap-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-col">
                    <h1 className="text-2xl font-bold">Membership Stamps</h1>
                    <p className="text-muted-foreground">
                        Record customer visits and track their stamp card progress.
                    </p>
                </div>
            </div>

            <div className="flex flex-col gap-8 w-full">
                {/* 1. Customer Selection */}
                <CustomerSearch
                    selectedUser={selectedUser}
                    onSelect={setSelectedUser}
                    label="1. Select Customer"
                />

                {/* Conditional Rewards and Visit Section */}
                {selectedUser && (
                    <div className="grid gap-8 lg:grid-cols-2 animate-in fade-in slide-in-from-top-4 duration-500">
                        {/* Step 2 & 3: Progress and Recording */}
                        <div className="space-y-8">
                            {isSearching ? (
                                <>
                                    <div className="space-y-4 animate-pulse">
                                        <div className="flex items-center justify-between px-2">
                                            <div className="h-7 w-40 bg-muted rounded" />
                                            <div className="h-7 w-16 bg-muted rounded" />
                                        </div>
                                        <div className="bg-muted/30 border border-dashed rounded-xl p-5 shadow-sm">
                                            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                                                {Array.from({ length: 10 }).map((_, i) => (
                                                    <div key={i} className="aspect-square rounded-lg bg-muted/20" />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-card border border-dashed rounded-xl p-5 shadow-sm animate-pulse">
                                        <div className="h-10 w-full bg-muted/20 rounded-md" />
                                    </div>
                                </>
                            ) : progress && (
                                <>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between px-2">
                                            <h2 className="text-lg font-semibold flex items-center gap-2 text-foreground">
                                                Stamp Card Status
                                            </h2>
                                            <div className="text-right">
                                                <span className="text-xl font-bold tabular-nums">{progress.activeCount}</span>
                                                <span className="text-muted-foreground text-xs font-medium ml-1.5">/ 10</span>
                                            </div>
                                        </div>

                                        <div className="bg-muted/30 border rounded-xl p-5 shadow-sm">
                                            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                                                {Array.from({ length: 10 }).map((_, i) => (
                                                    <div
                                                        key={i}
                                                        className={`aspect-square rounded-lg border flex items-center justify-center transition-all duration-300 ${i < progress.activeCount
                                                            ? "bg-primary border-primary text-primary-foreground shadow-sm"
                                                            : "bg-background border-dashed border-muted-foreground/30 text-muted-foreground/20"
                                                            }`}
                                                    >
                                                        {i < progress.activeCount ? (
                                                            <CheckCircle2 className="h-5 w-5" />
                                                        ) : (
                                                            <span className="text-xs font-bold">{i + 1}</span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-card border rounded-xl p-5 shadow-sm">
                                        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                                            {progress.activeCount === 10 ? (
                                                <>
                                                    <div className="space-y-2 flex-1 min-w-0">
                                                        <Label className="text-xs uppercase text-muted-foreground font-bold">
                                                            2. Reward on completion
                                                        </Label>
                                                        <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                                                            <SelectTrigger className="w-full bg-background border text-base sm:text-sm h-[40px]">
                                                                <SelectValue placeholder="Select a template" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {templates.map((t) => (
                                                                    <SelectItem key={t.id} value={t.id.toString()}>
                                                                        {t.name}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>

                                                    <div className="space-y-2 flex-1 animate-in fade-in slide-in-from-left-2">
                                                        <Label className="text-xs uppercase text-muted-foreground font-bold">
                                                            3. Expiration Date
                                                        </Label>
                                                        <Input
                                                            id="reward-expiry"
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
                                                            className="bg-background border text-base sm:text-sm h-[40px]"
                                                        />
                                                    </div>

                                                    <div className="flex-1">
                                                        <Button
                                                            className="w-full text-xs font-bold uppercase tracking-wider bg-primary shadow-sm h-[40px]"
                                                            onClick={issueReward}
                                                            disabled={isIssuingReward}
                                                        >
                                                            {isIssuingReward ? (
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <Gift className="mr-2 h-4 w-4" />
                                                            )}
                                                            Issue Reward
                                                        </Button>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="space-y-2 flex-1">
                                                    <Label className="text-xs uppercase text-muted-foreground font-bold">
                                                        2. Record New Visit
                                                    </Label>
                                                    <Button
                                                        className="w-full text-xs font-bold uppercase tracking-wider shadow-sm h-[40px]"
                                                        onClick={recordVisit}
                                                        disabled={isRecording || progress.activeCount >= 10}
                                                    >
                                                        {isRecording ? (
                                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <Plus className="mr-2 h-4 w-4" />
                                                        )}
                                                        Record Visit
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Visitation History Table */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between px-2">
                                <h2 className="text-lg font-semibold flex items-center gap-2 text-foreground">
                                    Visitation History
                                </h2>
                            </div>

                            <div className="rounded-md border overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="pl-6">Date</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Reward Code</TableHead>
                                            <TableHead className="text-right pr-6">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isSearching ? (
                                            Array.from({ length: 5 }).map((_, i) => (
                                                <TableRow key={i}>
                                                    <TableCell className="pl-6 py-4"><div className="h-4 w-32 bg-muted animate-pulse rounded" /></TableCell>
                                                    <TableCell className="py-4"><div className="h-5 w-16 bg-muted animate-pulse rounded-full" /></TableCell>
                                                    <TableCell className="py-4"><div className="h-4 w-12 bg-muted animate-pulse rounded" /></TableCell>
                                                    <TableCell className="text-right pr-6 py-4">
                                                        <div className="h-8 w-20 bg-muted animate-pulse rounded-lg ml-auto" />
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : paginatedHistory.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center py-12 text-muted-foreground pl-6 pr-6">
                                                    No history found for this customer.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            paginatedHistory.map((v) => (
                                                <TableRow key={v.id} className="group hover:bg-muted/50 transition-colors">
                                                    <TableCell className="font-medium text-sm pl-6 py-4">
                                                        {formatDateTimeGMT7(v.createdAt)}
                                                    </TableCell>
                                                    <TableCell className="py-4">
                                                        {v.revokedAt ? (
                                                            <Badge className={cn("font-bold tracking-wider px-2 py-0.5 text-[10px]", VOUCHER_STATUS_COLORS.expired)}>Revoked</Badge>
                                                        ) : v.isRewardGenerated ? (
                                                            <Badge className={cn("font-bold tracking-wider px-2 py-0.5 text-[10px]", VOUCHER_STATUS_COLORS.claimed)}>Rewarded</Badge>
                                                        ) : (
                                                            <Badge className={cn("font-bold tracking-wider px-2 py-0.5 text-[10px]", VOUCHER_STATUS_COLORS.active)}>Valid</Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="py-4">
                                                        {v.rewardVoucherCode ? (
                                                            <span className="font-mono text-sm font-bold">
                                                                {v.rewardVoucherCode}
                                                            </span>
                                                        ) : (
                                                            <div className="h-5 flex items-center">
                                                                <span className="text-muted-foreground/30 font-mono">-</span>
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right pr-6 py-4">
                                                        {user?.role === "admin" && !v.revokedAt && !v.isRewardGenerated ? (
                                                            <Button
                                                                variant="destructive"
                                                                size="sm"
                                                                onClick={() => revokeVisit(v.id)}
                                                                disabled={isRevoking === v.id}
                                                            >
                                                                {isRevoking === v.id ? (
                                                                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                                                                ) : (
                                                                    <RotateCcw className="h-3.5 w-3.5 mr-2" />
                                                                )}
                                                                Revoke
                                                            </Button>
                                                        ) : (
                                                            <div className="h-8 ml-auto" />
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <div className="flex items-center gap-6 order-2 sm:order-1">
                                        <p className="text-sm text-muted-foreground">
                                            Showing {paginatedHistory.length} of {progress?.history.length || 0} visits
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-muted-foreground whitespace-nowrap">Rows per page</span>
                                            <Select value={itemsPerPage.toString()} onValueChange={(v) => {
                                                setItemsPerPage(parseInt(v));
                                                setCurrentPage(1);
                                            }}>
                                                <SelectTrigger size="sm" className="h-8 w-[70px]">
                                                    <SelectValue placeholder={itemsPerPage.toString()} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="10">10</SelectItem>
                                                    <SelectItem value="25">25</SelectItem>
                                                    <SelectItem value="50">50</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-2 order-1 sm:order-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                        >
                                            <ChevronLeft className="h-4 w-4 mr-1" />
                                            Previous
                                        </Button>
                                        <div className="text-sm font-medium">
                                            Page {currentPage} of {totalPages}
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                        >
                                            Next
                                            <ChevronRight className="h-4 w-4 ml-1" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Initial View when no customer selected */}
                {!selectedUser && (
                    <div className="flex flex-col items-center justify-center py-24 bg-muted/10 border-2 border-dashed rounded-xl animate-in fade-in duration-500">
                        <div className="h-20 w-20 rounded-full bg-background border flex items-center justify-center mb-6 shadow-sm">
                            <User className="h-10 w-10 text-muted-foreground/30" />
                        </div>
                        <h2 className="text-xl font-bold tracking-tight mb-2">Customer Check-in</h2>
                        <p className="text-sm text-muted-foreground text-center max-w-sm">
                            Search for a customer by name or phone number to record their visit and track loyalty stamps.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
