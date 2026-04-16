"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

interface AIChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function AIChatInput({ onSend, disabled }: AIChatInputProps) {
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (input.trim() && !disabled) {
      onSend(input.trim());
      setInput("");
    }
  };

  return (
    <div className="flex gap-2 p-3 border-t bg-background">
      <Textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
        placeholder="Ask me anything about your business..."
        className="min-h-[44px] resize-none text-sm"
        disabled={disabled}
        rows={1}
      />
      <Button onClick={handleSend} disabled={disabled || !input.trim()} size="icon" className="shrink-0 h-9 w-9">
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
