"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Bot, X } from "lucide-react";
import { AIChatPanel } from "./ai-chat-panel";

export function AIFloatingChat() {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = useCallback(() => setIsOpen((p) => !p), []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setIsOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      {/* Toggle Button */}
      <Button
        variant="default"
        size="icon"
        onClick={handleToggle}
        className="fixed bottom-5 right-5 z-50 h-12 w-12 cursor-pointer rounded-full shadow-xl"
      >
        {isOpen ? <X className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
      </Button>

      {/* Slide-over Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:bg-transparent md:backdrop-blur-none" onClick={handleToggle} />
          {/* Panel */}
          <div className="fixed bottom-0 right-0 z-50 h-[calc(100vh-4rem)] w-full md:w-[420px] md:right-4 md:bottom-4 md:rounded-xl md:border md:bg-background md:shadow-2xl">
            <AIChatPanel />
          </div>
        </>
      )}
    </>
  );
}
