import Link from "next/link";
import { notFound } from "next/navigation";

import { listDisciplines } from "@/application/disciplines";
import { UseCaseError, type ErrorCode } from "@/application/errors";
import { getAthleteFile } from "@/application/list-athletes";
import { ErrorNotice } from "@/components/error-notice";
import { createSupabaseAthleteAdminRepository, createSupabaseDisciplineRepository } from "@/infra";

import { messages } from "../../../messages.fr";
import { adminOnly } from "../../guard";
import { editAthleteAction, editDisciplineAction, setRecordAction } from "../actions";

const field = "min-h-11 w-full rounded-xl border-2 border-border bg-background px-2.5 text-base";
const button = "min-h-11 rounded-full px-4 text-sm font-bold";

async function load(slug: string, client: Awaited<ReturnType<typeof adminOnly>>["client"]) {
  try {
    const [file, disciplines] = await Promise.all([
      getAthleteFile({ athletes: createSupabaseAthleteAdminRepository(client) }).execute({ slug }),
      listDisciplines({ disciplines: createSupabaseDisciplineRepository(client) }).execute(),
    ]);
    return { file, disciplines };
  } catch (error) {
    if (error instanceof UseCaseError) {
      if (error.code === "ATHLETE_NOT_FOUND") notFound();
      return "error" as const;
    }
    throw error;
  }
}

export default async function AdminAthletePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ enregistre?: string; erreur?: string }>;
}) {
  const { client } = await adminOnly();
  const { slug } = await params;
  const { enregistre, erreur } = await searchParams;
  const error = erreur && erreur in messages.errors ? messages.errors[erreur as ErrorCode] : null;
  const loaded = await load(slug, client);

  return (
    <main id="main" className="flex flex-1 flex-col">
      <p
        role="note"
        className="bg-primary px-4 py-1 text-center text-[11px] font-extrabold uppercase tracking-[0.14em] text-primary-foreground"
      >
        {messages.admin.band}
      </p>
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-4">
        <Link
          href="/admin/athletes"
          className="inline-flex min-h-11 items-center self-start font-semibold text-brand dark:text-secondary"
        >
          ‹ {messages.adminAthletes.title}
        </Link>
        {loaded === "error" ? (
          <ErrorNotice
            retryHref={`/admin/athletes/${slug}`}
            message={messages.errors.ATHLETES_UNAVAILABLE}
          />
        ) : (
          <>
            <h1 className="font-display text-3xl font-extrabold leading-tight">
              {loaded.file.name}
            </h1>
            {error && (
              <p
                role="alert"
                className="rounded-2xl bg-muted px-3.5 py-3 text-sm font-semibold text-accent-text"
              >
                {error}
              </p>
            )}
            {enregistre && !error && (
              <p
                role="status"
                className="rounded-2xl bg-success/15 px-3.5 py-3 text-sm font-semibold text-success-text"
              >
                {messages.adminAthletes.saved}
              </p>
            )}

            <form
              action={editAthleteAction}
              className="flex flex-col gap-3 rounded-card border border-border bg-card p-3.5"
            >
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="athleteId" value={loaded.file.athleteId} />
              <h2 className="font-bold">{messages.adminAthletes.identity}</h2>
              <label className="flex flex-col gap-1 text-sm font-semibold">
                {messages.adminAthletes.name}
                <input name="name" defaultValue={loaded.file.name} className={field} />
              </label>
              <div className="flex gap-3">
                <label className="flex flex-1 flex-col gap-1 text-sm font-semibold">
                  {messages.import.country}
                  <input
                    name="countryCode"
                    defaultValue={loaded.file.countryCode}
                    maxLength={3}
                    className={`${field} font-mono uppercase`}
                  />
                </label>
                <label className="flex flex-1 flex-col gap-1 text-sm font-semibold">
                  {messages.adminAthletes.gender}
                  <select name="gender" defaultValue={loaded.file.gender} className={field}>
                    {(["F", "M", "X"] as const).map((g) => (
                      <option key={g} value={g}>
                        {messages.events.gender[g]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button type="submit" className={`${button} bg-primary text-primary-foreground`}>
                {messages.disciplines.save}
              </button>
            </form>

            <section aria-labelledby="disciplines-title" className="flex flex-col gap-3">
              <h2
                id="disciplines-title"
                className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
              >
                {messages.adminAthletes.disciplines}
              </h2>
              {loaded.file.disciplines.length === 0 && (
                <p className="rounded-card bg-muted p-4 text-sm">
                  {messages.adminAthletes.noDiscipline}
                </p>
              )}
              {loaded.file.disciplines.map((d) => {
                const record = (kind: "pr" | "sb") =>
                  loaded.file.records.find((r) => r.discipline === d.discipline && r.kind === kind);
                return (
                  <div
                    key={d.discipline}
                    className="flex flex-col gap-3 rounded-card border border-border bg-card p-3.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-bold">
                        {d.discipline}
                        {d.isPrimary && (
                          <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-bold text-brand-ink">
                            {messages.adminAthletes.main}
                          </span>
                        )}
                      </h3>
                      <form action={editDisciplineAction} className="flex gap-1">
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="athleteId" value={loaded.file.athleteId} />
                        <input type="hidden" name="discipline" value={d.discipline} />
                        {!d.isPrimary && (
                          <button
                            name="action"
                            value="main"
                            className={`${button} border border-border`}
                          >
                            {messages.adminAthletes.makeMain}
                          </button>
                        )}
                        <button
                          name="action"
                          value="remove"
                          aria-label={messages.adminAthletes.remove(d.discipline)}
                          className={`${button} text-muted-foreground`}
                        >
                          ✕
                        </button>
                      </form>
                    </div>
                    <form action={setRecordAction} className="flex flex-col gap-2">
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="athleteId" value={loaded.file.athleteId} />
                      <input type="hidden" name="discipline" value={d.discipline} />
                      {(["pr", "sb"] as const).map((kind) => (
                        <div key={kind} className="flex gap-2">
                          <label className="flex flex-1 flex-col gap-1 text-xs font-semibold">
                            {messages.athlete[kind]}
                            <input
                              name={`${kind}Mark`}
                              aria-label={messages.adminAthletes.mark(
                                messages.athlete[kind],
                                d.discipline,
                              )}
                              defaultValue={record(kind)?.mark ?? ""}
                              inputMode="decimal"
                              className={`${field} font-mono`}
                            />
                          </label>
                          <label className="flex w-40 flex-col gap-1 text-xs font-semibold">
                            {messages.adminAthletes.date}
                            <input
                              type="date"
                              name={`${kind}Date`}
                              defaultValue={record(kind)?.date ?? ""}
                              className={field}
                            />
                          </label>
                        </div>
                      ))}
                      <button
                        type="submit"
                        className={`${button} bg-primary text-primary-foreground`}
                      >
                        {messages.adminAthletes.saveRecords(d.discipline)}
                      </button>
                    </form>
                  </div>
                );
              })}
              <form action={editDisciplineAction} className="flex items-end gap-2">
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="athleteId" value={loaded.file.athleteId} />
                <input type="hidden" name="action" value="add" />
                <label className="flex flex-1 flex-col gap-1 text-sm font-semibold">
                  {messages.adminAthletes.addDiscipline}
                  <select name="discipline" className={field} defaultValue="">
                    <option value="" disabled>
                      {messages.adminAthletes.choose}
                    </option>
                    {loaded.disciplines
                      .filter(
                        (d) => !loaded.file.disciplines.some((own) => own.discipline === d.name),
                      )
                      .map((d) => (
                        <option key={d.name} value={d.name}>
                          {d.name}
                        </option>
                      ))}
                  </select>
                </label>
                <button type="submit" className={`${button} border-2 border-border`}>
                  {messages.startList.addOne}
                </button>
              </form>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
