import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** The Manager stadium (#427): a red running track around a green field that holds the places. */
export function Stadium({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="rounded-[2.5rem] bg-track p-3 shadow-inner">
      <div className={cn("rounded-[2rem] bg-field p-3", className)}>{children}</div>
    </div>
  );
}

/** The places of the stadium, as many columns as on the lineup board. */
export const STADIUM_GRID = "grid grid-cols-4 gap-2 sm:gap-3 md:grid-cols-8";

/** An empty place: its family, dashed on the grass. */
export function EmptyPlace({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid aspect-[3/4] place-items-center rounded-xl border-2 border-dashed p-1 text-center text-[11px] font-bold leading-tight",
        className,
      )}
    >
      <span>
        {label}
        {children}
      </span>
    </div>
  );
}
