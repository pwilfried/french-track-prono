import Link from "next/link";

import type { CompetitionSummary } from "@/application/create-competition";
import { UseCaseError } from "@/application/errors";
import { listCompetitions } from "@/application/list-competitions";
import { ErrorNotice } from "@/components/error-notice";
import { VenueChip } from "@/components/events/venue-chip";
import { nextCompetition } from "@/domain/competition";
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
        {[c.city, messages.competition.dates(c.startsOn, c.endsOn)].filter(Boolean).join(" · ")}
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

export default async function AdminCompetitionsPage() {
  const { client } = await adminOnly();
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
  const featured =
    lists === "error" ? null : nextCompetition([...lists.coming, ...lists.past], today)?.slug;

  return (
    <AdminShell title={messages.adminCompetitions.title} section="competitions">
      <p className="-mt-2 text-sm text-muted-foreground">{messages.adminCompetitions.subtitle}</p>
      <Link
        href="/admin/competitions/nouvelle"
        className="flex min-h-12 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground"
      >
        {messages.adminCompetitions.create}
      </Link>
      {lists === "error" ? (
        <ErrorNotice
          retryHref="/admin/competitions"
          message={messages.errors.COMPETITIONS_UNAVAILABLE}
        />
      ) : (
        (["coming", "past"] as const).map((key) => (
          <section key={key} aria-labelledby={`list-${key}`} className="flex flex-col gap-2.5">
            <h2
              id={`list-${key}`}
              className="border-b border-border pb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground"
            >
              {messages.adminCompetitions.list[key]}
            </h2>
            {lists[key].length === 0 ? (
              <p className="rounded-card bg-muted p-4 text-sm">{messages.adminCompetitions.none}</p>
            ) : (
              lists[key].map((c) => (
                <CompetitionCard key={c.slug} c={c} featured={c.slug === featured} />
              ))
            )}
          </section>
        ))
      )}
    </AdminShell>
  );
}
