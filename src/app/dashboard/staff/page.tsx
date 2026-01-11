"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
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
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  User,
  Shield,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Staff {
  id: number;
  name: string;
  username: string;
  role: string;
  phoneNumber: string;
}

export default function StaffPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;

  const [formData, setFormData] = useState({
    name: "",
    username: "",
    password: "",
    phoneNumber: "",
  });

  const [editFormData, setEditFormData] = useState({
    name: "",
    phoneNumber: "",
    password: "",
  });

  const fetchStaff = async (currentPage: number) => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(getApiUrl(`/users?role=cashier&page=${currentPage}&limit=${limit}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const result = (await res.json()) as {
          data: Staff[];
          pagination: { totalPages: number; total: number };
        };
        setStaff(result.data);
        setTotalPages(result.pagination.totalPages);
        setTotal(result.pagination.total);
      }
    } catch {
      toast.error("Failed to fetch staff");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff(page);
  }, [page]);

  if (authLoading || !user) return null;

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdding(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(getApiUrl("/users"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...formData, role: "cashier" }),
      });

      if (res.ok) {
        toast.success("Cashier account created successfully");
        setIsSheetOpen(false);
        setFormData({ name: "", username: "", password: "", phoneNumber: "" });
        fetchStaff(1);
        setPage(1);
      } else {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error || "Failed to create account");
      }
    } catch {
      toast.error("Connection error");
    } finally {
      setIsAdding(false);
    }
  };

  const handleRowClick = (item: Staff) => {
    setSelectedStaff(item);
    setEditFormData({
      name: item.name,
      phoneNumber: item.phoneNumber,
      password: "",
    });
    setIsEditSheetOpen(true);
  };

  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;
    setIsUpdating(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(getApiUrl(`/users/${selectedStaff.id}`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editFormData.name,
          phoneNumber: editFormData.phoneNumber,
          ...(editFormData.password ? { password: editFormData.password } : {}),
        }),
      });

      if (res.ok) {
        toast.success("Staff updated successfully");
        setIsEditSheetOpen(false);
        fetchStaff(page);
      } else {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error || "Failed to update staff");
      }
    } catch {
      toast.error("Connection error");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteStaff = async () => {
    if (!selectedStaff) return;
    if (!confirm("Are you sure you want to delete this staff member?")) return;

    setIsDeleting(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(getApiUrl(`/users/${selectedStaff.id}`), {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        toast.success("Staff deleted successfully");
        setIsEditSheetOpen(false);
        fetchStaff(page);
      } else {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error || "Failed to delete staff");
      }
    } catch {
      toast.error("Connection error");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col p-8 gap-8">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold">Staff Management</h1>
          <p className="text-muted-foreground">
            Manage cashier accounts and system access.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-y-3">
        <div className="flex justify-end">
          <Button
            onClick={() => setIsSheetOpen(true)}
            disabled={isAdding}
          >
            <Plus className="h-4 w-4" />
            Add Cashier
          </Button>
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Name</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Phone Number</TableHead>
                <TableHead className="pr-6">Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center pl-6 pr-6">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : staff.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-24 text-center text-muted-foreground pl-6 pr-6"
                  >
                    No cashier accounts found.
                  </TableCell>
                </TableRow>
              ) : (
                staff.map((item) => (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(item)}
                  >
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <span className="font-medium">{item.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{item.username}</TableCell>
                    <TableCell>{item.phoneNumber}</TableCell>
                    <TableCell className="pr-6">
                      <Badge variant="secondary" className="flex w-fit items-center gap-1">
                        <Shield className="h-3 w-3" />
                        {item.role}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {staff.length} of {total} staff members
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

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Add New Cashier</SheetTitle>
            <SheetDescription>
              Create a new cashier account for the system.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleAddStaff} className="grid gap-6 px-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                placeholder="John Doe"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="johndoe"
                required
                value={formData.username}
                onChange={(e) =>
                  setFormData({ ...formData, username: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="flex gap-2">
                <div className="flex items-center justify-center px-3 rounded-md border bg-muted text-muted-foreground text-sm font-medium">
                  +62
                </div>
                <Input
                  id="phone"
                  placeholder="8123456789"
                  required
                  value={formData.phoneNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, phoneNumber: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
              />
            </div>
            <SheetFooter className="p-0">
              <Button type="submit" className="w-full" disabled={isAdding}>
                {isAdding && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create Account
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
      <Sheet open={isEditSheetOpen} onOpenChange={setIsEditSheetOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Edit Staff Member</SheetTitle>
            <SheetDescription>
              Update details for {selectedStaff?.name}.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleUpdateStaff} className="grid gap-6 px-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full Name</Label>
              <Input
                id="edit-name"
                required
                value={editFormData.name || ""}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone Number</Label>
              <div className="flex gap-2">
                <div className="flex items-center justify-center px-3 rounded-md border bg-muted text-muted-foreground text-sm font-medium">
                  +62
                </div>
                <Input
                  id="edit-phone"
                  required
                  value={editFormData.phoneNumber || ""}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, phoneNumber: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">New Password (leave blank to keep current)</Label>
              <Input
                id="edit-password"
                type="password"
                value={editFormData.password || ""}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, password: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={isUpdating}>
                {isUpdating && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Update Staff
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="w-full"
                onClick={handleDeleteStaff}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Delete Staff
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
