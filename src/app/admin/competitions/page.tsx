import Link from "next/link";

import type { CompetitionSummary } from "@/application/create-competition";
import { UseCaseError } from "@/application/errors";
import { listCompetitions } from "@/application/list-competitions";
import { ErrorNotice } from "@/components/error-notice";
import { VenueChip } from "@/components/events/venue-chip";
import { CompetitionChips } from "@/components/events/competition-chips";
import { nextCompetition, SCOPES } from "@/domain/competition";
import {
  COMPETITION_STATUSES,
  type CompetitionFilter,
  competitionLevels,
  filterCompetitions,
  isFiltered,
  parseCompetitionFilter,
} from "@/domain/competition-filter";
import { createSupabaseCompetitionAdminRepository } from "@/infra";

import { currentDay, SCOPE_CHIP } from "../../competition";
import { messages } from "../../messages.fr";
import { adminOnly } from "../guard";
import { AdminShell } from "./admin-shell";

function CompetitionCard({ c, featured }: { c: CompetitionSummary; featured: boolean }) {
  return (
    <Link
      href={`/admin/competitions/${c.slug}`}
      className={`flex flex-col gap-2.5 rounded-card bg-card p-3.5 ${featured ? "border-2 border-brand" : "border border-border"}`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${SCOPE_CHIP[c.scope]}`}>
            {messages.adminCompetitions.scope[c.scope]}
          </span>
          <VenueChip venue={c.venue} />
        </span>
        {featured && (
          <span className="text-xs font-bold text-success-text">
            {messages.adminCompetitions.featured}
          </span>
        )}
      </span>
      <span className="font-display text-xl font-extrabold">{c.name}</span>
      <span className="text-sm text-muted-foreground">
        {[
          c.level && messages.adminCompetitions.level(c.level),
          c.city,
          messages.competition.dates(c.startsOn, c.endsOn),
        ]
          .filter(Boolean)
          .join(" · ")}
      </span>
      <span className="grid grid-cols-2 gap-1.5 text-center">
        <span className="rounded-xl bg-background py-2">
          <span className="block font-mono text-lg font-bold">{c.events}</span>
          <span className="text-xs text-muted-foreground">{messages.adminCompetitions.events}</span>
        </span>
        <span className="rounded-xl bg-background py-2">
          <span className="block font-mono text-lg font-bold">{c.entered}</span>
          <span className="text-xs text-muted-foreground">
            {messages.adminCompetitions.entered}
          </span>
        </span>
      </span>
    </Link>
  );
}

const text = messages.adminCompetitions.filters;
const PATH = "/admin/competitions";

type Params = { portee?: string; lieu?: string; niveau?: string; statut?: string };

/** The address of the list with these filters, the ones left to « all » out of it. */
function filterHref(filter: CompetitionFilter) {
  const params = new URLSearchParams({
    ...(filter.scope && { portee: filter.scope }),
    ...(filter.venue && { lieu: filter.venue }),
    ...(filter.level && { niveau: filter.level }),
    ...(filter.status && { statut: filter.status }),
  }).toString();
  return `${PATH}${params && `?${params}`}`;
}

/**
 * The back-office competitions (#647): four rows of filter chips (scope, venue, level, status), one
 * value each, kept in the address so a link or a reload keeps them; then the coming and past lists.
 */
export default async function AdminCompetitionsPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const { client } = await adminOnly();
  const search = await searchParams;
  const today = currentDay();
  let lists;
  try {
    lists = await listCompetitions({
      competitions: createSupabaseCompetitionAdminRepository(client),
    }).execute({ today });
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    lists = "error" as const;
  }
  const all = lists === "error" ? [] : [...lists.coming, ...lists.past];
  const featured = lists === "error" ? null : nextCompetition(all, today)?.slug;
  const levels = competitionLevels(all);
  const filter = parseCompetitionFilter(search, levels);
  const filtered = isFiltered(filter);
  const shown =
    lists === "error"
      ? null
      : {
          coming: filterCompetitions(lists.coming, filter, today),
          past: filterCompetitions(lists.past, filter, today),
        };
  const count = shown ? shown.coming.length + shown.past.length : 0;

  /** One row of chips: « all » then each value, the active one marked. */
  const row = <K extends keyof CompetitionFilter>(
    key: K,
    label: string,
    allName: string,
    values: { value: NonNullable<CompetitionFilter[K]>; name: string }[],
  ) => (
    <CompetitionChips
      label={label}
      chips={[
        {
          key: "all",
          name: allName,
          active: filter[key] === null,
          href: filterHref({ ...filter, [key]: null }),
        },
        ...values.map(({ value, name }) => ({
          key: value,
          name,
          active: filter[key] === value,
          href: filterHref({ ...filter, [key]: value }),
        })),
      ]}
    />
  );

  return (
    <AdminShell title={messages.adminCompetitions.title} section="competitions">
      <p className="-mt-2 text-sm text-muted-foreground">{messages.adminCompetitions.subtitle}</p>
      <Link
        href="/admin/competitions/nouvelle"
        className="flex min-h-12 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground"
      >
        {messages.adminCompetitions.create}
      </Link>
      {shown === null ? (
        <ErrorNotice retryHref={PATH} message={messages.errors.COMPETITIONS_UNAVAILABLE} />
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {row(
              "scope",
              text.scope,
              text.allFeminine,
              SCOPES.map((value) => ({ value, name: text.scopes[value] })),
            )}
            {row(
              "venue",
              text.venue,
              text.allFeminine,
              (["indoor", "outdoor"] as const).map((value) => ({
                value,
                name: text.venues[value],
              })),
            )}
            {levels.length > 0 &&
              row(
                "level",
                text.level,
                text.allMasculine,
                levels.map((value) => ({ value, name: messages.adminCompetitions.level(value) })),
              )}
            {row(
              "status",
              text.status,
              text.allFeminine,
              COMPETITION_STATUSES.map((value) => ({ value, name: text.statuses[value] })),
            )}
          </div>
          <div className="flex items-center justify-between gap-2 text-sm font-semibold">
            <p role="status" className="text-muted-foreground">
              {text.count(count)}
            </p>
            {filtered ? (
              <Link href={PATH} className="inline-flex min-h-11 items-center text-primary-ink">
                {text.reset}
              </Link>
            ) : (
              <span aria-disabled="true" className="inline-flex min-h-11 items-center opacity-50">
                {text.reset}
              </span>
            )}
          </div>
          {filtered && count === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-card border border-border bg-muted p-5 text-center">
              <p className="text-sm font-semibold">{text.empty}</p>
              <Link
                href={PATH}
                className="inline-flex min-h-11 items-center rounded-full border-2 border-border bg-card px-4 text-sm font-semibold"
              >
                {text.reset}
              </Link>
            </div>
          ) : (
            (["coming", "past"] as const)
              // A filter hides the list it leaves empty.
              .filter((key) => !filtered || shown[key].length > 0)
              .map((key) => (
                <section
                  key={key}
                  aria-labelledby={`list-${key}`}
                  className="flex flex-col gap-2.5"
                >
                  <h2
                    id={`list-${key}`}
                    className="border-b border-border pb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground"
                  >
                    {messages.adminCompetitions.list[key]}
                  </h2>
                  {shown[key].length === 0 ? (
                    <p className="rounded-card bg-muted p-4 text-sm">
                      {messages.adminCompetitions.none}
                    </p>
                  ) : (
                    shown[key].map((c) => (
                      <CompetitionCard key={c.slug} c={c} featured={c.slug === featured} />
                    ))
                  )}
                </section>
              ))
          )}
        </>
      )}
    </AdminShell>
  );
}
