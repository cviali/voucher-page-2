"use client";

import { useState, useEffect, useCallback } from "react";
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
  SheetTrigger,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Phone,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Search,
  ListFilter,
} from "lucide-react";
import { formatDate, formatIDR } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface Customer {
  id: number;
  name: string;
  phoneNumber: string;
  dateOfBirth: string;
  username: string;
  totalSpending: number;
}

export default function CustomersPage() {
  const { user, logout, isLoading: authLoading } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Pagination & Filters
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(30);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

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

  const fetchCustomers = useCallback(
    async (currentPage: number) => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(
          getApiUrl(`/users?role=customer&page=${currentPage}&limit=${limit}&search=${debouncedSearch}`),
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (res.status === 401) {
          logout();
          return;
        }
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
    },
    [logout, limit, debouncedSearch]
  );

  useEffect(() => {
    fetchCustomers(page);
  }, [page, fetchCustomers]);

  if (authLoading || !user) return null;

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
      const res = await fetch(getApiUrl("/users"), {
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
      const res = await fetch(getApiUrl(`/users/${selectedCustomer.id}`), {
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

  const handleDeleteCustomer = async (customerToDelete?: Customer) => {
    const target = customerToDelete || selectedCustomer;
    if (!target) return;
    if (!confirm(`Are you sure you want to delete ${target.name}?`)) return;

    setIsDeleting(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(getApiUrl(`/users/${target.id}`), {
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
      <div>
        <h1 className="text-2xl font-bold">Manage Customers</h1>
        <p className="text-muted-foreground">
          View and manage your loyal customer database.
        </p>
      </div>

      <div className="flex flex-col gap-y-3">
        {/* Filters Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex-1 space-y-4">
            <div className="md:hidden">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="filters" className="border-none">
                  <AccordionTrigger className="flex gap-2 py-0 hover:no-underline">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <ListFilter className="h-4 w-4" />
                      Filter Customers
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-4 pb-0">
                    <div className="grid gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="search-mobile" className="text-xs font-bold uppercase text-muted-foreground">Search</Label>
                        <div className="relative">
                          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="search-mobile"
                            placeholder="Search by name or phone..."
                            className="pl-8 bg-background"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            {/* Desktop/Tablet Filters */}
            <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="search-desktop" className="text-[10px] font-bold uppercase text-muted-foreground px-1">Search</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search-desktop"
                    placeholder="Search by name or phone..."
                    className="pl-8 bg-background"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
              <SheetTrigger asChild>
                <Button className="w-full md:w-auto">
                  <Plus className="h-4 w-4" />
                  Add Customer
                </Button>
              </SheetTrigger>
              <SheetContent className="sm:max-w-md overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Add New Customer</SheetTitle>
                  <SheetDescription>
                    Enter the customer&apos;s details to register them in the
                    system.
                  </SheetDescription>
                </SheetHeader>
                <form
                  id="add-customer-form"
                  onSubmit={handleAddCustomer}
                  className="grid gap-6 px-4"
                >
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
                          setFormData({
                            ...formData,
                            phoneNumber: e.target.value,
                          })
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
                          val =
                            val.slice(0, 2) +
                            "/" +
                            val.slice(2, 4) +
                            "/" +
                            val.slice(4, 8);
                        }
                        setFormData({ ...formData, dateOfBirth: val });
                      }}
                    />
                  </div>
                </form>
                <SheetFooter className="mt-0">
                  <Button
                    type="submit"
                    form="add-customer-form"
                    className="w-full"
                    disabled={isAdding}
                  >
                    {isAdding ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" />
                    )}
                    Register Customer
                  </Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px] pl-6">ID</TableHead>
                  <TableHead>Customer Name</TableHead>
                  <TableHead>Phone Number</TableHead>
                  <TableHead>Date of Birth</TableHead>
                  <TableHead className="text-right pr-6">Total Spending</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center pl-6 pr-6">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Loading customers...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : customers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center pl-6 pr-6">
                      No customers found.
                    </TableCell>
                  </TableRow>
                ) : (
                  customers.map((customer) => (
                    <TableRow key={customer.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleRowClick(customer)}>
                      <TableCell className="pl-6">
                        #{customer.id}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center border text-primary font-bold text-xs uppercase">
                            {customer.name?.split(" ").map(n => n[0]).join("").slice(0, 2) || "?"}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-bold">{customer.name}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">{customer.phoneNumber}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">{formatDate(customer.dateOfBirth)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        {formatIDR(customer.totalSpending || 0)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {!isLoading && customers.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4 order-2 sm:order-1">
                <p className="text-sm text-muted-foreground">
                  Showing {customers.length} of {total} customers
                </p>
              </div>
              <div className="flex items-center space-x-2 order-1 sm:order-2">
                <div className="flex items-center gap-2 mr-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">Rows per page</span>
                  <Select value={limit.toString()} onValueChange={(v) => {
                    setLimit(parseInt(v));
                    setPage(1);
                  }}>
                    <SelectTrigger size="sm" className="w-[70px]">
                      <SelectValue placeholder={limit.toString()} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <div className="text-sm font-medium px-2 min-w-[80px] text-center">
                  Page {page} of {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Sheet open={isEditSheetOpen} onOpenChange={setIsEditSheetOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              Edit Customer
              <span className="text-sm font-normal text-muted-foreground">
                (#{selectedCustomer?.id})
              </span>
            </SheetTitle>
            <SheetDescription>
              Update details for {selectedCustomer?.name}.
            </SheetDescription>
          </SheetHeader>
          <form
            id="edit-customer-form"
            onSubmit={handleUpdateCustomer}
            className="grid gap-6 px-4"
          >
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
                    setEditFormData({
                      ...editFormData,
                      phoneNumber: e.target.value,
                    })
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
                    val =
                      val.slice(0, 2) +
                      "/" +
                      val.slice(2, 4) +
                      "/" +
                      val.slice(4, 8);
                  }
                  setEditFormData({ ...editFormData, dateOfBirth: val });
                }}
              />
            </div>
          </form>
          <SheetFooter className="mt-6">
            <Button
              type="submit"
              form="edit-customer-form"
              className="w-full"
              disabled={isUpdating}
            >
              {isUpdating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Update Customer
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="w-full"
              onClick={() => handleDeleteCustomer()}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete Customer
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
