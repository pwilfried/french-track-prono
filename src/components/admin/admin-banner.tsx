import { cn } from "@/lib/utils";

/**
 * Red "Back-office" band pinned above the appbar on every admin screen.
 * Compact variant drops the right-side admin login (for narrow phone widths).
 * Pulsing dot respects prefers-reduced-motion via the global CSS rule.
 */
export function AdminBanner({
  adminName,
  view,
  className,
}: {
  adminName?: string;
  /** Short context label shown on the right ("saisie startlist", "scoring run"...). */
  view?: string;
  className?: string;
}) {
  const right = adminName ?? view;
  return (
    <div
      role="status"
      aria-label="Zone back-office"
      className={cn(
        "flex shrink-0 items-center justify-between gap-2 bg-primary px-4 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-primary-foreground",
        className,
      )}
    >
      <span className="inline-flex items-center gap-2">
        <span
          aria-hidden="true"
          className="inline-block size-1.5 animate-pulse rounded-full bg-primary-foreground motion-reduce:animate-none"
        />
        Back-office
      </span>
      {right && <span className="font-mono text-[10px] font-semibold">{right}</span>}
    </div>
  );
}
