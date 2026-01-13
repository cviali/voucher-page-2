"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Loader2, User, Phone, X, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useDebounce } from "@/hooks/use-debounce";
import { getApiUrl } from "@/lib/api-config";

export interface DashboardUser {
    id: number;
    name: string;
    phoneNumber: string;
    email?: string;
    createdAt: string;
    updatedAt: string;
}

interface CustomerSearchProps {
    onSelect: (user: DashboardUser | null) => void;
    selectedUser: DashboardUser | null;
    label?: string;
    className?: string;
}

export function CustomerSearch({ onSelect, selectedUser, label = "Customer Search", className }: CustomerSearchProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<DashboardUser[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const debouncedSearch = useDebounce(searchQuery, 300);

    const searchCustomers = useCallback(async (query: string) => {
        if (!query || query.length < 2) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            const res = await fetch(getApiUrl(`/users/search?q=${encodeURIComponent(query)}`), {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
            });
            if (res.ok) {
                const data = await res.json() as DashboardUser[];
                setSearchResults(data);
            }
        } catch (error) {
            console.error("Error searching users:", error);
        } finally {
            setIsSearching(false);
        }
    }, []);

    useEffect(() => {
        searchCustomers(debouncedSearch);
    }, [debouncedSearch, searchCustomers]);

    return (
        <div className={className}>
            <div className="space-y-2">
                <Label className="text-xs uppercase text-muted-foreground font-bold">
                    {label}
                </Label>

                {selectedUser ? (
                    <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 flex items-center justify-between animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <User className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex flex-col text-left">
                                <span className="font-medium text-sm">{selectedUser.name}</span>
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Phone className="h-3 w-3" /> {selectedUser.phoneNumber}
                                </span>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full"
                            onClick={() => {
                                onSelect(null);
                                setSearchQuery("");
                            }}
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
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by name or phone..."
                                    className="pl-9 h-10 bg-background border rounded-md"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        {isSearching && (
                            <div className="absolute z-50 w-full bg-background border rounded-md shadow-lg p-6 flex flex-col items-center justify-center gap-2 animate-in fade-in zoom-in-95 mt-1">
                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                <p className="text-xs text-muted-foreground">Searching records...</p>
                            </div>
                        )}

                        {!isSearching && searchQuery.length >= 2 && searchResults.length > 0 && (
                            <div className="absolute z-50 w-full bg-background border rounded-md shadow-lg overflow-hidden divide-y animate-in fade-in slide-in-from-top-2 mt-1">
                                {searchResults.map((u) => (
                                    <button
                                        key={u.id}
                                        className="w-full px-4 py-3 text-left hover:bg-muted transition-colors flex flex-col gap-0.5 group"
                                        onClick={() => {
                                            onSelect(u);
                                            setSearchResults([]);
                                        }}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium">
                                                {u.name}
                                            </span>
                                            <span className="text-[10px] font-bold bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                                ID: {u.id}
                                            </span>
                                        </div>
                                        <span className="text-xs text-muted-foreground">
                                            {u.phoneNumber}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {!isSearching && searchQuery.length >= 2 && searchResults.length === 0 && (
                            <div className="absolute z-50 w-full bg-background border rounded-md shadow-lg p-4 text-center text-sm text-muted-foreground flex flex-col gap-2 mt-1 animate-in fade-in zoom-in-95">
                                <span>No customers found</span>
                                <a href="/dashboard/customers" className="text-primary text-[10px] font-bold uppercase flex items-center justify-center gap-1">
                                    <Plus className="h-3 w-3" /> Register new customer
                                </a>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
