"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";

interface UpgradeDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  resourceName: string;
  limit: number;
}

export function UpgradeDialog({ isOpen, onOpenChange, resourceName, limit }: UpgradeDialogProps) {
  const router = useRouter();

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-500 mb-2">
            <AlertTriangle className="h-5 w-5" />
            <DialogTitle>Limit Reached</DialogTitle>
          </div>
          <DialogDescription className="text-base text-foreground">
            You have reached the limit for <strong>{resourceName}</strong> on your current plan (maximum {limit === Infinity || limit > 999999 ? "unlimited" : limit}).
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 text-sm text-muted-foreground">
          Upgrade your plan to unlock higher limits and premium features like automated PDF delivery and advanced reporting.
        </div>
        <DialogFooter className="sm:justify-between items-center flex-row gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Dismiss
          </Button>
          <Button 
            className="w-full sm:w-auto"
            onClick={() => {
              onOpenChange(false);
              router.push("/settings/subscription");
            }}
          >
            View Plans
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
