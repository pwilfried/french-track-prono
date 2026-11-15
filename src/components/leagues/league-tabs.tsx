import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * The tab bar of a league page, prediction (#552) or Manager (#875): links, the active one marked
 * `aria-current`, clearly seen in light and dark.
 */
export function LeagueTabs({
  label,
  tabs,
}: {
  /** Names the bar: the league's name. */
  label: string;
  tabs: { href: string; label: string; active: boolean }[];
}) {
  return (
    <nav className="-mx-4 flex gap-2 overflow-x-auto px-4" aria-label={label}>
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          className={cn(
            "inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-4 font-semibold",
            t.active
              ? "bg-brand text-brand-foreground dark:bg-secondary dark:text-secondary-foreground"
              : "border border-border bg-background text-foreground",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
