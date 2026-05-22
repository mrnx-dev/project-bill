"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface OrganizationData {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
}

interface OrganizationSettingsFormProps {
  organization: OrganizationData;
}

export function OrganizationSettingsForm({
  organization,
}: OrganizationSettingsFormProps) {
  const { update: updateSession } = useSession();

  const [name, setName] = useState(organization.name);
  const [isSaving, setIsSaving] = useState(false);

  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  async function handleSaveName() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Organization name cannot be empty");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/organizations/${organization.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });

      if (res.ok) {
        toast.success("Organization name updated");
        await updateSession();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to update organization name");
      }
    } catch {
      toast.error("Failed to update organization name");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (deleteConfirmName.trim() !== organization.name) {
      toast.error("Organization name does not match");
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/organizations/${organization.id}/delete`, {
        method: "POST",
      });

      if (res.ok) {
        toast.success("Organization scheduled for deletion");
        window.location.href = "/";
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to delete organization");
      }
    } catch {
      toast.error("Failed to delete organization");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      {/* Name Section */}
      <Card>
        <CardHeader>
          <CardTitle>Organization Name</CardTitle>
          <CardDescription>
            Update the display name for your organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="org-name">Name</Label>
            <div className="flex items-center gap-3">
              <Input
                id="org-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Organization name"
                className="max-w-md"
              />
              <Button
                onClick={handleSaveName}
                disabled={
                  isSaving || name.trim() === organization.name || !name.trim()
                }
              >
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-500/50">
        <CardHeader>
          <CardTitle className="text-red-500">Danger Zone</CardTitle>
          <CardDescription>
            Irreversible actions that affect your entire organization. Proceed
            with caution.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between rounded-lg border border-red-500/30 p-4">
              <div>
                <p className="font-medium">Delete Organization</p>
                <p className="text-sm text-muted-foreground">
                  Permanently delete this organization and all associated data.
                  This action cannot be undone.
                </p>
              </div>
              <AlertDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
              >
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">Delete Organization</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Are you absolutely sure?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete
                      the organization{" "}
                      <span className="font-semibold">{organization.name}</span>{" "}
                      and all of its data.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-org-name">
                      Type{" "}
                      <span className="font-semibold">{organization.name}</span>{" "}
                      to confirm
                    </Label>
                    <Input
                      id="confirm-org-name"
                      value={deleteConfirmName}
                      onChange={(e) => setDeleteConfirmName(e.target.value)}
                      placeholder={organization.name}
                    />
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel
                      onClick={() => setDeleteConfirmName("")}
                    >
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onClick={handleDelete}
                      disabled={
                        isDeleting ||
                        deleteConfirmName.trim() !== organization.name
                      }
                    >
                      {isDeleting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        "Delete Organization"
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}