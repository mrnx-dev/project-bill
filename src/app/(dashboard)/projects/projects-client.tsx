"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Plus, FileText, Maximize2, NotepadTextDashed, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { NumericFormat } from "react-number-format";
import { ConfirmDialog } from "@/components/confirm-dialog";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { CostEstimator } from "@/components/cost-estimator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Client = { id: string; name: string };

type ProjectItem = {
  id?: string;
  description: string;
  price: string | number;
  quantity?: string | number | null;
  rate?: string | number | null;
};

type Project = {
  id: string;
  title: string;
  clientId: string;
  client: Client;
  status: string;
  deadline?: string | null;
  totalPrice: string;
  dpAmount: string | null;
  currency: string;
  language?: string;
  terms?: string | null;
  taxName?: string | null;
  taxRate?: string | null;
  termsAcceptedAt: Date | null;
  invoices: { type: string; status: string; amount: string; paidAt: string | null; dueDate: string | null }[];
  items?: ProjectItem[];
  createdAt: string;
  updatedAt: string;
};

export function ProjectsClient({
  initialProjects,
  clients,
}: {
  initialProjects: Project[];
  clients: Client[];
}) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const uniqueStatuses = Array.from(new Set(projects.map((p) => p.status)));

  // Project Form State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [totalPrice, setTotalPrice] = useState("");
  const [dpAmount, setDpAmount] = useState("");
  const [currency, setCurrency] = useState("IDR");
  const [language, setLanguage] = useState("id");
  const [deadline, setDeadline] = useState("");
  const [terms, setTerms] = useState("");
  const [taxName, setTaxName] = useState("");
  const [taxRate, setTaxRate] = useState("");
  const [hasInvoices, setHasInvoices] = useState(false);
  const [isSowLocked, setIsSowLocked] = useState(false);
  const [isSowSigned, setIsSowSigned] = useState(false);
  const [items, setItems] = useState<ProjectItem[]>([]);
  const [newItemDesc, setNewItemDesc] = useState("");
  const [newItemQty, setNewItemQty] = useState("");
  const [newItemRate, setNewItemRate] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");

  // Auto calculate price based on Qty and Rate
  useEffect(() => {
    if (newItemQty && newItemRate) {
      const q = parseFloat(newItemQty);
      const r = parseFloat(newItemRate);
      if (!isNaN(q) && !isNaN(r)) {
        setNewItemPrice((q * r).toString());
      }
    }
  }, [newItemQty, newItemRate]);

  // Confirm Dialog State
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [sowTemplateConfirm, setSowTemplateConfirm] = useState<string | null>(null);
  const [itemRemoveConfirm, setItemRemoveConfirm] = useState<{
    idx: number;
    item: ProjectItem;
  } | null>(null);

  // Full Screen TOS Editor State
  const [isTosEditorOpen, setIsTosEditorOpen] = useState(false);
  const [isTosPreview, setIsTosPreview] = useState(false);

  // Invoice Form State
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const [invoiceProject, setInvoiceProject] = useState<Project | null>(null);
  const [invoiceType, setInvoiceType] = useState<"dp" | "full_payment">(
    "full_payment",
  );

  const [sowTemplates, setSowTemplates] = useState<{ id: string, name: string, content: string }[]>([]);

  useEffect(() => {
    fetch("/api/sow-templates")
      .then(res => res.json())
      .then(data => setSowTemplates(data))
      .catch(err => console.error("Failed to load templates:", err));
  }, []);

  const handleOpenDialog = (project?: Project) => {
    if (project) {
      setEditingId(project.id);
      setTitle(project.title);
      setClientId(project.clientId);
      setTotalPrice(project.totalPrice);
      setDpAmount(project.dpAmount || "");
      setCurrency(project.currency || "IDR");
      setLanguage(project.language || "id");
      setDeadline(
        project.deadline
          ? new Date(project.deadline).toISOString().split("T")[0]
          : "",
      );
      setTerms(project.terms || "");
      setTaxName(project.taxName || "");
      setTaxRate(project.taxRate ? String(project.taxRate) : "");
      setItems(project.items || []);
      const paid = project.invoices?.some((i) => i.status === "paid") || false;
      setIsSowLocked(paid);
      setIsSowSigned(!!project.termsAcceptedAt);
      setHasInvoices((project.invoices && project.invoices.length > 0) ? true : false);
    } else {
      setEditingId(null);
      setTitle("");
      setClientId("");
      setTotalPrice("");
      setDpAmount("");
      setCurrency("IDR");
      setLanguage("id");
      setDeadline("");
      setTerms("");
      setTaxName("");
      setTaxRate("");
      setItems([]);
      setIsSowLocked(false);
      setIsSowSigned(false);
      setHasInvoices(false);
    }
    setNewItemDesc("");
    setNewItemQty("");
    setNewItemRate("");
    setNewItemPrice("");
    setIsDialogOpen(true);
  };

  const formatCurrency = (amount: string | number, currencyStr: string) => {
    return new Intl.NumberFormat(currencyStr === "IDR" ? "id-ID" : "en-US", {
      style: "currency",
      currency: currencyStr,
      minimumFractionDigits: 0,
    }).format(Number(amount));
  };

  const getInvoiceCalculation = (project: Project) => {
    const hasDpInvoice = project.invoices?.some((inv) => inv.type === "dp");
    const hasFullInvoice = project.invoices?.some(
      (inv) => inv.type === "full_payment",
    );
    const isDpPaid = project.invoices?.some(
      (inv) => inv.type === "dp" && inv.status === "paid",
    );

    let fullPaymentAmount = Number(project.totalPrice);
    if (isDpPaid && project.dpAmount && Number(project.dpAmount) > 0) {
      fullPaymentAmount = fullPaymentAmount - Number(project.dpAmount);
    }

    return { hasDpInvoice, hasFullInvoice, isDpPaid, fullPaymentAmount };
  };

  const handleOpenInvoiceDialog = (project: Project) => {
    setInvoiceProject(project);
    const calc = getInvoiceCalculation(project);

    if (
      !calc.hasDpInvoice &&
      project.dpAmount &&
      Number(project.dpAmount) > 0
    ) {
      setInvoiceType("dp");
    } else {
      setInvoiceType("full_payment");
    }

    setIsInvoiceDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) {
      toast.error("Please select a client");
      return;
    }

    // Validate DP does not exceed total price
    if (dpAmount && parseFloat(dpAmount) > parseFloat(totalPrice)) {
      toast.error("DP amount cannot exceed total price");
      return;
    }

    setIsLoading(true);

    try {
      let finalTotalPrice = totalPrice;
      if (items.length > 0) {
        finalTotalPrice = items
          .reduce((sum, item) => sum + Number(item.price), 0)
          .toString();
      }

      const payload = {
        title,
        clientId,
        totalPrice: finalTotalPrice,
        dpAmount: dpAmount || null,
        currency,
        language,
        deadline: deadline || null,
        terms: terms || null,
        taxName: taxName || null,
        taxRate: taxRate ? Number(taxRate) : null,
        items: editingId ? undefined : items,
      };

      const url = editingId ? `/api/projects/${editingId}` : `/api/projects`;
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setIsDialogOpen(false);
        toast.success(editingId ? "Project updated" : "Project created");
        router.refresh();
        window.location.reload();
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || "Failed to save project");
      }
    } catch (error) {
      console.error(error);
      toast.error("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceProject) return;
    setIsLoading(true);

    try {
      const calc = getInvoiceCalculation(invoiceProject);
      const amount =
        invoiceType === "dp"
          ? invoiceProject.dpAmount
          : String(calc.fullPaymentAmount);

      const res = await fetch(`/api/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: invoiceProject.id,
          type: invoiceType,
          amount,
        }),
      });

      if (res.ok) {
        setIsInvoiceDialogOpen(false);
        toast.success("Invoice generated successfully");
        router.push("/invoices");
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || "Failed to create invoice");
      }
    } catch (error) {
      console.error(error);
      toast.error("Network error while generating invoice");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (res.ok) {
        setProjects(projects.filter((p) => p.id !== id));
        toast.success("Project deleted");
        router.refresh();
      } else {
        const errData = await res.json().catch(() => ({}));
        toast.error(errData.error || "Failed to delete project");
      }
    } catch (error) {
      console.error(error);
      toast.error("Network error while deleting");
    }
  };

  const filteredProjects = projects.filter(
    (project) => {
      const matchesSearch = project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.client.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (statusFilter !== "all" && project.status !== statusFilter) return false;
      return matchesSearch;
    }
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <Input
            placeholder="Search projects or clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-[250px]"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {uniqueStatuses.map((status) => (
                <SelectItem key={status} value={status}>
                  {status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4" /> Add Project
          </Button>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingId ? "Edit Project" : "Add Project"}
                </DialogTitle>
                <DialogDescription>
                  {editingId
                    ? "Make changes to your project here."
                    : "Create a new project for a client."}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Project Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    disabled={isSowSigned}
                    placeholder="Website Redesign"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="client">Client</Label>
                  <Select value={clientId} onValueChange={setClientId} required disabled={isSowSigned}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deadline">Deadline (Optional)</Label>
                  <Input
                    id="deadline"
                    type="date"
                    value={deadline}
                    disabled={isSowSigned}
                    onChange={(e) => setDeadline(e.target.value)}
                    onClick={(e) => e.currentTarget.showPicker()}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="terms">
                      {isSowLocked || isSowSigned ? "Terms & Conditions (SOW/Contract) - Locked" : "Terms & Conditions (SOW/Contract)"}
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsTosEditorOpen(true)}
                      className="h-6 px-2 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/50"
                    >
                      <Maximize2 className="w-3 h-3 mr-1" />
                      {isSowLocked || isSowSigned ? "Full Screen View" : "Full Screen Edit"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    If provided, the client must digitally accept these terms
                    before they can pay the invoice.
                  </p>

                  <div className="mb-2">
                    <Select
                      disabled={sowTemplates.length === 0 || isSowLocked || isSowSigned}
                      onValueChange={(val) => {
                        if (!val) return;
                        const tpl = sowTemplates.find(t => t.id === val);
                        if (tpl) {
                          if (terms) {
                            setSowTemplateConfirm(tpl.content);
                          } else {
                            setTerms(tpl.content);
                          }
                        }
                      }}
                    >
                      <SelectTrigger className="text-sm h-8 mt-1 border-dashed bg-slate-50 dark:bg-slate-900 border-slate-300">
                        <SelectValue placeholder={sowTemplates.length === 0 ? "No templates created yet" : "Load from Template..."} />
                      </SelectTrigger>
                      <SelectContent>
                        {sowTemplates.map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <textarea
                    id="terms"
                    rows={4}
                    value={terms}
                    disabled={isSowLocked || isSowSigned}
                    onChange={(e) => setTerms(e.target.value)}
                    className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="e.g. 1. Revisions are limited to 2 rounds. 2. Payments are non-refundable."
                  />
                  {(isSowLocked || isSowSigned) && (
                    <p className="text-[10px] text-amber-600 font-medium">
                      Terms cannot be edited because {isSowSigned ? "the client has already signed the SOW" : "a payment has already been made"}.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {(hasInvoices || isSowSigned) && (
                    <div className="col-span-full p-3 bg-amber-50 text-amber-800 text-sm border border-amber-200 rounded-md">
                      <strong>Note:</strong> Financial fields (Currency, Pricing, Tax, and Items) are locked. {isSowSigned ? "The SOW has already been signed by the client." : "An invoice has already been generated. Delete the unpaid invoice to modify them."}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Select value={currency} onValueChange={setCurrency} disabled={hasInvoices}>
                      <SelectTrigger>
                        <SelectValue placeholder="Currency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="IDR">IDR</SelectItem>
                        <SelectItem value="USD" disabled>
                          USD (Pending feature)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Label htmlFor="language">Language</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>This language is used for generating invoices and statements of work (SOW) translations.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger className="truncate">
                        <SelectValue placeholder="Language" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="id">🇮🇩 ID</SelectItem>
                        <SelectItem value="en">🇬🇧 EN</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="totalPrice">Total Price</Label>
                  </div>
                    <NumericFormat
                      id="totalPrice"
                      value={
                        items.length > 0
                          ? items.reduce(
                            (sum, item) => sum + Number(item.price),
                            0,
                          )
                          : totalPrice
                      }
                      onValueChange={(values) => setTotalPrice(values.value)}
                      required
                      disabled={items.length > 0 || hasInvoices || isSowSigned}
                      placeholder={
                        items.length > 0 ? "Auto-calculated" : "1,000"
                      }
                      thousandSeparator="."
                      decimalSeparator=","
                      prefix={currency === "IDR" ? "Rp " : "$ "}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dpAmount">DP Amount (Optional)</Label>
                    <NumericFormat
                      id="dpAmount"
                      value={dpAmount}
                      onValueChange={(values) => setDpAmount(values.value)}
                      disabled={hasInvoices || isSowSigned}
                      placeholder="Enter DP Amount"
                      thousandSeparator="."
                      decimalSeparator=","
                      prefix={currency === "IDR" ? "Rp " : "$ "}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="taxName">Tax Name {Number(taxRate) > 0 ? "" : "(Optional)"}</Label>
                    <Input
                      id="taxName"
                      value={taxName}
                      onChange={(e) => setTaxName(e.target.value)}
                      placeholder="e.g. PPN, VAT"
                      required={Number(taxRate) > 0}
                      disabled={hasInvoices || isSowSigned}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="taxRate">Tax Rate % (Optional)</Label>
                    <NumericFormat
                      id="taxRate"
                      value={taxRate}
                      onValueChange={(values) => setTaxRate(values.value)}
                      disabled={hasInvoices || isSowSigned}
                      placeholder="e.g. 11"
                      allowNegative={false}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-2 border-t mt-4 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="mr-2">
                      <Label>
                        Project Scope / Items {editingId ? "" : "(Optional)"}
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Adding items will automatically calculate the Total Price.
                      </p>
                    </div>
                    {!hasInvoices && !isSowSigned && (
                      <CostEstimator currency={currency} onApply={async (generatedItems) => {
                        if (editingId) {
                          setIsLoading(true);
                          try {
                            let updatedItems = [...items];
                            let currentTotal = Number(totalPrice);
                            for (const gItem of generatedItems) {
                              const res = await fetch(`/api/projects/${editingId}/items`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  description: gItem.description,
                                  price: gItem.price,
                                  quantity: gItem.quantity,
                                  rate: gItem.rate,
                                }),
                              });
                              if (res.ok) {
                                const data = await res.json();
                                updatedItems.push({
                                  id: data.item.id,
                                  description: data.item.description,
                                  price: String(data.item.price),
                                  quantity: data.item.quantity ? String(data.item.quantity) : null,
                                  rate: data.item.rate ? String(data.item.rate) : null,
                                });
                                currentTotal = data.projectTotal;
                              }
                            }
                            setItems(updatedItems);
                            setTotalPrice(String(currentTotal));
                            toast.success("Estimated items created successfully");
                          } catch (err) {
                            toast.error("Failed to save estimated items");
                          } finally {
                            setIsLoading(false);
                          }
                        } else {
                          setItems([...items, ...generatedItems]);
                        }
                      }} />
                    )}
                  </div>

                  {items.length > 0 && (
                    <div className="flex flex-col gap-2 mb-3">
                      {items.map((item, idx) => (
                        <div
                          key={item.id || idx}
                          className="flex justify-between items-center text-sm border p-2 rounded-md bg-muted/20"
                        >
                          <span className="flex-1 truncate pr-2">
                            {item.description}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="font-medium text-xs">
                              {item.quantity && item.rate ? `${item.quantity} x ${formatCurrency(item.rate, currency)} = ` : ""}
                              {formatCurrency(item.price, currency)}
                            </span>
                            <button
                              type="button"
                              onClick={async () => {
                                if (hasInvoices || isSowSigned) return;
                                if (editingId && item.id) {
                                  setItemRemoveConfirm({ idx, item });
                                } else {
                                  setItems(items.filter((_, i) => i !== idx));
                                  toast.success("Item removed");
                                }
                              }}
                              className="text-red-500 hover:text-red-700 text-[10px] font-bold px-1 disabled:opacity-50"
                              title="Remove"
                              disabled={hasInvoices || isSowSigned}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-col md:grid md:grid-cols-[3fr_1fr_1.5fr_1.5fr_auto] gap-2 md:items-start items-stretch">
                    <Input
                      placeholder="Task description..."
                      value={newItemDesc}
                      onChange={(e) => setNewItemDesc(e.target.value)}
                      disabled={hasInvoices || isSowSigned}
                      maxLength={120}
                      className="text-sm h-9"
                    />
                    <Input
                      type="number"
                      placeholder="Qty"
                      value={newItemQty}
                      onChange={(e) => setNewItemQty(e.target.value)}
                      disabled={hasInvoices || isSowSigned}
                      className="text-sm h-9"
                    />
                    <NumericFormat
                      value={newItemRate}
                      onValueChange={(values) => setNewItemRate(values.value)}
                      disabled={hasInvoices || isSowSigned}
                      placeholder="Rate"
                      thousandSeparator="."
                      decimalSeparator=","
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <NumericFormat
                      value={newItemPrice}
                      onValueChange={(values) => setNewItemPrice(values.value)}
                      disabled={hasInvoices || isSowSigned}
                      placeholder="Total Price"
                      thousandSeparator="."
                      decimalSeparator=","
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={!newItemDesc || !newItemPrice || hasInvoices || isSowSigned}
                      onClick={async () => {
                        if (editingId) {
                          try {
                            const res = await fetch(
                              `/api/projects/${editingId}/items`,
                              {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  description: newItemDesc,
                                  price: newItemPrice,
                                  quantity: newItemQty || null,
                                  rate: newItemRate || null,
                                }),
                              },
                            );
                            if (res.ok) {
                              const data = await res.json();
                              setItems([
                                ...items,
                                {
                                  id: data.item.id,
                                  description: data.item.description,
                                  price: String(data.item.price),
                                  quantity: data.item.quantity ? String(data.item.quantity) : null,
                                  rate: data.item.rate ? String(data.item.rate) : null,
                                },
                              ]);
                              setTotalPrice(String(data.projectTotal));
                              setNewItemDesc("");
                              setNewItemQty("");
                              setNewItemRate("");
                              setNewItemPrice("");
                            } else {
                              const errData = await res
                                .json()
                                .catch(() => ({}));
                              toast.error(
                                errData.error || "Failed to add item.",
                              );
                            }
                          } catch {
                            toast.error("Network error");
                          }
                        } else {
                          setItems([
                            ...items,
                            {
                              description: newItemDesc,
                              price: newItemPrice,
                              quantity: newItemQty || null,
                              rate: newItemRate || null
                            },
                          ]);
                          setNewItemDesc("");
                          setNewItemQty("");
                          setNewItemRate("");
                          setNewItemPrice("");
                        }
                      }}
                      className="h-9 whitespace-nowrap"
                    >
                      Add
                    </Button>
                  </div>
                </div>

                <DialogFooter>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? "Saving..." : "Save changes"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Invoice Generation Dialog */}
          <Dialog
            open={isInvoiceDialogOpen}
            onOpenChange={setIsInvoiceDialogOpen}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate Invoice</DialogTitle>
                <DialogDescription>
                  Create an invoice for {invoiceProject?.title}.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleGenerateInvoice} className="space-y-4">
                {invoiceProject &&
                  (() => {
                    const calc = getInvoiceCalculation(invoiceProject);
                    return (
                      <div className="space-y-4">
                        <p className="text-sm font-medium">
                          Select Payment Type:
                        </p>

                        <div className="flex flex-col gap-3">
                          {invoiceProject.dpAmount &&
                            Number(invoiceProject.dpAmount) > 0 &&
                            !calc.hasDpInvoice && (
                              <label className="flex items-center gap-2 cursor-pointer p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                                <input
                                  type="radio"
                                  name="invoiceType"
                                  value="dp"
                                  checked={invoiceType === "dp"}
                                  onChange={() => setInvoiceType("dp")}
                                  className="w-4 h-4"
                                />
                                <div className="flex-1">
                                  <div className="font-medium inline-block pr-2">
                                    Down Payment
                                  </div>
                                  <Badge variant="outline">
                                    {formatCurrency(
                                      invoiceProject.dpAmount,
                                      invoiceProject.currency,
                                    )}
                                  </Badge>
                                </div>
                              </label>
                            )}

                          {!calc.hasFullInvoice && (
                            <label className="flex items-center gap-2 cursor-pointer p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                              <input
                                type="radio"
                                name="invoiceType"
                                value="full_payment"
                                checked={invoiceType === "full_payment"}
                                onChange={() => setInvoiceType("full_payment")}
                                className="w-4 h-4"
                              />
                              <div className="flex-1">
                                <div className="font-medium inline-block pr-2">
                                  Full Payment {calc.isDpPaid && "(Balance)"}
                                </div>
                                <Badge variant="outline">
                                  {formatCurrency(
                                    calc.fullPaymentAmount,
                                    invoiceProject.currency,
                                  )}
                                </Badge>
                              </div>
                            </label>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsInvoiceDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? "Generating..." : "Generate Invoice"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* SOW Template Overwrite Dialog */}
          <ConfirmDialog
            open={sowTemplateConfirm !== null}
            onOpenChange={(open) => !open && setSowTemplateConfirm(null)}
            title="Overwrite Terms?"
            description="This will overwrite your existing terms and conditions. Do you want to proceed?"
            confirmLabel="Overwrite"
            onConfirm={() => {
              if (sowTemplateConfirm) {
                setTerms(sowTemplateConfirm);
                setSowTemplateConfirm(null);
              }
            }}
          />

          {/* Full Screen TOS Editor Dialog */}
          <Dialog open={isTosEditorOpen} onOpenChange={setIsTosEditorOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-slate-50 dark:bg-zinc-950">
              <div className="flex items-center justify-between px-6 py-4 border-b bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg border border-indigo-100 dark:border-indigo-500/20">
                    <NotepadTextDashed className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <DialogTitle className="text-lg">
                      {isSowLocked || isSowSigned ? "Contract Viewer" : "Contract Editor"}
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                      {isSowLocked || isSowSigned
                        ? "Viewing the signed terms of service or scope of work."
                        : "Write your terms of service or scope of work using Markdown."}
                    </DialogDescription>
                  </div>
                </div>
                {/* Menambahkan mr-8 agar tidak menabrak tombol X (close) bawaan Dialog */}
                <div className="flex bg-slate-100 dark:bg-zinc-800/50 p-1 rounded-lg border border-slate-200 dark:border-zinc-700/50 mr-8 sm:mr-10">
                  <button
                    onClick={() => setIsTosPreview(false)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${!isTosPreview
                      ? 'bg-white dark:bg-zinc-700 shadow-sm text-slate-900 dark:text-zinc-100'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300'}`}
                  >
                    Write
                  </button>
                  <button
                    onClick={() => setIsTosPreview(true)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${isTosPreview
                      ? 'bg-white dark:bg-zinc-700 shadow-sm text-slate-900 dark:text-zinc-100'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300'}`}
                  >
                    Preview
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-hidden flex flex-col items-stretch min-h-[50vh]">
                {isTosPreview ? (
                  <div className="flex-1 overflow-y-auto p-6 lg:px-12 bg-slate-50 dark:bg-zinc-950">
                    <div className="prose prose-sm md:prose-base prose-slate dark:prose-invert max-w-3xl mx-auto prose-headings:font-semibold prose-a:text-indigo-600 dark:prose-a:text-indigo-400 text-slate-700 dark:text-zinc-300 leading-relaxed text-justify">
                      {terms ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} rehypePlugins={[rehypeSanitize]}>
                          {terms}
                        </ReactMarkdown>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-40 opacity-50">
                          <span className="italic">No content provided yet.</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <Textarea
                    className="flex-1 font-mono text-sm leading-relaxed p-6 rounded-none border-0 focus-visible:ring-0 resize-none bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200"
                    value={terms}
                    disabled={isSowLocked || isSowSigned}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setTerms(e.target.value)}
                    placeholder="Write your contract using Markdown here..."
                  />
                )}
              </div>

              <div className="flex justify-end gap-2 px-6 py-4 border-t bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800">
                <Button variant="outline" onClick={() => setIsTosEditorOpen(false)}>
                  Done
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Mobile View: Cards */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {filteredProjects.length === 0 ? (
          <Card className="text-center py-8">
            <CardContent className="flex flex-col items-center justify-center gap-3">
              <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground/50">
                <FileText className="h-8 w-8" />
              </div>
              <h3 className="font-semibold text-lg">No Projects Found</h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery
                  ? `We couldn't find any projects matching "${searchQuery}".`
                  : "You haven't added any projects yet."}
              </p>
              {!searchQuery && (
                <Button
                  onClick={() => handleOpenDialog()}
                  variant="outline"
                  className="mt-2"
                >
                  <Plus className="mr-2 h-4 w-4" /> Add Your First Project
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredProjects.map((project) => (
            <Card key={project.id} className="overflow-hidden">
              <CardHeader className="border-b border-border/50">
                <CardTitle className="flex flex-col gap-2 text-base">
                  <div className="flex justify-between items-start">
                    <span className="truncate pr-4 font-bold">{project.title}</span>
                    <Badge variant="secondary" className="capitalize shrink-0 text-[10px] px-2 py-0">
                      {project.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <span className="text-sm font-normal text-muted-foreground truncate">{project.client.name}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-3">
                <div className="flex justify-between items-center text-muted-foreground border-b border-border/50 pb-2">
                  <span>Price</span>
                  <span className="font-medium text-foreground">{formatCurrency(project.totalPrice, project.currency)}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 pb-2 border-b border-border/50">
                  <div className="flex flex-col pb-2">
                    <span className="text-xs text-muted-foreground">Deadline</span>
                    <span className="font-medium">{project.deadline ? new Date(project.deadline).toLocaleDateString("en-US") : "-"}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground">Terms</span>
                    <span className="pt-0.5">
                      {!project.terms ? (
                        <span className="text-muted-foreground text-xs italic">
                          None
                        </span>
                      ) : project.termsAcceptedAt ? (
                        <Badge
                          variant="outline"
                          className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0 h-5"
                        >
                          Accepted
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="bg-yellow-50 text-yellow-700 border-yellow-200 text-[10px] px-1.5 py-0 h-5"
                        >
                          Pending
                        </Badge>
                      )}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 mr-2"
                    disabled={getInvoiceCalculation(project).hasFullInvoice}
                    onClick={() => handleOpenInvoiceDialog(project)}
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    Invoice
                  </Button>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenDialog(project)}
                      className="h-8 w-8"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteConfirmId(project.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Desktop View: Table */}
      <div className="hidden md:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Deadline</TableHead>
              <TableHead>Total Price</TableHead>
              <TableHead>DP Amount</TableHead>
              <TableHead>Terms</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProjects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-64 text-center">
                  <div className="flex flex-col items-center justify-center gap-3 py-8">
                    <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground/50">
                      <FileText className="h-8 w-8" />
                    </div>
                    <h3 className="font-semibold text-lg">No Projects Found</h3>
                    <p className="text-sm text-muted-foreground max-w-sm">
                      {searchQuery
                        ? `We couldn't find any projects matching "${searchQuery}".`
                        : "You haven't added any projects yet. Create your first project to start tracking work."}
                    </p>
                    {!searchQuery && (
                      <Button
                        onClick={() => handleOpenDialog()}
                        variant="outline"
                        className="mt-2"
                      >
                        <Plus className="mr-2 h-4 w-4" /> Add Your First Project
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredProjects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell className="font-medium">{project.title}</TableCell>
                  <TableCell>{project.client.name}</TableCell>
                  <TableCell>
                    {project.deadline
                      ? new Date(project.deadline).toLocaleDateString("en-US")
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {formatCurrency(project.totalPrice, project.currency)}
                  </TableCell>
                  <TableCell>
                    {project.dpAmount && Number(project.dpAmount) > 0
                      ? formatCurrency(project.dpAmount, project.currency)
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {!project.terms ? (
                      <span className="text-muted-foreground text-xs italic">
                        None
                      </span>
                    ) : project.termsAcceptedAt ? (
                      <Badge
                        variant="outline"
                        className="bg-emerald-50 text-emerald-700 border-emerald-200"
                      >
                        Accepted
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs py-0"
                      >
                        Pending Signature
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="capitalize">
                    {project.status.replace("_", " ")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={getInvoiceCalculation(project).hasFullInvoice}
                      onClick={() => handleOpenInvoiceDialog(project)}
                      title={
                        getInvoiceCalculation(project).hasFullInvoice
                          ? "All invoices generated"
                          : "Generate Invoice"
                      }
                    >
                      <FileText
                        className={`h-4 w-4 ${getInvoiceCalculation(project).hasFullInvoice ? "text-gray-400" : "text-blue-600"}`}
                      />
                      <span className="sr-only">Generate Invoice</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenDialog(project)}
                    >
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">Edit</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteConfirmId(project.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete Project Confirmation */}
      <ConfirmDialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
        title="Delete Project?"
        description="This will permanently delete this project and all its invoices. This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteConfirmId) {
            handleDelete(deleteConfirmId);
            setDeleteConfirmId(null);
          }
        }}
      />

      {/* Remove Item Confirmation */}
      <ConfirmDialog
        open={!!itemRemoveConfirm}
        onOpenChange={(open) => !open && setItemRemoveConfirm(null)}
        title="Remove Item?"
        description="This will remove this deliverable from the project scope and adjust the total price."
        confirmLabel="Remove"
        onConfirm={async () => {
          if (itemRemoveConfirm && editingId && itemRemoveConfirm.item.id) {
            try {
              const res = await fetch(
                `/api/projects/${editingId}/items/${itemRemoveConfirm.item.id}`,
                { method: "DELETE" },
              );
              if (res.ok) {
                const data = await res.json();
                setItems(items.filter((_, i) => i !== itemRemoveConfirm.idx));
                setTotalPrice(String(data.projectTotal));
                toast.success("Item removed");
              } else {
                const errData = await res.json().catch(() => ({}));
                toast.error(errData.error || "Failed to delete item.");
              }
            } catch {
              toast.error("Network error");
            }
          }
          setItemRemoveConfirm(null);
        }}
      />
    </div >
  );
}
