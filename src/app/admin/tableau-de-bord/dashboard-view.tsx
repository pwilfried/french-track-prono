import Link from "next/link";

import type { AdminTodo } from "@/application/admin-todo";
import type { CompetitionReadiness } from "@/application/competition-readiness";
import type { AdminAction } from "@/application/list-admin-actions";
import type { PlayerStats } from "@/domain/admin-dashboard";
import { TIME_ZONE } from "@/domain/competition";
import { cn } from "@/lib/utils";

import { messages } from "../../messages.fr";

const text = messages.adminDashboard;

function Tile({
  href,
  count,
  label,
  hint,
  strong = false,
}: {
  href: string;
  count: number | null;
  label: string;
  hint: string;
  strong?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-28 flex-col gap-1 rounded-2xl p-4",
        strong
          ? "bg-brand-ink text-brand-foreground dark:bg-brand"
          : "border border-border bg-card text-foreground",
      )}
    >
      <span
        className={cn(
          "font-mono text-3xl font-bold",
          strong ? "text-secondary" : count ? "text-accent-text" : "text-muted-foreground",
        )}
      >
        {count ?? text.unavailable}
      </span>
      <span className="font-bold">{label}</span>
      <span className={cn("text-xs", strong ? "opacity-80" : "text-muted-foreground")}>{hint}</span>
    </Link>
  );
}

function Gauge({ label, done, total }: { label: string; done: number; total: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="flex justify-between text-sm">
        <span>{label}</span>
        <strong className="font-mono">{text.of(done, total)}</strong>
      </p>
      <span aria-hidden="true" className="h-2 rounded-full bg-muted">
        <span
          className="block h-2 rounded-full bg-brand dark:bg-secondary"
          style={{ width: `${total ? Math.round((done / total) * 100) : 0}%` }}
        />
      </span>
    </div>
  );
}

function Players({ stats }: { stats: PlayerStats }) {
  const top = Math.max(1, ...stats.newPerWeek);
  return (
    <section
      aria-labelledby="dash-players"
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="dash-players" className="font-display text-xl font-extrabold">
          {text.players}
        </h2>
        <span className="text-xs text-muted-foreground">{text.weeks}</span>
      </div>
      <dl className="grid grid-cols-3 gap-2">
        {(
          [
            [String(stats.total), text.registered],
            [String(stats.activeThisWeek), text.active],
            [`${stats.predictedShare} %`, text.predicted],
          ] as const
        ).map(([value, label]) => (
          <div key={label} className="flex flex-col">
            <dd className="font-mono text-2xl font-bold">{value}</dd>
            <dt className="text-xs text-muted-foreground">{label}</dt>
          </div>
        ))}
      </dl>
      <div
        role="img"
        aria-label={text.chart(stats.newPerWeek.join(", "))}
        className="flex h-20 items-end gap-1.5"
      >
        {stats.newPerWeek.map((count, i) => (
          <span
            key={i}
            className={cn(
              "flex-1 rounded-t-md",
              i === 7 ? "bg-primary" : "bg-brand/60 dark:bg-secondary/60",
            )}
            style={{ height: `${Math.max(4, (count / top) * 100)}%` }}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{text.newThisWeek(stats.newPerWeek[7] ?? 0)}</p>
    </section>
  );
}

/** The blocks of the back-office home (#379); a block that could not be read is left out. */
export function DashboardView({
  competition,
  daysLeft,
  todo,
  readiness,
  stats,
  recent,
}: {
  competition: { slug: string; name: string; city: string | null };
  daysLeft: number;
  todo: AdminTodo | null;
  readiness: CompetitionReadiness | null;
  stats: PlayerStats | null;
  recent: AdminAction[];
}) {
  const time = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  });
  return (
    <>
      <Link
        href="/admin/competitions/nouvelle"
        className="inline-flex min-h-11 items-center self-start rounded-full bg-primary px-4 font-bold text-primary-foreground"
      >
        {text.newCompetition}
      </Link>

      <section aria-labelledby="dash-todo" className="flex flex-col gap-3">
        <h2
          id="dash-todo"
          className="text-xs font-bold uppercase tracking-wide text-muted-foreground"
        >
          {text.todo}
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile
            href="/admin?etat=todo"
            count={todo?.results ?? null}
            label={text.tiles.results}
            hint={text.tileHint.results(competition.name)}
            strong
          />
          <Tile
            href="/admin?etat=open"
            count={readiness?.openWithoutOdds ?? null}
            label={text.tiles.odds}
            hint={text.tileHint.odds}
          />
          <Tile
            href="/admin/clubs"
            count={todo?.clubs ?? null}
            label={text.tiles.clubs}
            hint={text.tileHint.clubs}
          />
          <Tile
            href="/admin/ligues"
            count={todo?.leagues ?? null}
            label={text.tiles.leagues}
            hint={text.tileHint.leagues}
          />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {stats && <Players stats={stats} />}
        <section
          aria-labelledby="dash-next"
          className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4"
        >
          <h2 id="dash-next" className="font-display text-xl font-extrabold">
            {text.next}
          </h2>
          <p className="flex flex-wrap items-baseline gap-x-3">
            <span className="rounded-full bg-secondary px-2.5 py-0.5 font-mono text-sm font-bold text-secondary-foreground">
              {text.daysLeft(daysLeft)}
            </span>
            <Link
              href={`/admin/competitions/${competition.slug}`}
              className="font-bold underline-offset-2 hover:underline"
            >
              {competition.name}
            </Link>
          </p>
          {readiness && (
            <>
              <p className="text-sm text-muted-foreground">
                {text.finals(competition.city ?? "", readiness.finals)}
              </p>
              <Gauge
                label={text.startLists}
                done={readiness.withStartList}
                total={readiness.finals}
              />
              <Gauge label={text.odds} done={readiness.withOdds} total={readiness.finals} />
            </>
          )}
        </section>
      </div>

      <section
        aria-labelledby="dash-recent"
        className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4"
      >
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="dash-recent" className="font-display text-xl font-extrabold">
            {text.recent}
          </h2>
          <Link
            href="/admin/historique"
            className="text-sm font-bold text-brand dark:text-secondary"
          >
            {text.allActions}
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">{text.noAction}</p>
        ) : (
          <ol className="flex flex-col">
            {recent.map((action) => (
              <li
                key={action.id}
                className="flex flex-wrap items-baseline gap-x-3 border-b border-border py-2 text-sm last:border-0"
              >
                <time dateTime={action.at} className="w-28 font-mono text-xs text-muted-foreground">
                  {time.format(new Date(action.at))}
                </time>
                <span className="flex-1 font-semibold">
                  {messages.adminLog.kind[action.kind]}
                  {action.event
                    ? ` · ${messages.events.name(action.event.discipline, action.event.gender)}`
                    : ""}
                </span>
                <span className="text-xs text-muted-foreground">{action.admin?.pseudo ?? ""}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
