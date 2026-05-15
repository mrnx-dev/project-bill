"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Plus, GalleryVerticalEnd } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
}

export function OrgSwitcher({ currentOrgName, currentOrgLogo }: OrgSwitcherProps) {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const activeOrgId = session?.user?.activeOrganizationId;

  useEffect(() => {
    fetchOrgs();
  }, []);

  async function fetchOrgs() {
    try {
      const res = await fetch("/api/organizations");
      if (res.ok) {
        const data = await res.json();
        setOrgs(data);
      }
    } catch {
      console.error("Failed to fetch organizations");
    }
  }

  if (orgs.length <= 1 && currentOrgName) {
    return (
      <div className="flex items-center gap-2 px-2">
        <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg overflow-hidden">
          {currentOrgLogo ? (
            <img src={currentOrgLogo} alt={currentOrgName} className="h-full w-full object-cover" />
          ) : (
            <GalleryVerticalEnd className="size-4" />
          )}
        </div>
        <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
          <span className="truncate font-semibold text-base">{currentOrgName}</span>
        </div>
      </div>
    );
  }

  async function switchOrg(orgId: string) {
    try {
      const res = await fetch(`/api/organizations/${orgId}/switch`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        await update({ activeOrganizationId: orgId, activeOrganizationRole: data.activeOrganizationRole });
        setOpen(false);
        router.refresh();
      }
    } catch {
      toast.error("Failed to switch organization");
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

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between rounded-lg px-2 h-auto py-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg overflow-hidden shrink-0">
                {activeOrg?.logoUrl || currentOrgLogo ? (
                  <img src={(activeOrg?.logoUrl || currentOrgLogo)!} alt={activeOrg?.name || currentOrgName || ""} className="h-full w-full object-cover" />
                ) : (
                  <GalleryVerticalEnd className="size-4" />
                )}
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-semibold text-base">
                  {activeOrg?.name || currentOrgName || "Select organization"}
                </span>
              </div>
            </div>
            <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-50 group-data-[collapsible=icon]:hidden" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start">
          <div className="p-2">
            <p className="text-xs font-medium text-muted-foreground px-2 py-1.5">Organizations</p>
            {orgs.map((org) => (
              <Button
                key={org.id}
                variant="ghost"
                className="w-full justify-start gap-2 rounded-lg h-auto py-2 px-2"
                onClick={() => switchOrg(org.id)}
              >
                <div className="flex size-6 items-center justify-center rounded-sm border overflow-hidden shrink-0">
                  {org.logoUrl ? (
                    <img src={org.logoUrl} alt={org.name} className="h-full w-full object-cover" />
                  ) : (
                    <GalleryVerticalEnd className="size-3" />
                  )}
                </div>
                <span className="truncate flex-1 text-left">{org.name}</span>
                {org.id === activeOrgId && <Check className="size-4 shrink-0" />}
              </Button>
            ))}
          </div>
          <div className="border-t p-2">
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 rounded-lg px-2"
              onClick={() => { setOpen(false); setCreateOpen(true); }}
            >
              <Plus className="size-4" />
              Create Organization
            </Button>
          </div>
        </PopoverContent>
      </Popover>

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
