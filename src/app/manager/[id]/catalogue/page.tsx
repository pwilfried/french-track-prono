import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { UseCaseError } from "@/application/errors";
import { getMyManagerBids } from "@/application/manager-bids";
import { browseManagerCatalogue } from "@/application/manager-catalogue";
import { getManagerLeague } from "@/application/manager-leagues";
import { getManagerRevealRounds } from "@/application/manager-reveal";
import { getMyManagerTeam } from "@/application/manager-team";
import { ErrorNotice } from "@/components/error-notice";
import { LeagueHero } from "@/components/leagues/league-hero";
import { CatalogueCard } from "@/components/manager/catalogue-card";
import { CatalogueFilters } from "@/components/manager/catalogue-filters";
import { FirstMercatoGate } from "@/components/manager/first-mercato";
import { MercatoBanner } from "@/components/manager/mercato-banner";
import { TeamBuildCard } from "@/components/manager/team-build-card";
import { buttonVariants } from "@/components/ui/button";
import { SEARCH_MAX_LENGTH } from "@/domain/list-view";
import {
  CATALOGUE_SORTS,
  DEFAULT_CATALOGUE_SORT,
  type CatalogueSort,
} from "@/domain/manager-catalogue";
import { teamBuild } from "@/domain/manager-build";
import { athleteHref } from "@/domain/redirect";
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

type Params = {
  guide?: string;
  q?: string;
  sexe?: string;
  famille?: string;
  libres?: string;
  tri?: string;
  epreuve?: string;
  budget?: string;
  encheres?: string;
  page?: string;
};

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
  // Available athletes show by default; « libres=0 » shows the taken ones too (#1087).
  const availableOnly = search.libres !== "0";
  const sort = CATALOGUE_SORTS.find((t) => t === search.tri) ?? DEFAULT_CATALOGUE_SORT;
  const discipline = family ? (search.epreuve?.slice(0, 60) ?? null) : null;
  const inBudget = search.budget === "1";
  const myBids = search.encheres === "1";
  const query = search.q ?? "";

  const client = await getSessionClient();
  const catalogue = createSupabaseManagerCatalogue(client);
  const mine = await getMyManagerBids({ bids: createSupabaseManagerBids(client), catalogue })
    .execute({ leagueId: id })
    .catch(caught);
  const [view, reveals, league, team] = await Promise.all([
    browseManagerCatalogue({ catalogue })
      .execute({
        leagueId: id,
        query,
        filter: {
          sex,
          family,
          discipline,
          availableOnly,
          maxPrice: inBudget && mine !== "error" ? mine.available : null,
          onlyIds: myBids && mine !== "error" ? new Set(mine.bids.map((b) => b.athleteId)) : null,
        },
        sort,
        page: Number(search.page) || 1,
      })
      .catch(caught),
    getManagerRevealRounds({ reveals: createSupabaseManagerReveals(client) })
      .execute({ leagueId: id })
      .catch(caught),
    getManagerLeague(ports).execute({ id }).catch(caught),
    getMyManagerTeam({
      managerLeagues: ports.managerLeagues,
      bids: createSupabaseManagerBids(client),
      catalogue,
    })
      .execute({ leagueId: id })
      .catch(caught),
  ]);
  // The first visit after the close of a round opens its reveal, once (#604).
  if (reveals !== "error" && reveals.toReveal !== null) {
    redirect(`/manager/${id}/tour/${reveals.toReveal}`);
  }
  // The team under construction counts the bids too, apart from the athletes won (#1088).
  const build =
    league === "error" || team === "error" || mine === "error"
      ? null
      : teamBuild(
          league.rules,
          [
            ...team.athletes,
            ...mine.bids.flatMap((b) =>
              b.sex && b.family ? [{ sex: b.sex, family: b.family, pending: true }] : [],
            ),
          ],
          mine.available,
          { spent: mine.spent + mine.reserved, budget: mine.budget },
        );
  const bidOf = new Map(mine === "error" ? [] : mine.bids.map((b) => [b.athleteId, b.amount]));

  type Change = Partial<{
    sex: ManagerSex | null;
    family: (typeof MANAGER_FAMILIES)[number] | null;
    discipline: string | null;
    availableOnly: boolean;
    inBudget: boolean;
    myBids: boolean;
    sort: CatalogueSort;
    page: number;
  }>;
  /** The address of the catalogue with some filters changed; a new filter starts at page 1. */
  const href = (change: Change) => {
    const next = {
      sex,
      family,
      discipline,
      availableOnly,
      inBudget,
      myBids,
      sort,
      page: 1,
      ...change,
    };
    // Another family has other disciplines.
    if (change.family !== undefined && !("discipline" in change)) next.discipline = null;
    const params = new URLSearchParams({
      ...(query && { q: query }),
      ...(next.sex && { sexe: next.sex }),
      ...(next.family && { famille: next.family }),
      ...(next.family && next.discipline && { epreuve: next.discipline }),
      ...(!next.availableOnly && { libres: "0" }),
      ...(next.inBudget && { budget: "1" }),
      ...(next.myBids && { encheres: "1" }),
      ...(next.sort !== DEFAULT_CATALOGUE_SORT && { tri: next.sort }),
      ...(next.page > 1 && { page: String(next.page) }),
    }).toString();
    return `/manager/${id}/catalogue${params && `?${params}`}`;
  };
  const pageHref = (page: number) => href({ page });
  const filtered = Boolean(
    query || sex || family || discipline || !availableOnly || inBudget || myBids,
  );

  return (
    <main id="main" className="flex flex-1 flex-col">
      <LeagueHero
        title={text.title}
        subtitle={text.subtitle}
        back={{
          href: `/manager/${id}`,
          // Back to the league the player comes from, by its name (#987).
          label: league === "error" ? messages.manager.back : league.name,
        }}
      />
      {league !== "error" && (
        <FirstMercatoGate
          rules={{
            budget: league.rules.budget,
            perFamily: league.rules.lineup.perFamily,
            starters: league.rules.lineup.max,
            bench: league.rules.lineup.bench,
          }}
          open={search.guide !== undefined}
          returnHref={`/manager/${id}/catalogue`}
        />
      )}
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-6 md:max-w-3xl">
        {mine === "error" ? (
          <ErrorNotice
            retryHref={`/manager/${id}/catalogue`}
            message={messages.errors.MANAGER_BIDS_UNAVAILABLE}
          />
        ) : mine.mercatoOpen || mine.mercatoClosed ? (
          <MyBidsPanel leagueId={id} bids={mine} build={build ?? undefined} />
        ) : league === "error" ? (
          <ErrorNotice
            retryHref={`/manager/${id}/catalogue`}
            message={messages.errors.LEAGUES_UNAVAILABLE}
          />
        ) : (
          // Before the mercato: when it opens and who plays, no bid yet (#620).
          <MercatoBanner opensAt={league.mercato.startsAt} participants={league.participants} />
        )}
        <Link
          href={`/manager/${id}/catalogue?guide=1`}
          prefetch={false}
          className="inline-flex min-h-11 items-center self-start text-sm font-bold underline underline-offset-4"
        >
          {text.firstMercato.open}
        </Link>
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
            maxLength={SEARCH_MAX_LENGTH}
            autoComplete="off"
            className={field}
          />
          {sex && <input type="hidden" name="sexe" value={sex} />}
          {family && <input type="hidden" name="famille" value={family} />}
          {discipline && <input type="hidden" name="epreuve" value={discipline} />}
          {!availableOnly && <input type="hidden" name="libres" value="0" />}
          {inBudget && <input type="hidden" name="budget" value="1" />}
          {myBids && <input type="hidden" name="encheres" value="1" />}
          {sort !== DEFAULT_CATALOGUE_SORT && <input type="hidden" name="tri" value={sort} />}
        </form>
        <CatalogueFilters
          sort={{
            label: text.sortLabel,
            options: CATALOGUE_SORTS.map((t) => ({
              key: t,
              name: text.sorts[t],
              active: sort === t,
              href: href({ sort: t }),
            })),
          }}
          families={{
            label: text.familyLabel,
            chips: MANAGER_FAMILIES.map((f) => {
              const missing = build?.families.find((b) => b.family === f)?.missing ?? 0;
              return {
                key: f,
                name: text.familyMissing(text.families[f], missing),
                active: family === f,
                href: href({ family: family === f ? null : f }),
              };
            }),
          }}
          disciplines={{
            label: text.disciplineLabel,
            chips:
              view === "error"
                ? []
                : view.disciplines.map((d) => ({
                    key: d,
                    name: d,
                    active: discipline === d,
                    href: href({ discipline: discipline === d ? null : d }),
                  })),
          }}
          sexes={{
            label: text.sexLabel,
            chips: MANAGER_SEXES.map((s) => ({
              key: s,
              name: text.sexShort[s],
              active: sex === s,
              href: href({ sex: sex === s ? null : s }),
            })),
          }}
          toggles={{
            label: text.filters,
            chips: [
              ...(mine !== "error" && mine.mercatoOpen
                ? [
                    {
                      key: "budget",
                      name: text.inBudget,
                      active: inBudget,
                      href: href({ inBudget: !inBudget }),
                    },
                  ]
                : []),
              {
                key: "available",
                name: text.availableOnly,
                active: availableOnly,
                href: href({ availableOnly: !availableOnly }),
              },
              ...(mine !== "error" && (mine.mercatoOpen || mine.mercatoClosed)
                ? [
                    {
                      key: "bids",
                      name: text.bidsOnly,
                      active: myBids,
                      href: href({ myBids: !myBids }),
                    },
                  ]
                : []),
            ],
          }}
          clear={
            filtered
              ? {
                  name: text.clearFilters,
                  href: `/manager/${id}/catalogue${sort !== DEFAULT_CATALOGUE_SORT ? `?tri=${sort}` : ""}`,
                }
              : null
          }
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
                    <CatalogueCard
                      athlete={athlete}
                      href={athleteHref(athlete.slug, pageHref(view.page))}
                    >
                      {mine !== "error" && mine.mercatoOpen && athlete.available && (
                        <BidForm
                          leagueId={id}
                          athleteId={athlete.athleteId}
                          name={athlete.name}
                          price={athlete.price}
                          current={bidOf.get(athlete.athleteId) ?? null}
                          credits={mine.available + (bidOf.get(athlete.athleteId) ?? 0)}
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
        {/* Under the catalogue: the first athlete stays in view on a phone (#497). */}
        {build && team !== "error" && !team.mercatoClosed && mine !== "error" && (
          <TeamBuildCard build={build} left={mine.available} />
        )}
      </div>
    </main>
  );
}
