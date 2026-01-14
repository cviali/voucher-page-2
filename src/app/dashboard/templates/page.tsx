"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useAuth } from "@/hooks/use-auth";
import { getOptimizedImageUrl, resizeImage, formatDate } from "@/lib/utils";
import { getApiUrl } from "@/lib/api-config";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
} from "@/components/ui/sheet";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Trash2,
  Upload,
  Image as ImageIcon,
  Search,
  ChevronLeft,
  ChevronRight,
  ListFilter
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface Template {
  id: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  createdAt: string;
}

export default function TemplatesPage() {
  const { user, logout, isLoading: authLoading } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(30);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false);

  const [newTemplateForm, setNewTemplateForm] = useState({
    name: "",
    description: "",
    imageUrl: "",
  });
  const [newTemplateImageFile, setNewTemplateImageFile] = useState<File | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchTemplates = useCallback(async (currentPage: number) => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const searchParam = debouncedSearch ? `&search=${debouncedSearch}` : "";
      const res = await fetch(
        getApiUrl(`/templates?page=${currentPage}&limit=${limit}${searchParam}`),
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
          data: Template[];
          pagination: {
            totalPages: number;
            total: number;
          };
        };
        setTemplates(result.data);
        setTotalPages(result.pagination.totalPages);
        setTotal(result.pagination.total);
      }
    } catch {
      toast.error("Failed to fetch templates");
    } finally {
      setIsLoading(false);
    }
  }, [logout, debouncedSearch, limit]);

  useEffect(() => {
    fetchTemplates(page);
  }, [page, fetchTemplates]);

  if (authLoading || !user) return null;

  const handleRowClick = (template: Template) => {
    setSelectedTemplate(template);
    setIsSheetOpen(true);
  };

  const handleCreateTemplate = async () => {
    if (!newTemplateForm.name) {
      toast.error("Template name is required");
      return;
    }
    setIsCreating(true);
    try {
      const token = localStorage.getItem("token");
      let currentImageUrl = newTemplateForm.imageUrl;

      if (newTemplateImageFile) {
        const resizedBlob = await resizeImage(newTemplateImageFile, 1200, 1200);
        const resizedFile = new File([resizedBlob], "template-image.jpg", { type: 'image/jpeg' });

        const formData = new FormData();
        formData.append("file", resizedFile);

        const uploadRes = await fetch(getApiUrl("/vouchers/upload"), {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        if (uploadRes.ok) {
          const { url } = (await uploadRes.json()) as { url: string };
          currentImageUrl = url;
        } else {
          toast.error("Failed to upload image");
          setIsCreating(false);
          return;
        }
      }

      const res = await fetch(getApiUrl("/templates"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...newTemplateForm,
          imageUrl: currentImageUrl,
        }),
      });

      if (res.ok) {
        toast.success("Template created successfully");
        setIsCreateSheetOpen(false);
        setNewTemplateForm({ name: "", description: "", imageUrl: "" });
        setNewTemplateImageFile(null);
        fetchTemplates(page);
      } else {
        toast.error("Failed to create template");
        setIsCreating(false);
        return;
      }
    } catch {
      toast.error("Connection error");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!selectedTemplate) return;
    if (!confirm("Are you sure you want to delete this template?")) return;

    setIsDeleting(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(getApiUrl(`/templates/${selectedTemplate.id}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        toast.success("Template deleted successfully");
        setIsSheetOpen(false);
        fetchTemplates(page);
      } else {
        toast.error("Failed to delete template");
      }
    } catch {
      toast.error("Connection error");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpdateTemplate = async (updates: Partial<Template>) => {
    if (!selectedTemplate) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(getApiUrl(`/templates/${selectedTemplate.id}`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        const updated = (await res.json()) as Template;
        setTemplates(templates.map((t) => (t.id === updated.id ? updated : t)));
        setSelectedTemplate(updated);
        toast.success("Template updated");
      } else {
        toast.error("Failed to update template");
      }
    } catch {
      toast.error("Error updating template");
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTemplate) return;

    setIsUploading(true);
    try {
      const resizedBlob = await resizeImage(file, 1200, 1200);
      const resizedFile = new File([resizedBlob], file.name, { type: 'image/jpeg' });

      const formData = new FormData();
      formData.append("file", resizedFile);

      const token = localStorage.getItem("token");
      const res = await fetch(getApiUrl("/vouchers/upload"), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (res.ok) {
        const { url } = (await res.json()) as { url: string };
        await handleUpdateTemplate({ imageUrl: url });
      } else {
        toast.error("Failed to upload image");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error resizing or uploading image");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col p-8 gap-8">
      <div>
        <h1 className="text-2xl font-bold">Voucher Templates</h1>
        <p className="text-muted-foreground">
          Manage reusable design templates for rewards.
        </p>
      </div>

      <div className="flex flex-col gap-y-3">
        {/* Filters & Actions Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex-1 space-y-4">
            <div className="md:hidden">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="filters" className="border-none">
                  <AccordionTrigger className="flex gap-2 py-0 hover:no-underline">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <ListFilter className="h-4 w-4" />
                      Filter Templates
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-4 pb-0">
                    <div className="grid gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="search-mobile" className="text-xs font-bold uppercase text-muted-foreground">Search Name</Label>
                        <div className="relative">
                          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="search-mobile"
                            placeholder="Template name..."
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
                <Label htmlFor="search-desktop" className="text-[10px] font-bold uppercase text-muted-foreground px-1">Search Name</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search-desktop"
                    placeholder="Template name..."
                    className="pl-8 bg-background"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              className="w-full md:w-auto"
              onClick={() => setIsCreateSheetOpen(true)}
              disabled={isCreating}
            >
              <Plus className="h-4 w-4" />
              Create Template
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Template</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="pr-6 text-right">Created At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground pl-6 pr-6">
                        No templates found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    templates.map((template) => (
                      <TableRow
                        key={template.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleRowClick(template)}
                      >
                        <TableCell className="pl-6 py-4">
                          <div className="flex items-center gap-4">
                            {template.imageUrl ? (
                              <div className="h-10 w-10 rounded-md border bg-muted overflow-hidden relative shadow-sm">
                                <Image
                                  src={getOptimizedImageUrl(template.imageUrl, 100)}
                                  alt={template.name}
                                  fill
                                  className="object-cover"
                                />
                              </div>
                            ) : (
                              <div className="h-10 w-10 rounded-md border bg-muted flex items-center justify-center shadow-sm">
                                <ImageIcon className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                            <span className="font-bold text-sm tracking-tight">{template.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-sm">
                          {template.description || "-"}
                        </TableCell>
                        <TableCell className="pr-6 text-right text-sm text-muted-foreground">
                          {formatDate(template.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4 order-2 sm:order-1">
                <p className="text-sm text-muted-foreground">
                  Showing {templates.length} of {total} templates
                </p>
              </div>
              <div className="flex items-center space-x-2 order-1 sm:order-2">
                <div className="flex items-center gap-2">
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
      </div>

      {/* Detail Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Template Details</SheetTitle>
            <SheetDescription>
              Modify template content or remove it.
            </SheetDescription>
          </SheetHeader>

          <div className="grid gap-6 p-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase text-muted-foreground font-bold">Name</Label>
              <Input
                defaultValue={selectedTemplate?.name || ""}
                onBlur={(e) => {
                  if (e.target.value !== selectedTemplate?.name) {
                    handleUpdateTemplate({ name: e.target.value });
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase text-muted-foreground font-bold">Image</Label>
              <div className="relative group">
                {selectedTemplate?.imageUrl ? (
                  <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-muted">
                    <Image
                      src={getOptimizedImageUrl(selectedTemplate.imageUrl)}
                      alt="Template"
                      fill
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Label htmlFor="edit-image-upload" className="cursor-pointer bg-white/20 hover:bg-white/30 p-2 rounded-full backdrop-blur-sm transition-colors">
                        <Upload className="h-5 w-5 text-white" />
                      </Label>
                    </div>
                  </div>
                ) : (
                  <Label htmlFor="edit-image-upload" className="flex flex-col items-center justify-center aspect-video w-full rounded-lg border border-dashed bg-muted/50 hover:bg-muted transition-colors cursor-pointer">
                    {isUploading ? (
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    ) : (
                      <>
                        <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                        <span className="text-sm text-muted-foreground">Upload Image</span>
                      </>
                    )}
                  </Label>
                )}
                <input
                  id="edit-image-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                  disabled={isUploading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase text-muted-foreground font-bold">Description</Label>
              <Textarea
                className="min-h-[150px]"
                defaultValue={selectedTemplate?.description || ""}
                onBlur={(e) => {
                  if (e.target.value !== selectedTemplate?.description) {
                    handleUpdateTemplate({ description: e.target.value });
                  }
                }}
              />
            </div>

            <div className="pt-4 border-t">
              <Button
                variant="destructive"
                className="w-full"
                onClick={handleDeleteTemplate}
                disabled={isDeleting}
              >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Delete Template
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Create Sheet */}
      <Sheet open={isCreateSheetOpen} onOpenChange={setIsCreateSheetOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>New Template</SheetTitle>
            <SheetDescription>Create a new reusable reward template.</SheetDescription>
          </SheetHeader>

          <div className="grid gap-6 p-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                placeholder="Holiday Reward..."
                value={newTemplateForm.name}
                onChange={(e) => setNewTemplateForm({ ...newTemplateForm, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Image</Label>
              <div
                className="flex flex-col items-center justify-center aspect-video w-full rounded-lg border border-dashed bg-muted/50 hover:bg-muted transition-colors cursor-pointer relative"
                onClick={() => document.getElementById("new-image-upload")?.click()}
              >
                {newTemplateImageFile ? (
                  <div className="absolute inset-0 p-2">
                    <Image
                      src={URL.createObjectURL(newTemplateImageFile)}
                      alt="Preview"
                      fill
                      className="object-cover rounded-md"
                    />
                  </div>
                ) : (
                  <>
                    <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">Click to upload</span>
                  </>
                )}
                <Input
                  id="new-image-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setNewTemplateImageFile(e.target.files?.[0] || null)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Enter terms/description..."
                className="min-h-[150px]"
                value={newTemplateForm.description}
                onChange={(e) => setNewTemplateForm({ ...newTemplateForm, description: e.target.value })}
              />
            </div>

            <Button
              className="w-full mt-4"
              onClick={handleCreateTemplate}
              disabled={isCreating}
            >
              {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Create Template
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
