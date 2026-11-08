import Link from "next/link";
import { notFound } from "next/navigation";

import { listDisciplines } from "@/application/disciplines";
import { UseCaseError, type ErrorCode } from "@/application/errors";
import { getCompetitionFile } from "@/application/list-competitions";
import { listAthletes } from "@/application/list-athletes";
import { ErrorNotice } from "@/components/error-notice";
import { flagOf } from "@/domain/flag";
import { ROUNDS } from "@/domain/rounds";
import { searchAthletes } from "@/domain/start-list";
import {
  createSupabaseAthleteAdminRepository,
  createSupabaseCompetitionAdminRepository,
  createSupabaseDisciplineRepository,
} from "@/infra";

import { messages } from "../../../messages.fr";
import { adminOnly } from "../../guard";
import { addEventAction, setAthleteAction } from "../actions";
import { ActionNotice, AdminShell } from "../admin-shell";

const field = "min-h-12 w-full rounded-xl border-2 border-border bg-card px-3 text-base";
const tab = (on: boolean) =>
  on
    ? "flex min-h-10 items-center justify-center rounded-full bg-brand font-bold text-brand-foreground"
    : "flex min-h-10 items-center justify-center rounded-full font-semibold text-muted-foreground";

async function load(slug: string, client: Awaited<ReturnType<typeof adminOnly>>["client"]) {
  try {
    const [file, disciplines, athletes] = await Promise.all([
      getCompetitionFile({
        competitions: createSupabaseCompetitionAdminRepository(client),
      }).execute({ slug }),
      listDisciplines({ disciplines: createSupabaseDisciplineRepository(client) }).execute(),
      listAthletes({ athletes: createSupabaseAthleteAdminRepository(client) }).execute(),
    ]);
    return { file, disciplines, athletes };
  } catch (error) {
    if (error instanceof UseCaseError) {
      if (error.code === "COMPETITION_NOT_FOUND") notFound();
      return "error" as const;
    }
    throw error;
  }
}

export default async function AdminCompetitionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ onglet?: string; q?: string; enregistre?: string; erreur?: string }>;
}) {
  const { client } = await adminOnly();
  const { slug } = await params;
  const search = await searchParams;
  const athletesTab = search.onglet === "engages";
  const q = (search.q ?? "").slice(0, 60);
  const error =
    search.erreur && search.erreur in messages.errors
      ? messages.errors[search.erreur as ErrorCode]
      : null;
  const loaded = await load(slug, client);
  const time =
    loaded === "error"
      ? null
      : new Intl.DateTimeFormat("fr-FR", {
          weekday: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: loaded.file.timeZone,
        });

  if (loaded === "error") {
    return (
      <AdminShell
        title={messages.adminCompetitions.title}
        back={{ href: "/admin/competitions", label: messages.adminCompetitions.title }}
      >
        <ErrorNotice
          retryHref={`/admin/competitions/${slug}`}
          message={messages.errors.COMPETITIONS_UNAVAILABLE}
        />
      </AdminShell>
    );
  }
  const { file } = loaded;
  const enteredIds = new Set(file.athletes.map((a) => a.athleteId));
  const matches = q
    ? searchAthletes(loaded.athletes, q)
        .filter((a) => !enteredIds.has(a.athleteId))
        .slice(0, 8)
    : [];

  return (
    <AdminShell
      title={file.name}
      back={{ href: "/admin/competitions", label: messages.adminCompetitions.title }}
    >
      <p className="-mt-2 text-sm text-muted-foreground">
        {messages.adminCompetitions.scope[file.scope]} ·{" "}
        {[file.city, messages.competition.dates(file.startsOn, file.endsOn), file.timeZone]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <ActionNotice saved={!!search.enregistre} error={error} />
      <nav
        aria-label={messages.adminCompetitions.tabs}
        className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1"
      >
        <Link
          href={`/admin/competitions/${slug}`}
          aria-current={!athletesTab ? "page" : undefined}
          className={tab(!athletesTab)}
        >
          {messages.adminCompetitions.eventsTab(file.eventList.length)}
        </Link>
        <Link
          href={`/admin/competitions/${slug}?onglet=engages`}
          aria-current={athletesTab ? "page" : undefined}
          className={tab(athletesTab)}
        >
          {messages.adminCompetitions.athletesTab(file.athletes.length)}
        </Link>
      </nav>

      {!athletesTab ? (
        <>
          {file.eventList.length === 0 ? (
            <p className="rounded-card bg-muted p-4 text-sm">
              {messages.adminCompetitions.noEvent}
            </p>
          ) : (
            <ul aria-label={messages.adminCompetitions.events} className="flex flex-col gap-2">
              {file.eventList.map((e) => (
                <li key={e.slug}>
                  <Link
                    href={`/admin/${e.slug}`}
                    className="flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-2.5"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-bold">
                        {e.discipline} {messages.events.gender[e.gender].toLowerCase()} ·{" "}
                        {messages.rounds.name[e.round]}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {time!.format(new Date(e.startsAt))} ·{" "}
                        {messages.adminCompetitions.entries(e.entries)}
                      </span>
                    </span>
                    <span aria-hidden="true">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <details
            className="rounded-card border-2 border-dashed border-border p-3.5"
            open={file.eventList.length === 0 || !!error}
          >
            <summary className="flex min-h-11 cursor-pointer items-center font-bold">
              {messages.adminCompetitions.addEvent}
            </summary>
            <form action={addEventAction} className="mt-2 flex flex-col gap-3">
              <input type="hidden" name="competition" value={slug} />
              <input type="hidden" name="timeZone" value={file.timeZone} />
              <label className="flex flex-col gap-1.5 text-sm font-semibold">
                {messages.adminCompetitions.discipline}
                <select name="discipline" required defaultValue="" className={field}>
                  <option value="" disabled>
                    {messages.adminAthletes.choose}
                  </option>
                  {loaded.disciplines.map((d) => (
                    <option key={d.name} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5 text-sm font-semibold">
                  {messages.adminAthletes.gender}
                  <select name="gender" defaultValue="F" className={field}>
                    {(["F", "M", "X"] as const).map((g) => (
                      <option key={g} value={g}>
                        {messages.events.gender[g]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-semibold">
                  {messages.adminCompetitions.round}
                  <select name="round" defaultValue="final" className={field}>
                    {ROUNDS.map((r) => (
                      <option key={r} value={r}>
                        {messages.rounds.name[r]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5 text-sm font-semibold">
                  {messages.adminCompetitions.localStart}
                  <input type="datetime-local" name="localStart" required className={field} />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-semibold">
                  {messages.adminCompetitions.lock}
                  <select name="lockMinutes" defaultValue="5" className={field}>
                    {[0, 5, 15, 30, 60].map((m) => (
                      <option key={m} value={m}>
                        {messages.adminCompetitions.lockBefore(m)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button
                type="submit"
                className="min-h-12 rounded-full bg-brand font-bold text-brand-foreground"
              >
                {messages.adminCompetitions.addEventSubmit}
              </button>
            </form>
          </details>
        </>
      ) : (
        <>
          <form method="get" role="search" className="flex gap-2">
            <input type="hidden" name="onglet" value="engages" />
            <label htmlFor="enter-q" className="sr-only">
              {messages.startList.search}
            </label>
            <input
              id="enter-q"
              type="search"
              name="q"
              defaultValue={q}
              placeholder={messages.startList.search}
              className={`${field} flex-1`}
            />
            <button
              type="submit"
              className="min-h-12 rounded-full bg-brand px-4 font-bold text-brand-foreground"
            >
              {messages.adminLog.apply}
            </button>
          </form>
          {q && (
            <ul aria-label={messages.startList.matches} className="flex flex-col">
              {matches.length === 0 && (
                <li className="text-sm text-muted-foreground">{messages.startList.noMatch}</li>
              )}
              {matches.map((a) => (
                <li
                  key={a.athleteId}
                  className="flex min-h-12 items-center gap-3 border-b border-border py-1.5"
                >
                  <span aria-hidden="true">{flagOf(a.countryCode)}</span>
                  <span className="min-w-0 flex-1 break-words font-semibold">{a.name}</span>
                  <form action={setAthleteAction}>
                    <input type="hidden" name="competition" value={slug} />
                    <input type="hidden" name="athleteId" value={a.athleteId} />
                    <input type="hidden" name="entered" value="1" />
                    <button className="min-h-11 rounded-full bg-brand-soft px-4 text-sm font-bold text-brand-ink">
                      {messages.adminCompetitions.enter}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <p className="text-sm text-muted-foreground">
            {messages.adminCompetitions.enterHint}{" "}
            <Link href="/admin/athletes" className="font-semibold underline">
              {messages.adminAthletes.create}
            </Link>
          </p>
          {file.athletes.length === 0 ? (
            <p className="rounded-card bg-muted p-4 text-sm">
              {messages.adminCompetitions.noAthlete}
            </p>
          ) : (
            <ul aria-label={messages.adminCompetitions.athletesList} className="flex flex-col">
              {file.athletes.map((a) => (
                <li
                  key={a.athleteId}
                  className="flex min-h-12 items-center gap-3 border-b border-border py-1.5"
                >
                  <span aria-hidden="true">{flagOf(a.countryCode)}</span>
                  <span className="min-w-0 flex-1 break-words font-semibold">{a.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {messages.events.gender[a.gender]}
                  </span>
                  <form action={setAthleteAction}>
                    <input type="hidden" name="competition" value={slug} />
                    <input type="hidden" name="athleteId" value={a.athleteId} />
                    <input type="hidden" name="entered" value="0" />
                    <button
                      aria-label={messages.adminCompetitions.withdraw(a.name)}
                      className="grid size-11 place-items-center rounded-full text-muted-foreground"
                    >
                      ✕
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </AdminShell>
  );
}
