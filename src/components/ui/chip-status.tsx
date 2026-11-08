import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Status chip for event cards and lists. Pre-set tones carry meaning:
 * ok = player's prediction is in, hot = lock imminent, gold = featured win.
 * Contrasts audited ≥ WCAG AA on both themes.
 */
export type ChipTone = "neutral" | "brand" | "gold" | "ok" | "hot" | "ghost";

const toneStyle: Record<ChipTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  brand: "bg-brand-soft text-brand-ink",
  gold: "bg-gold-soft text-gold-ink",
  ok: "bg-success-soft text-success-ink",
  hot: "bg-primary text-primary-foreground",
  ghost: "bg-muted text-foreground/85",
};

export function ChipStatus({
  tone = "neutral",
  children,
  className,
}: {
  tone?: ChipTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold",
        toneStyle[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
