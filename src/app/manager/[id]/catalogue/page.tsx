import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { UseCaseError } from "@/application/errors";
import { getMyManagerBids } from "@/application/manager-bids";
import { browseManagerCatalogue } from "@/application/manager-catalogue";
import { getManagerRevealRounds } from "@/application/manager-reveal";
import { ErrorNotice } from "@/components/error-notice";
import { LeagueHero } from "@/components/leagues/league-hero";
import { CatalogueCard } from "@/components/manager/catalogue-card";
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
 * without script and survive a reload; a page of 30 athletes at a time.
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
  await managerPorts(`/manager/${id}/catalogue`);
  const sex = MANAGER_SEXES.includes(search.sexe as ManagerSex)
    ? (search.sexe as ManagerSex)
    : null;
  const family = MANAGER_FAMILIES.find((f) => f === search.famille) ?? null;
  const availableOnly = search.libres === "1";
  const query = search.q ?? "";

  const client = await getSessionClient();
  const catalogue = createSupabaseManagerCatalogue(client);
  const [view, mine, reveals] = await Promise.all([
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
  ]);
  // The first visit after the close of a round opens its reveal, once (#604).
  if (reveals !== "error" && reveals.toReveal !== null) {
    redirect(`/manager/${id}/tour/${reveals.toReveal}`);
  }
  const bidOf = new Map(mine === "error" ? [] : mine.bids.map((b) => [b.athleteId, b.amount]));

  const pageHref = (page: number) =>
    `?${new URLSearchParams({
      ...(query && { q: query }),
      ...(sex && { sexe: sex }),
      ...(family && { famille: family }),
      ...(availableOnly && { libres: "1" }),
      page: String(page),
    })}`;
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
        ) : (
          <p className="rounded-card bg-muted p-4 text-sm font-semibold">{text.mercatoClosed}</p>
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
        <form className="flex flex-col gap-3 rounded-card border border-border bg-card p-3.5">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            {text.search}
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder={text.searchPlaceholder}
              className={field}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm font-semibold">
              {text.sex}
              <select name="sexe" defaultValue={sex ?? ""} className={field}>
                <option value="">{text.allSexes}</option>
                {MANAGER_SEXES.map((s) => (
                  <option key={s} value={s}>
                    {text.sexes[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold">
              {text.family}
              <select name="famille" defaultValue={family ?? ""} className={field}>
                <option value="">{text.all}</option>
                {MANAGER_FAMILIES.map((f) => (
                  <option key={f} value={f}>
                    {messages.disciplines.family[f]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold">
            <input
              type="checkbox"
              name="libres"
              value="1"
              defaultChecked={availableOnly}
              className="size-6 shrink-0 accent-primary"
            />
            {text.availableOnly}
          </label>
          <button type="submit" className={`${buttonVariants({ variant: "muted" })} w-full`}>
            {text.apply}
          </button>
        </form>

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
