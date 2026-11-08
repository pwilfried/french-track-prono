import Link from "next/link";
import type { ReactNode } from "react";

import { messages } from "../../messages.fr";

const SECTIONS = [
  ["/admin/competitions", "competitions"],
  ["/admin", "results"],
  ["/admin/athletes", "athletes"],
  ["/admin/disciplines", "disciplines"],
  ["/admin/bareme", "scale"],
  ["/admin/ligues", "leagues"],
  ["/admin/historique", "history"],
] as const;

/** The back-office band, the back link, the title and the sections bar of an admin page. */
export function AdminShell({
  title,
  back,
  section,
  children,
}: {
  title: ReactNode;
  back?: { href: string; label: string };
  section?: (typeof SECTIONS)[number][1];
  children: ReactNode;
}) {
  return (
    <main id="main" className="flex flex-1 flex-col">
      <AdminBand />
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-4">
        {back && (
          <Link
            href={back.href}
            className="inline-flex min-h-11 items-center self-start font-semibold text-brand dark:text-secondary"
          >
            ‹ {back.label}
          </Link>
        )}
        <h1 className="font-display text-3xl font-extrabold leading-tight">{title}</h1>
        {section && (
          <nav aria-label={messages.adminCompetitions.sections} className="flex flex-wrap gap-2">
            {SECTIONS.map(([href, key]) => (
              <Link
                key={key}
                href={href}
                aria-current={key === section ? "page" : undefined}
                className={
                  key === section
                    ? "inline-flex min-h-10 items-center rounded-full bg-brand px-3.5 text-sm font-bold text-brand-foreground"
                    : "inline-flex min-h-10 items-center rounded-full bg-brand-soft px-3.5 text-sm font-bold text-brand-ink"
                }
              >
                {messages.adminCompetitions.section[key]}
              </Link>
            ))}
          </nav>
        )}
        {children}
      </div>
    </main>
  );
}

/** The message of an admin action, read from the address (`?enregistre=1`, `?erreur=CODE`). */
export function ActionNotice({ saved, error }: { saved: boolean; error: string | null }) {
  if (error) {
    return (
      <p
        role="alert"
        className="rounded-2xl bg-muted px-3.5 py-3 text-sm font-semibold text-accent-text"
      >
        {error}
      </p>
    );
  }
  return saved ? (
    <p
      role="status"
      className="rounded-2xl bg-success/15 px-3.5 py-3 text-sm font-semibold text-success-text"
    >
      {messages.adminAthletes.saved}
    </p>
  ) : null;
}

/** Top of every back-office page: the red band, with a link to the site and signing out. */
export function AdminBand() {
  return (
    <div className="flex items-center justify-between gap-3 bg-primary px-4 text-primary-foreground">
      <p className="py-1 text-[11px] font-extrabold uppercase tracking-[0.14em]">
        {messages.admin.band}
      </p>
      <div className="flex items-center gap-4">
        <Link href="/" className="inline-flex min-h-11 items-center text-sm font-bold underline">
          {messages.admin.viewSite}
        </Link>
        <form action="/auth/sign-out" method="post">
          <button
            type="submit"
            className="inline-flex min-h-11 items-center text-sm font-bold underline"
          >
            {messages.admin.signOut}
          </button>
        </form>
      </div>
    </div>
  );
}
