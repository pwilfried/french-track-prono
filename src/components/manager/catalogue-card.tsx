import { messages } from "@/app/messages.fr";
import { ChipStatus } from "@/components/ui/chip-status";
import { flagOf } from "@/domain/flag";
import type { CatalogueAthlete } from "@/domain/manager-catalogue";
import { cn } from "@/lib/utils";

const text = messages.catalogue;

/**
 * One athlete of the mercato catalogue, compact (#503): flag, who, which event, the price or
 * « Recruté », then PB and SB. `children` goes at the bottom: the
 * player's bid while the mercato is open (#422).
 */
export function CatalogueCard({
  athlete,
  children,
}: {
  athlete: CatalogueAthlete;
  children?: React.ReactNode;
}) {
  const { name, countryCode, discipline, sex, pb, sb, price, available } = athlete;
  return (
    <article
      aria-label={name}
      className={cn(
        "flex flex-col gap-2 rounded-card border border-border bg-card p-3",
        !available && "opacity-60",
      )}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-2xl"
        >
          {flagOf(countryCode) ?? <span className="text-xs font-bold">{countryCode}</span>}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="break-words font-extrabold leading-tight">{name}</h3>
          <p className="text-sm text-muted-foreground">
            {countryCode} · {discipline} {text.sexShort[sex]}
          </p>
        </div>
        {available ? (
          <ChipStatus tone="gold" className="shrink-0 font-mono text-sm">
            <span aria-hidden>{text.price(price)}</span>
            <span className="sr-only">{text.priceLabel(price)}</span>
          </ChipStatus>
        ) : (
          <ChipStatus className="shrink-0">{text.taken}</ChipStatus>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <dl className="flex gap-4">
          {[
            [text.pb, pb],
            [text.sb, sb],
          ].map(([label, mark]) => (
            <div key={label}>
              <dt className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {label}
              </dt>
              <dd className="font-mono text-sm font-bold tabular-nums">{mark ?? "—"}</dd>
            </div>
          ))}
        </dl>
        {children}
      </div>
    </article>
  );
}
