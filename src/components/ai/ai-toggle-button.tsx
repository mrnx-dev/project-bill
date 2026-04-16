"use client";

import { Button } from "@/components/ui/button";
import { Bot, X } from "lucide-react";

interface AIToggleButtonProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function AIToggleButton({ isOpen, onToggle }: AIToggleButtonProps) {
  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={onToggle}
        className="gap-2 w-full"
      >
        <Bot className="h-4 w-4" />
        AI Assistant
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onToggle}
      className="gap-2 w-full text-muted-foreground hover:text-foreground"
    >
      <X className="h-4 w-4" />
      Tutup
    </Button>
  );
}
