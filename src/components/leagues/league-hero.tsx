import Link from "next/link";

/** Blue header of the league pages: back link, title, subtitle. */
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
    <header className="hero px-4 pb-6 pt-6">
      <div className="mx-auto max-w-md">
        {back && (
          <Link href={back.href} className="inline-flex min-h-11 items-center font-semibold">
            ‹ {back.label}
          </Link>
        )}
        <h1 className="mt-1 break-words font-display text-3xl font-extrabold uppercase leading-none">
          {title}
        </h1>
        <p className="mt-2 text-[#dce6f5]">{subtitle}</p>
      </div>
    </header>
  );
}
