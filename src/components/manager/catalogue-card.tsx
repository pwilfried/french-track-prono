import { messages } from "@/app/messages.fr";
import type { CatalogueAthlete } from "@/domain/manager-catalogue";

const text = messages.catalogue;

/** One athlete of the mercato catalogue: who, which discipline, PB and SB, price, free or not. */
export function CatalogueCard({ athlete }: { athlete: CatalogueAthlete }) {
  return (
    <article
      aria-label={athlete.name}
      className={`flex flex-col gap-2 rounded-card border border-border bg-card p-3.5 ${athlete.available ? "" : "opacity-60"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words font-extrabold leading-tight">{athlete.name}</h3>
          <p className="text-sm text-muted-foreground">
            {athlete.countryCode} · {text.sexes[athlete.sex]} · {athlete.discipline}
          </p>
        </div>
        <p
          aria-label={text.priceLabel(athlete.price)}
          className="shrink-0 rounded-full bg-gold-soft px-2.5 py-1 font-mono text-sm font-bold"
        >
          {text.price(athlete.price)}
        </p>
      </div>
      <div className="flex items-end justify-between gap-3">
        <dl className="flex gap-5">
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {text.pb}
            </dt>
            <dd className="font-mono font-bold tabular-nums">{athlete.pb ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {text.sb}
            </dt>
            <dd className="font-mono font-bold tabular-nums">{athlete.sb ?? "—"}</dd>
          </div>
        </dl>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${athlete.available ? "bg-success/15 text-success-text" : "bg-muted text-muted-foreground"}`}
        >
          {athlete.available ? text.available : text.taken}
        </span>
      </div>
    </article>
  );
}
