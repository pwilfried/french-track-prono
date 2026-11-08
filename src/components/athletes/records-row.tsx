import { messages } from "@/app/messages.fr";
import type { AthleteRecord, RecordRow } from "@/domain/athlete";

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function Mark({ label, record }: { label: string; record: AthleteRecord | null }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="font-mono text-xl font-bold tabular-nums">{record?.mark ?? "—"}</dd>
      {record?.date && (
        <dd className="text-xs text-muted-foreground">
          {dateFormat.format(new Date(`${record.date}T00:00:00Z`))}
        </dd>
      )}
    </div>
  );
}

/** The records band: per discipline, PB and SB side by side. Scrolls sideways when needed. */
export function RecordsRow({ rows }: { rows: RecordRow[] }) {
  if (rows.length === 0) {
    return <p className="rounded-card bg-muted p-4 text-sm">{messages.athlete.noRecord}</p>;
  }
  return (
    <ul className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1">
      {rows.map((row) => (
        <li
          key={row.discipline}
          className="min-w-44 shrink-0 snap-start rounded-card border border-border bg-card p-3.5"
        >
          <h3 className="break-words font-bold">{row.discipline}</h3>
          <dl className="mt-2 grid grid-cols-2 gap-3">
            <Mark label={messages.athlete.pr} record={row.pr} />
            <Mark label={messages.athlete.sb} record={row.sb} />
          </dl>
        </li>
      ))}
    </ul>
  );
}
