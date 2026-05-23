"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Plus, GalleryVerticalEnd, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useUnsavedForm } from "@/hooks/use-unsaved-form";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import Link from "next/link";

interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  role: string;
}

interface OrgSwitcherProps {
  currentOrgName?: string;
  currentOrgLogo?: string | null;
  organizations?: Organization[];
  activeOrgId?: string;
}

export function OrgSwitcher({ currentOrgName, currentOrgLogo, organizations: serverOrgs, activeOrgId: serverActiveOrgId }: OrgSwitcherProps) {
  const { data: session, update } = useSession();
  const router = useRouter();
  const { confirmSwitch } = useUnsavedForm();
  const [createOpen, setCreateOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [fetchedOrgs, setFetchedOrgs] = useState<Organization[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const activeOrgId = serverActiveOrgId || session?.user?.activeOrganizationId;
  const orgs = serverOrgs && serverOrgs.length > 0 ? serverOrgs : fetchedOrgs;

  useEffect(() => {
    if (!serverOrgs || serverOrgs.length === 0) {
      fetchOrgs();
    }
  }, []);

  async function fetchOrgs() {
    try {
      const res = await fetch("/api/organizations");
      if (res.ok) {
        const data = await res.json();
        setFetchedOrgs(data);
      }
    } catch {
      console.error("Failed to fetch organizations");
    }
  }

  async function switchOrg(orgId: string) {
    if (!confirmSwitch()) return;
    if (orgId === activeOrgId) return;
    try {
      const res = await fetch(`/api/organizations/${orgId}/switch`, { method: "POST" });
      if (res.status === 401) {
        router.push(`/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      if (res.status === 403) {
        toast.error("Access denied. You are not a member of this organization.");
        return;
      }
      if (!res.ok) {
        toast.error("Connection error. Please try again.");
        return;
      }
      const data = await res.json();
      await update({ activeOrganizationId: orgId, activeOrganizationRole: data.activeOrganizationRole });
      router.refresh();
    } catch {
      toast.error("Connection error. Please try again.");
    }
  }

  async function createOrg() {
    if (!newOrgName.trim()) return;
    setIsCreating(true);
    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newOrgName.trim() }),
      });
      if (res.ok) {
        const org = await res.json();
        await update({ activeOrganizationId: org.id, activeOrganizationRole: "OWNER" });
        setCreateOpen(false);
        setNewOrgName("");
        router.refresh();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to create organization");
      }
    } catch {
      toast.error("Failed to create organization");
    } finally {
      setIsCreating(false);
    }
  }

  const activeOrg = orgs.find((o) => o.id === activeOrgId);
  const displayName = activeOrg?.name || currentOrgName || "Select organization";
  const displayLogo = activeOrg?.logoUrl || currentOrgLogo;

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground rounded-lg"
              >
                <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg overflow-hidden">
                  {displayLogo ? (
                    <img src={displayLogo} alt={displayName} className="h-full w-full object-cover" />
                  ) : (
                    <GalleryVerticalEnd className="size-4" />
                  )}
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-semibold text-base">{displayName}</span>
                </div>
                <ChevronsUpDown className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
              align="start"
              side="bottom"
              sideOffset={4}
            >
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Organizations
              </DropdownMenuLabel>
              {orgs.map((org) => (
                <div key={org.id} className="flex items-center justify-between p-2">
                  <DropdownMenuItem
                    className="gap-2 flex-1 cursor-pointer"
                    onClick={() => switchOrg(org.id)}
                  >
                    <div className="flex size-6 items-center justify-center rounded-sm border overflow-hidden">
                      {org.logoUrl ? (
                        <img src={org.logoUrl} alt={org.name} className="h-full w-full object-cover" />
                      ) : (
                        <GalleryVerticalEnd className="size-3 shrink-0" />
                      )}
                    </div>
                    <span className="truncate flex-1">{org.name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${org.role === "OWNER" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {org.role}
                    </span>
                    {org.id === activeOrgId && <Check className="size-4 shrink-0" />}
                  </DropdownMenuItem>
                  <Link
                    href="/settings/organization"
                    className="text-muted-foreground hover:text-foreground text-xs relative z-10 p-1 flex items-center justify-center rounded-sm hover:bg-muted/50 cursor-pointer"
                  >
                    <Pencil className="size-3.5" />
                  </Link>
                </div>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 p-2 cursor-pointer"
                onClick={() => setCreateOpen(true)}
              >
                <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                  <Plus className="size-4" />
                </div>
                <span className="font-medium text-muted-foreground">Create Organization</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Organization</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="orgName">Organization name</Label>
              <Input
                id="orgName"
                placeholder="My Company"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createOrg()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={createOrg} disabled={isCreating || !newOrgName.trim()}>
              {isCreating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}