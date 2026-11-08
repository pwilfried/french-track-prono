import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { daysUntil, type CompetitionScope } from "@/domain/competition";

import { currentDay, loadCompetitions } from "../competition";
import { paramList } from "../search-params";
import { messages } from "../messages.fr";

const SCOPES: CompetitionScope[] = ["international", "france"];

const tab = (on: boolean) =>
  `flex min-h-11 items-center justify-center rounded-full font-semibold ${
    on ? "bg-brand text-white" : "text-muted-foreground"
  }`;

/**
 * The competitions of one kind (board v0.9 « Choix »): the coming ones to tick for a league (the
 * form opens the league creation with them), then the finished ones.
 */
export default async function CompetitionsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; competition?: string | string[] }>;
}) {
  const search = await searchParams;
  const scope: CompetitionScope = search.type === "france" ? "france" : "international";
  const ticked = new Set(paramList(search.competition));
  const today = currentDay();
  const all = await loadCompetitions();
  const coming = all.coming.filter((c) => c.scope === scope);
  const past = all.past.filter((c) => c.scope === scope);
  // Competitions of the other kind already chosen stay in the league.
  const kept = all.coming.filter((c) => c.scope !== scope && ticked.has(c.slug));

  return (
    <main id="main" className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-5">
      <Link href="/" className="inline-flex min-h-11 items-center self-start font-semibold">
        ‹ {messages.choice.back}
      </Link>
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-3xl font-extrabold leading-tight">
          {messages.choice.title[scope]}
        </h1>
        <p className="text-[15px] leading-relaxed text-muted-foreground">{messages.choice.intro}</p>
      </div>

      <nav
        aria-label={messages.choice.tabsLabel}
        className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1"
      >
        {SCOPES.map((s) => {
          const query = new URLSearchParams({ type: s });
          for (const slug of ticked) query.append("competition", slug);
          return (
            <Link
              key={s}
              href={`/competitions?${query}`}
              aria-current={s === scope ? "page" : undefined}
              className={tab(s === scope)}
            >
              {messages.choice.tab[s]}
            </Link>
          );
        })}
      </nav>

      <form method="get" action="/ligues/creer" className="flex flex-col gap-3">
        {kept.map((c) => (
          <input key={c.slug} type="hidden" name="competition" value={c.slug} />
        ))}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {messages.choice.coming}
          </legend>
          {coming.length === 0 && (
            <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">
              {messages.choice.noneComing}
            </p>
          )}
          {coming.map((c) => (
            <label
              key={c.slug}
              className="flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl border-2 border-border bg-card px-3.5 py-2.5 has-[:checked]:border-brand has-[:checked]:bg-brand-soft"
            >
              <input
                type="checkbox"
                name="competition"
                value={c.slug}
                defaultChecked={ticked.has(c.slug)}
                className="size-5 shrink-0 accent-brand"
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-bold">{c.name}</span>
                <span className="text-sm text-muted-foreground">
                  {[c.place, messages.start.events(c.finals)].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className="font-mono text-xs font-bold text-muted-foreground">
                {messages.choice.startsIn(daysUntil(c.startsOn, today))}
              </span>
            </label>
          ))}
        </fieldset>
        {coming.length > 0 && (
          <button type="submit" className={buttonVariants({ size: "lg" })}>
            {messages.choice.submit}
          </button>
        )}
      </form>

      {past.length > 0 && (
        <section aria-labelledby="past" className="flex flex-col gap-2">
          <h2
            id="past"
            className="border-b border-border pb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground"
          >
            {messages.choice.past}
          </h2>
          <ul className="flex flex-col gap-2">
            {past.map((c) => (
              <li
                key={c.slug}
                className="flex min-h-14 items-center gap-3 rounded-2xl bg-muted px-3.5 py-2"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold">{c.name}</span>
                  <span className="text-sm text-muted-foreground">{messages.choice.pastHint}</span>
                </span>
                <Link
                  href={`/competitions/${c.slug}`}
                  aria-label={messages.choice.seeLabel(c.name)}
                  className="inline-flex min-h-11 items-center font-bold"
                >
                  {messages.choice.see}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
