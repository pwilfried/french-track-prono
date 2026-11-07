import Link from "next/link";

/** Header of the league pages, on the cream page: back link, title, subtitle. */
export function LeagueHero({
  title,
  subtitle,
  back,
}: {
  title: string;
  subtitle: string;
  back?: { href: string; label: string };
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
        <h1 className="mt-1 break-words font-display text-3xl font-extrabold leading-none">
          {title}
        </h1>
        <p className="mt-2 text-muted-foreground">{subtitle}</p>
      </div>
    </header>
  );
}
