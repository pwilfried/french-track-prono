import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * What a page shows while the server answers (#824): its frame at once, grey blocks where its
 * content will be, and the loading text for screen readers.
 */
export function PageSkeleton({ label, children }: { label: string; children: ReactNode }) {
  return (
    <main id="main" className="flex flex-1 flex-col" aria-busy="true">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-5">
        <p className="sr-only" role="status">
          {label}
        </p>
        {children}
      </div>
    </main>
  );
}

/** One grey block, pulsing unless the player asked for less motion. */
export function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("rounded-card bg-muted motion-safe:animate-pulse", className)} />
  );
}
