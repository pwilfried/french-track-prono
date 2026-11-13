import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { UseCaseError } from "@/application/errors";
import { getLeague } from "@/application/leagues";
import { AddLeagueFamilyForm } from "@/components/leagues/league-forms";
import { LeagueEventList } from "@/components/leagues/league-event-list";
import { LeagueHero } from "@/components/leagues/league-hero";
import { addableFamilies, LEAGUE_FAMILIES } from "@/domain/league-families";
import { cn } from "@/lib/utils";

import { messages } from "../../../messages.fr";
import { leaguePorts, loadLeagueEvents } from "../../data";

const text = messages.leagues;

/**
 * « Ajouter une famille » (#613, creator only): the families already in the league are locked
 * (none is ever removed); choosing one to add previews its events: started or finished ones do
 * not count, coming ones do. The choice is a link, so the preview needs no script.
 */
export default async function AddFamilyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ famille?: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const query = await searchParams;
  const ports = await leaguePorts(`/ligues/${id}/familles`);
  let found;
  try {
    found = await getLeague(ports).execute({ leagueId: id });
  } catch (error) {
    if (error instanceof UseCaseError) notFound();
    throw error;
  }
  const { league } = found;
  const families = league.families ?? [];
  // Only the creator adds a family, and only to a league limited to families.
  if (league.ownerId !== ports.userId || families.length === 0) redirect(`/ligues/${id}`);
  const addable = addableFamilies(families);
  const chosen = addable.find((f) => f === query.famille);
  const preview = chosen
    ? await loadLeagueEvents({
        competitionSlugs: league.competitionSlugs,
        families,
        adding: chosen,
      })
    : null;

  return (
    <main id="main" className="flex flex-1 flex-col">
      <LeagueHero
        title={text.addFamilyTitle}
        subtitle={text.addFamilySubtitle}
        back={{ href: `/ligues/${id}`, label: league.name }}
      />
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-6">
        <section aria-labelledby="families" className="flex flex-col gap-2">
          <h2
            id="families"
            className="text-xs font-bold uppercase tracking-wide text-muted-foreground"
          >
            {text.familiesTitle}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {LEAGUE_FAMILIES.filter((f) => families.some((r) => r.family === f)).map((f) => (
              <li
                key={f}
                aria-label={text.lockedFamily(text.family[f])}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-primary bg-primary px-3.5 text-sm font-semibold text-primary-foreground"
              >
                <span aria-hidden>🔒</span>
                {text.family[f]}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="choose" className="flex flex-col gap-2">
          <h2
            id="choose"
            className="text-xs font-bold uppercase tracking-wide text-muted-foreground"
          >
            {text.chooseFamily}
          </h2>
          {addable.length === 0 ? (
            <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">
              {text.noFamilyToAdd}
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {addable.map((f) => (
                <li key={f}>
                  <Link
                    href={`/ligues/${id}/familles?famille=${f}`}
                    aria-current={f === chosen ? "true" : undefined}
                    className={cn(
                      "inline-flex min-h-11 items-center rounded-full border-2 px-3.5 text-sm font-semibold",
                      f === chosen
                        ? "border-primary bg-brand-soft text-brand-ink"
                        : "border-border bg-card",
                    )}
                  >
                    {text.family[f]}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {chosen && preview && (
          <>
            <LeagueEventList
              events={preview}
              variant="preview"
              title={text.previewTitle(text.family[chosen])}
            />
            <AddLeagueFamilyForm leagueId={id} family={chosen} />
          </>
        )}
      </div>
    </main>
  );
}
