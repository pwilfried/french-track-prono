import { messages } from "@/app/messages.fr";
import { ErrorNotice } from "@/components/error-notice";
import { ChipStatus } from "@/components/ui/chip-status";
import { disciplineRecords, type AthleteSheet, type SheetRecord } from "@/domain/athlete";
import { flagOf } from "@/domain/flag";
import { athleteInitials } from "@/domain/manager-team";

const text = messages.athlete;

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const label = "text-[11px] font-bold uppercase tracking-wider text-muted-foreground";

/** A mark, with « ? » when it is not verified yet (#679). */
function Mark({ record, className }: { record: SheetRecord; className?: string }) {
  return (
    <span className={className}>
      {record.mark}
      {!record.verified && (
        <>
          <span aria-hidden className="ml-0.5 text-primary">
            {text.unverified}
          </span>
          <span className="sr-only"> ({text.unverifiedLabel})</span>
        </>
      )}
    </span>
  );
}

/** Name in a circle of initials (never a photo, non-goal 7), country and disciplines. */
function Hero({ sheet }: { sheet: AthleteSheet }) {
  return (
    <div className="flex items-center gap-4">
      <span
        aria-hidden
        className="grid size-16 shrink-0 place-items-center rounded-full bg-brand-soft font-display text-2xl font-extrabold text-brand-ink"
      >
        {athleteInitials(sheet.name)}
      </span>
      <div className="min-w-0">
        <h1 className="break-words font-display text-3xl font-extrabold leading-tight">
          {sheet.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          <span aria-hidden>{flagOf(sheet.countryCode)} </span>
          {sheet.countryCode} · {messages.events.gender[sheet.gender]}
        </p>
        {sheet.disciplines.length > 0 && (
          <ul aria-label={text.disciplines} className="mt-1 flex flex-wrap gap-1">
            {sheet.disciplines.map((d) => (
              <li key={d}>
                <ChipStatus tone={d === sheet.disciplines[0] ? "brand" : "neutral"}>{d}</ChipStatus>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** One key figure: a label and a big value. */
function Figure({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-card border border-border bg-card p-3">
      <dt className={`${label} break-words`}>{title}</dt>
      <dd className="font-mono text-xl font-bold tabular-nums">{children}</dd>
    </div>
  );
}

/** Where and when a record was set, as far as known. */
function Where({ record }: { record: SheetRecord }) {
  const parts = [
    record.meeting,
    record.date && dateFormat.format(new Date(`${record.date}T00:00:00Z`)),
  ].filter(Boolean);
  return parts.length > 0 ? (
    <dd className="break-words text-xs text-muted-foreground">{parts.join(" · ")}</dd>
  ) : null;
}

/**
 * The athlete page (#679): records only, no results nor head-to-head (the app does not have the
 * race history). Header, the Manager price, then a block per discipline with the PB and the SB of
 * the current `season`: each record shows once, with one legend for « ? » (#938).
 */
export function AthleteSheetView({
  sheet,
  season,
  status = "ready",
  retryHref = "",
}: {
  sheet?: AthleteSheet;
  season: number;
  status?: "ready" | "loading" | "error";
  retryHref?: string;
}) {
  if (status === "loading" || (status === "ready" && !sheet)) {
    return (
      <div role="status" aria-label={text.loading} className="flex flex-col gap-4">
        <div className="h-16 animate-pulse rounded-card bg-muted motion-reduce:animate-none" />
        <div className="h-20 animate-pulse rounded-card bg-muted motion-reduce:animate-none" />
        <div className="h-32 animate-pulse rounded-card bg-muted motion-reduce:animate-none" />
      </div>
    );
  }
  if (status === "error" || !sheet) {
    return <ErrorNotice retryHref={retryHref} message={messages.errors.ATHLETES_UNAVAILABLE} />;
  }
  const blocks = disciplineRecords(sheet, season);
  const unverified = blocks.some((b) => b.pb?.verified === false || b.sb?.verified === false);
  return (
    <div className="flex flex-col gap-6">
      <Hero sheet={sheet} />
      {sheet.managerPrice !== null && (
        <section aria-label={text.keyFigures}>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Figure title={text.managerPrice}>
              {messages.catalogue.price(sheet.managerPrice)}
            </Figure>
          </dl>
        </section>
      )}
      <section aria-labelledby="records-title" className="flex flex-col gap-2">
        <h2
          id="records-title"
          className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
        >
          {text.records}
        </h2>
        {blocks.length === 0 ? (
          <p className="rounded-card bg-muted p-4 text-sm">{text.noRecord}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {blocks.map((block) => (
              <li
                key={block.discipline}
                className="rounded-card border border-border bg-card p-3.5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="min-w-0 break-words font-bold">{block.discipline}</h3>
                  {block.main && <ChipStatus tone="brand">{text.main}</ChipStatus>}
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-3">
                  {(
                    [
                      [text.pbLong, block.pb],
                      [text.sbLong(season), block.sb],
                    ] as const
                  ).map(
                    ([title, record]) =>
                      record && (
                        <div key={title} className="flex min-w-0 flex-col">
                          <dt className={label}>{title}</dt>
                          <dd>
                            <Mark
                              record={record}
                              className="font-mono text-lg font-bold tabular-nums"
                            />
                          </dd>
                          <Where record={record} />
                        </div>
                      ),
                  )}
                </dl>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          {unverified && <span className="block">{text.unverifiedLegend}</span>}
          {text.source}
        </p>
      </section>
    </div>
  );
}
