"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
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
  SheetTrigger,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  User,
  Phone,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Customer {
  id: number;
  name: string;
  phoneNumber: string;
  dateOfBirth: string;
  username: string;
}

export default function CustomersPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    phoneNumber: "",
    dateOfBirth: "",
  });

  const [editFormData, setEditFormData] = useState({
    name: "",
    phoneNumber: "",
    dateOfBirth: "",
  });

  const fetchCustomers = async (currentPage: number) => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/users?role=customer&page=${currentPage}&limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const result = (await res.json()) as {
          data: Customer[];
          pagination: { totalPages: number; total: number };
        };
        setCustomers(result.data);
        setTotalPages(result.pagination.totalPages);
        setTotal(result.pagination.total);
      }
    } catch {
      toast.error("Failed to fetch customers");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user && (user.role === "cashier" || user.role === "admin")) {
      fetchCustomers(page);
    }
  }, [user, page]);

  if (authLoading) return null;
  if (!user || (user.role !== "cashier" && user.role !== "admin")) return null;

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

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdding(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          dateOfBirth: formatToApiDate(formData.dateOfBirth),
          role: "customer",
        }),
      });

      if (res.ok) {
        toast.success("Customer added successfully");
        setIsSheetOpen(false);
        setFormData({ name: "", phoneNumber: "", dateOfBirth: "" });
        fetchCustomers(1);
        setPage(1);
      } else {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error || "Failed to add customer");
      }
    } catch {
      toast.error("Connection error");
    } finally {
      setIsAdding(false);
    }
  };

  const handleRowClick = (customer: Customer) => {
    setSelectedCustomer(customer);
    setEditFormData({
      name: customer.name || "",
      phoneNumber: customer.phoneNumber || "",
      dateOfBirth: formatToDisplayDate(customer.dateOfBirth || ""),
    });
    setIsEditSheetOpen(true);
  };

  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    setIsUpdating(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/users/${selectedCustomer.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...editFormData,
          dateOfBirth: formatToApiDate(editFormData.dateOfBirth),
        }),
      });

      if (res.ok) {
        toast.success("Customer updated successfully");
        setIsEditSheetOpen(false);
        fetchCustomers(page);
      } else {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error || "Failed to update customer");
      }
    } catch {
      toast.error("Connection error");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!selectedCustomer) return;
    if (!confirm("Are you sure you want to delete this customer?")) return;

    setIsDeleting(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/users/${selectedCustomer.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        toast.success("Customer deleted successfully");
        setIsEditSheetOpen(false);
        fetchCustomers(page);
      } else {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error || "Failed to delete customer");
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
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-muted-foreground">
            Manage registered customers and their information.
          </p>
        </div>
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              Add Customer
            </Button>
          </SheetTrigger>
          <SheetContent className="sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Add New Customer</SheetTitle>
              <SheetDescription>
                Enter the customer&apos;s details to register them in the system.
              </SheetDescription>
            </SheetHeader>
            <form onSubmit={handleAddCustomer} className="grid gap-6 px-4">
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
                <Label htmlFor="dob">Date of Birth</Label>
                <Input
                  id="dob"
                  placeholder="DD/MM/YYYY"
                  required
                  value={formData.dateOfBirth}
                  onChange={(e) => {
                    let val = e.target.value.replace(/\D/g, "");
                    if (val.length > 2 && val.length <= 4) {
                      val = val.slice(0, 2) + "/" + val.slice(2);
                    } else if (val.length > 4) {
                      val = val.slice(0, 2) + "/" + val.slice(2, 4) + "/" + val.slice(4, 8);
                    }
                    setFormData({ ...formData, dateOfBirth: val });
                  }}
                />
              </div>
              <SheetFooter className="p-0">
                <Button type="submit" className="w-full" disabled={isAdding}>
                  {isAdding && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Register Customer
                </Button>
              </SheetFooter>
            </form>
          </SheetContent>
        </Sheet>
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
                  <TableHead className="pl-6">Name</TableHead>
                  <TableHead>Phone Number</TableHead>
                  <TableHead className="pr-6">Date of Birth</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center py-8 text-muted-foreground pl-6 pr-6"
                    >
                      No customers found.
                    </TableCell>
                  </TableRow>
                ) : (
                  customers.map((customer) => (
                    <TableRow 
                      key={customer.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleRowClick(customer)}
                    >
                      <TableCell className="font-medium pl-6">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {customer.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          {customer.phoneNumber}
                        </div>
                      </TableCell>
                      <TableCell className="pr-6">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {formatDate(customer.dateOfBirth)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {customers.length} of {total} customers
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

      <Sheet open={isEditSheetOpen} onOpenChange={setIsEditSheetOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Edit Customer</SheetTitle>
            <SheetDescription>
              Update details for {selectedCustomer?.name}.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleUpdateCustomer} className="grid gap-6 px-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full Name</Label>
              <Input
                id="edit-name"
                required
                value={editFormData.name}
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
                  value={editFormData.phoneNumber}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, phoneNumber: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-dob">Date of Birth</Label>
              <Input
                id="edit-dob"
                placeholder="DD/MM/YYYY"
                required
                value={editFormData.dateOfBirth}
                onChange={(e) => {
                  let val = e.target.value.replace(/\D/g, "");
                  if (val.length > 2 && val.length <= 4) {
                    val = val.slice(0, 2) + "/" + val.slice(2);
                  } else if (val.length > 4) {
                    val = val.slice(0, 2) + "/" + val.slice(2, 4) + "/" + val.slice(4, 8);
                  }
                  setEditFormData({ ...editFormData, dateOfBirth: val });
                }}
              />
            </div>
            <div className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={isUpdating}>
                {isUpdating && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Update Customer
              </Button>
              <Button 
                type="button" 
                variant="destructive" 
                className="w-full" 
                onClick={handleDeleteCustomer}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Delete Customer
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
