import Link from "next/link";

import { CreateLeagueForm } from "@/components/leagues/league-forms";
import { LeagueHero } from "@/components/leagues/league-hero";
import { isOpenToLeagues } from "@/domain/league";

import { loadCompetitions } from "../../competition";
import { paramList } from "../../search-params";
import { messages } from "../../messages.fr";
import { leaguePorts } from "../data";

/** The query string of the page with these competitions. */
const withCompetitions = (slugs: string[]) =>
  new URLSearchParams(slugs.map((slug) => ["competition", slug])).toString();

/**
 * League creation (board v0.9 « Créer la ligue »): its name and its competitions, the ones ticked
 * on the choice page. At least one, not finished (#614): a finished one is left out, and the form
 * stays disabled while none is chosen.
 */
export default async function CreateLeaguePage({
  searchParams,
}: {
  searchParams: Promise<{ competition?: string | string[]; publique?: string }>;
}) {
  const params = await searchParams;
  const asked = [...new Set(paramList(params.competition))];
  await leaguePorts(asked.length ? `/ligues/creer?${withCompetitions(asked)}` : "/ligues/creer");
  const { coming } = await loadCompetitions();
  const now = new Date().toISOString();
  const chosen = coming.filter((c) => asked.includes(c.slug) && isOpenToLeagues(c, now));
  const slugs = chosen.map((c) => c.slug);
  const scope = chosen[0]?.scope ?? "international";

  return (
    <main id="main" className="flex flex-1 flex-col">
      <LeagueHero
        title={messages.leagues.createTitle}
        subtitle={messages.leagues.createSubtitle}
        back={{ href: "/ligues", label: messages.leagues.back }}
      />
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-6">
        <section aria-labelledby="chosen" className="flex flex-col gap-2">
          <h2
            id="chosen"
            className="text-xs font-bold uppercase tracking-wide text-muted-foreground"
          >
            {messages.leagues.chosen}
          </h2>
          {chosen.length === 0 && (
            <p className="rounded-2xl bg-muted px-3.5 py-3 text-sm text-muted-foreground">
              {messages.leagues.competitionRequired}
            </p>
          )}
          <ul aria-labelledby="chosen" className="flex flex-col gap-2">
            {chosen.map((c) => (
              <li
                key={c.slug}
                className="flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-card py-1 pl-3.5 pr-1"
              >
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold">
                  {c.scope === "france" ? "FR" : "INT"}
                </span>
                <span className="min-w-0 flex-1 font-semibold">{c.name}</span>
                <Link
                  href={`/ligues/creer?${withCompetitions(slugs.filter((s) => s !== c.slug))}`}
                  aria-label={messages.leagues.remove(c.name)}
                  className="inline-flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                >
                  ✕
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href={`/ligues/creer/competitions?type=${scope}&${withCompetitions(slugs)}`}
            className="inline-flex min-h-11 items-center self-start font-bold"
          >
            {messages.leagues.addCompetition}
          </Link>
        </section>

        <div className="flex flex-col gap-1 rounded-card bg-brand-soft p-4 text-brand-ink">
          <p className="font-bold">{messages.leagues.howTitle}</p>
          <p className="text-sm leading-relaxed">{messages.leagues.how}</p>
        </div>

        <CreateLeagueForm competitionSlugs={slugs} isPublic={params.publique === "1"} />
      </div>
    </main>
  );
}
