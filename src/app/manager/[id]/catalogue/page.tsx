import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { UseCaseError } from "@/application/errors";
import { getMyManagerBids } from "@/application/manager-bids";
import { browseManagerCatalogue } from "@/application/manager-catalogue";
import { getManagerLeague } from "@/application/manager-leagues";
import { getManagerRevealRounds } from "@/application/manager-reveal";
import { ErrorNotice } from "@/components/error-notice";
import { LeagueHero } from "@/components/leagues/league-hero";
import { CatalogueCard } from "@/components/manager/catalogue-card";
import { MercatoBanner } from "@/components/manager/mercato-banner";
import { CompetitionChips } from "@/components/events/competition-chips";
import { buttonVariants } from "@/components/ui/button";
import { MANAGER_FAMILIES, MANAGER_SEXES, type ManagerSex } from "@/domain/manager-rules";
import {
  createSupabaseManagerBids,
  createSupabaseManagerCatalogue,
  createSupabaseManagerReveals,
} from "@/infra";

import { messages } from "../../../messages.fr";
import { getSessionClient } from "../../../session";
import { BidForm } from "../../bid-form";
import { managerPorts } from "../../data";
import { MyBidsPanel } from "../../my-bids-panel";

const text = messages.catalogue;
const field = "min-h-11 w-full rounded-xl border-2 border-border bg-card px-2.5 text-base";

type Params = { q?: string; sexe?: string; famille?: string; libres?: string; page?: string };

/** A league the player is not in is not found; any other refusal shows as an error. */
function caught(error: unknown): "error" {
  if (!(error instanceof UseCaseError)) throw error;
  if (error.code === "LEAGUE_NOT_FOUND") notFound();
  return "error";
}

/**
 * The mercato catalogue of a league (#421): search and filters in the address, so they work
 * without script and survive a reload; a page of 30 athletes at a time. The filters are one row
 * of chips that apply at once, so the first athlete shows without scrolling on a phone (#497).
 * Before the mercato opens, a band says when and who plays; the catalogue shows without bids (#620).
 */
export default async function CataloguePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Params>;
}) {
  const { id } = await params;
  const search = await searchParams;
  const ports = await managerPorts(`/manager/${id}/catalogue`);
  const sex = MANAGER_SEXES.includes(search.sexe as ManagerSex)
    ? (search.sexe as ManagerSex)
    : null;
  const family = MANAGER_FAMILIES.find((f) => f === search.famille) ?? null;
  const availableOnly = search.libres === "1";
  const query = search.q ?? "";

  const client = await getSessionClient();
  const catalogue = createSupabaseManagerCatalogue(client);
  const [view, mine, reveals, league] = await Promise.all([
    browseManagerCatalogue({ catalogue })
      .execute({
        leagueId: id,
        query,
        filter: { sex, family, availableOnly },
        page: Number(search.page) || 1,
      })
      .catch(caught),
    getMyManagerBids({ bids: createSupabaseManagerBids(client), catalogue })
      .execute({ leagueId: id })
      .catch(caught),
    getManagerRevealRounds({ reveals: createSupabaseManagerReveals(client) })
      .execute({ leagueId: id })
      .catch(caught),
    getManagerLeague(ports).execute({ id }).catch(caught),
  ]);
  // The first visit after the close of a round opens its reveal, once (#604).
  if (reveals !== "error" && reveals.toReveal !== null) {
    redirect(`/manager/${id}/tour/${reveals.toReveal}`);
  }
  const bidOf = new Map(mine === "error" ? [] : mine.bids.map((b) => [b.athleteId, b.amount]));

  /** The address of the catalogue with some filters changed; a new filter starts at page 1. */
  const href = (
    change: Partial<{
      sex: ManagerSex | null;
      family: (typeof MANAGER_FAMILIES)[number] | null;
      availableOnly: boolean;
      page: number;
    }>,
  ) => {
    const next = { sex, family, availableOnly, page: 1, ...change };
    const params = new URLSearchParams({
      ...(query && { q: query }),
      ...(next.sex && { sexe: next.sex }),
      ...(next.family && { famille: next.family }),
      ...(next.availableOnly && { libres: "1" }),
      ...(next.page > 1 && { page: String(next.page) }),
    }).toString();
    return `/manager/${id}/catalogue${params && `?${params}`}`;
  };
  const pageHref = (page: number) => href({ page });
  const filtered = Boolean(query || sex || family || availableOnly);

  return (
    <main id="main" className="flex flex-1 flex-col">
      <LeagueHero
        title={text.title}
        subtitle={text.subtitle}
        back={{ href: `/manager/${id}`, label: messages.manager.back }}
      />
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-6 md:max-w-3xl">
        {mine === "error" ? (
          <ErrorNotice
            retryHref={`/manager/${id}/catalogue`}
            message={messages.errors.MANAGER_BIDS_UNAVAILABLE}
          />
        ) : mine.mercatoOpen || mine.mercatoClosed ? (
          <MyBidsPanel leagueId={id} bids={mine} />
        ) : league === "error" ? (
          <ErrorNotice
            retryHref={`/manager/${id}/catalogue`}
            message={messages.errors.LEAGUES_UNAVAILABLE}
          />
        ) : (
          // Before the mercato: when it opens and who plays, no bid yet (#620).
          <MercatoBanner opensAt={league.mercatoOpensAt} participants={league.participants} />
        )}
        {reveals !== "error" && reveals.rounds.length > 0 && (
          <nav aria-labelledby="round-results" className="flex flex-col gap-2">
            <h2
              id="round-results"
              className="text-xs font-bold uppercase tracking-wide text-muted-foreground"
            >
              {messages.roundReveal.roundsTitle}
            </h2>
            <ul className="flex flex-wrap gap-2">
              {reveals.rounds.map((round) => (
                <li key={round}>
                  <Link
                    href={`/manager/${id}/tour/${round}?vue=toutes`}
                    prefetch={false}
                    className={buttonVariants({ variant: "muted" })}
                  >
                    {messages.roundReveal.roundLink(round)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
        {/* The search applies on Enter and keeps the other filters (#497). */}
        <form role="search">
          <input
            type="search"
            name="q"
            aria-label={text.search}
            defaultValue={query}
            placeholder={text.searchPlaceholder}
            className={field}
          />
          {sex && <input type="hidden" name="sexe" value={sex} />}
          {family && <input type="hidden" name="famille" value={family} />}
          {availableOnly && <input type="hidden" name="libres" value="1" />}
        </form>
        <CompetitionChips
          label={text.filters}
          chips={[
            { key: "all", name: text.all, active: !family, href: href({ family: null }) },
            ...MANAGER_FAMILIES.map((f) => ({
              key: f,
              name: messages.disciplines.family[f],
              active: family === f,
              href: href({ family: family === f ? null : f }),
            })),
            ...MANAGER_SEXES.map((s) => ({
              key: s,
              name: text.sexes[s],
              active: sex === s,
              href: href({ sex: sex === s ? null : s }),
            })),
            {
              key: "available",
              name: text.availableOnly,
              active: availableOnly,
              href: href({ availableOnly: !availableOnly }),
            },
          ]}
        />

        {view === "error" ? (
          <ErrorNotice
            retryHref={`/manager/${id}/catalogue`}
            message={messages.errors.CATALOGUE_UNAVAILABLE}
          />
        ) : (
          <>
            <p role="status" className="text-sm font-semibold text-muted-foreground">
              {text.found(view.total)}
            </p>
            {view.total === 0 ? (
              <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">
                {filtered ? text.empty : text.emptyCatalogue}
              </p>
            ) : (
              <ul aria-label={text.title} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {view.rows.map((athlete) => (
                  // The tile takes the whole row while its bid form is open (#503).
                  <li key={athlete.athleteId} className="has-[form]:col-span-2">
                    <CatalogueCard athlete={athlete}>
                      {mine !== "error" && mine.mercatoOpen && athlete.available && (
                        <BidForm
                          leagueId={id}
                          athleteId={athlete.athleteId}
                          name={athlete.name}
                          price={athlete.price}
                          current={bidOf.get(athlete.athleteId) ?? null}
                        />
                      )}
                    </CatalogueCard>
                  </li>
                ))}
              </ul>
            )}
            {view.pageCount > 1 && (
              <nav className="flex items-center justify-between gap-2 text-sm font-semibold">
                {view.page > 1 ? (
                  <Link
                    href={pageHref(view.page - 1)}
                    className="inline-flex min-h-11 items-center"
                  >
                    {text.previous}
                  </Link>
                ) : (
                  <span />
                )}
                <span>{text.page(view.page, view.pageCount)}</span>
                {view.page < view.pageCount ? (
                  <Link
                    href={pageHref(view.page + 1)}
                    className="inline-flex min-h-11 items-center"
                  >
                    {text.next}
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            )}
          </>
        )}
      </div>
    </main>
  );
}
