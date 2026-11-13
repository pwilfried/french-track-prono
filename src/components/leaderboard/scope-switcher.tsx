"use client";

import { useState, type ComponentProps } from "react";

import { ScopeButton } from "./scope-button";
import { ScopeSheet } from "./scope-sheet";

/** The scope button of the rankings tab and the sheet it opens (#661). */
export function ScopeSwitcher({
  label,
  value,
  detail,
  ...sheet
}: { label: string; value: string; detail?: string } & Omit<
  ComponentProps<typeof ScopeSheet>,
  "open" | "onClose"
>) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ScopeButton
        label={label}
        value={value}
        detail={detail}
        expanded={open}
        onChange={() => setOpen(true)}
      />
      <ScopeSheet {...sheet} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
