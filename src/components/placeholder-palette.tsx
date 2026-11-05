"use client";
import { useState } from "react";
import { CONTRACT_PLACEHOLDERS } from "@/lib/contract-template";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import type React from "react";
// Pure insertion logic, exported for tests: slice at [start, end), caret lands after the token.
export function insertPlaceholder(
  value: string,
  token: string,
  start: number,
  end: number,
): { value: string; caret: number } {
  const from = start < 0 || start > value.length ? value.length : start;
  const to = end < from || end > value.length ? from : end;
  return { value: value.slice(0, from) + token + value.slice(to), caret: from + token.length };
}
export function PlaceholderPalette({
  textareaRef,
  value,
  onChange,
  disabled,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const insert = (token: string) => {
    if (disabled) return;
    const ref = textareaRef.current;
    const result = insertPlaceholder(value, token, ref?.selectionStart ?? -1, ref?.selectionEnd ?? -1);
    onChange(result.value);
    const caret = result.caret;
    setOpen(false);
    // The re-render replaces the textarea's value, which resets the caret; restore it
    // after React commits, otherwise the next insert lands at position 0.
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(caret, caret);
      }
    });
  };
  const groups = [...new Set(CONTRACT_PLACEHOLDERS.map((p) => p.group))];
  const chip =
    "text-xs rounded-full border border-slate-200 bg-white px-2.5 py-1 transition-transform duration-125 ease-out active:scale-[0.97] hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-300";
  const chipDisabled = "cursor-not-allowed opacity-50";
  if (disabled) {
    return (
      <Button variant="outline" size="sm" className="h-8 text-xs" disabled>
        Insert placeholder
      </Button>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs">
          Insert placeholder
          <svg className="ml-1 h-3 w-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-3">
        <div className="grid grid-cols-2 gap-3">
          {groups.map((group) => (
            <div key={group}>
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">{group}</p>
              <div className="flex flex-wrap gap-1.5">
                {CONTRACT_PLACEHOLDERS.filter((p) => p.group === group).map((p) => (
                  <button
                    key={p.token}
                    type="button"
                    title={p.label}
                    onClick={() => insert(p.token)}
                    className={chip}
                  >
                    {p.token}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
