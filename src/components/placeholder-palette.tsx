"use client";

import { CONTRACT_PLACEHOLDERS } from "@/lib/contract-template";
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
  const insert = (token: string) => {
    if (disabled) return;
    const ref = textareaRef.current;
    const result = insertPlaceholder(value, token, ref?.selectionStart ?? -1, ref?.selectionEnd ?? -1);
    onChange(result.value);
    // The re-render replaces the textarea's value, which resets the caret; restore it
    // after React commits, otherwise the next insert lands at position 0.
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(result.caret, result.caret);
      }
    });
  };

  const groups = [...new Set(CONTRACT_PLACEHOLDERS.map((p) => p.group))];
  const chip =
    "text-xs rounded-full border border-slate-200 bg-white px-2.5 py-1 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-300";
  const chipDisabled = "cursor-not-allowed opacity-50";

  return (
    <div className="space-y-2">
      {groups.map((group) => (
        <div key={group}>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{group}</p>
          <div className="flex max-md:overflow-x-auto flex-wrap md:flex-wrap gap-1.5">
            {CONTRACT_PLACEHOLDERS.filter((p) => p.group === group).map((p) => (
              <button
                key={p.token}
                type="button"
                disabled={disabled}
                title={p.label}
                onClick={() => insert(p.token)}
                className={`${chip} ${disabled ? chipDisabled : ""}`}
              >
                {p.token}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
