"use client";

import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Pencil, Trash2, Plus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";

type Client = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export function ClientsClient({
  initialClients,
}: {
  initialClients: Client[];
}) {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleOpenDialog = (client?: Client) => {
    if (client) {
      setEditingId(client.id);
      setName(client.name);
      setEmail(client.email || "");
      setPhone(client.phone || "");
    } else {
      setEditingId(null);
      setName("");
      setEmail("");
      setPhone("");
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (editingId) {
        // Update
        const res = await fetch(`/api/clients/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email: email || null, phone: phone || null }),
        });
        if (res.ok) {
          const updated = await res.json();
          setClients(
            clients.map((c) =>
              c.id === editingId
                ? {
                  ...updated,
                  createdAt: updated.createdAt,
                  updatedAt: updated.updatedAt,
                }
                : c,
            ),
          );
        }
      } else {
        // Create
        const res = await fetch(`/api/clients`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email: email || null, phone: phone || null }),
        });
        if (res.ok) {
          const created = await res.json();
          setClients([created, ...clients]);
        }
      }
      setIsDialogOpen(false);
      router.refresh();
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
      if (res.ok) {
        setClients(clients.filter((c) => c.id !== id));
        toast.success("Client deleted");
        router.refresh();
      } else {
        toast.error("Failed to delete client");
      }
    } catch (error) {
      console.error(error);
      toast.error("Network error while deleting");
    }
  };

  const filteredClients = clients.filter(
    (client) => {
      const matchesSearch = client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (client.email && client.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (client.phone && client.phone.includes(searchQuery));
      if (statusFilter === "active" && client.isArchived) return false;
      if (statusFilter === "archived" && !client.isArchived) return false;
      return matchesSearch;
    }
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <Input
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-[250px]"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Filter..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4" /> Add Client
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingId ? "Edit Client" : "Add Client"}
                </DialogTitle>
                <DialogDescription>
                  {editingId
                    ? "Make changes to your client here."
                    : "Add a new client to your roster."}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Enter client name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contact@acme.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone / WhatsApp</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="081234567890"
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? "Saving..." : "Save changes"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Mobile View: Cards */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {filteredClients.length === 0 ? (
          <Card className="text-center py-8">
            <CardContent className="flex flex-col items-center justify-center gap-3">
              <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground/50">
                <Users className="h-8 w-8" />
              </div>
              <h3 className="font-semibold text-lg">No Clients Found</h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery
                  ? `We couldn't find any clients matching "${searchQuery}".`
                  : "You haven't added any clients yet."}
              </p>
              {!searchQuery && (
                <Button
                  onClick={() => handleOpenDialog()}
                  variant="outline"
                  className="mt-2"
                >
                  <Plus className="mr-2 h-4 w-4" /> Add Your First Client
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredClients.map((client) => (
            <Card key={client.id} className="overflow-hidden">
              <CardHeader className="border-b border-border/50">
                <CardTitle className="flex justify-between items-center text-base">
                  <span className="truncate">{client.name}</span>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenDialog(client)}
                      className="h-8 w-8"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteConfirmId(client.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium text-right truncate overflow-hidden max-w-[200px]">{client.email || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone</span>
                  <span className="font-medium">{client.phone || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span className="font-medium">{new Date(client.createdAt).toLocaleDateString("en-US")}</span>
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
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredClients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-64 text-center">
                  <div className="flex flex-col items-center justify-center gap-3 py-8">
                    <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground/50">
                      <Users className="h-8 w-8" />
                    </div>
                    <h3 className="font-semibold text-lg">No Clients Found</h3>
                    <p className="text-sm text-muted-foreground max-w-sm">
                      {searchQuery
                        ? `We couldn't find any clients matching "${searchQuery}".`
                        : "You haven't added any clients yet. Add your first client to start doing business."}
                    </p>
                    {!searchQuery && (
                      <Button
                        onClick={() => handleOpenDialog()}
                        variant="outline"
                        className="mt-2"
                      >
                        <Plus className="mr-2 h-4 w-4" /> Add Your First Client
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredClients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell>{client.email || "-"}</TableCell>
                  <TableCell>{client.phone || "-"}</TableCell>
                  <TableCell>
                    {new Date(client.createdAt).toLocaleDateString("en-US")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenDialog(client)}
                    >
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">Edit</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteConfirmId(client.id)}
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

      {/* Delete Client Confirmation */}
      <ConfirmDialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
        title="Delete Client?"
        description="If this client has paid invoices, they will be archived instead of permanently deleted."
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteConfirmId) {
            handleDelete(deleteConfirmId);
            setDeleteConfirmId(null);
          }
        }}
      />
    </div>
  );
}
