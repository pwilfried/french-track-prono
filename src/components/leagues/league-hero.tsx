import Link from "next/link";
import type { ReactNode } from "react";

/** Header of the league pages, on the cream page: back link, title, subtitle. */
export function LeagueHero({
  title,
  subtitle,
  back,
  icon,
  action,
}: {
  title: string;
  subtitle: string;
  back?: { href: string; label: string };
  /** Emoji in a rounded square left of the title (board 05: 🏆 for a league). */
  icon?: string;
  /** A small button at the top right, e.g. « Inviter » (#552). */
  action?: ReactNode;
}) {
  return (
    <header className="px-4 pb-2 pt-4">
      <div className="mx-auto max-w-md">
        {back && (
          <Link
            href={back.href}
            className="inline-flex min-h-11 items-center font-semibold text-brand dark:text-secondary"
          >
            ‹ {back.label}
          </Link>
        )}
        <div className="mt-1 flex items-center gap-3">
          {icon && (
            <span
              aria-hidden="true"
              className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gold-soft text-2xl"
            >
              {icon}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="break-words font-display text-3xl font-extrabold leading-none">
              {title}
            </h1>
            <p className="mt-1 break-words font-mono text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {action && <div className="shrink-0 self-start">{action}</div>}
        </div>
      </div>
    </header>
  );
}
