import { messages } from "@/app/messages.fr";
import { ChipStatus } from "@/components/ui/chip-status";
import type { DisciplineFamily } from "@/domain/discipline";
import type { CatalogueAthlete } from "@/domain/manager-catalogue";
import { cn } from "@/lib/utils";

const text = messages.catalogue;

/** A sign per family of events, to scan the catalogue by eye (#503). */
const FAMILY_SIGN: Record<DisciplineFamily, string> = {
  sprint: "⚡",
  hurdles: "🚧",
  middle: "🏃",
  long: "🛣️",
  relay: "🤝",
  horizontal_jumps: "➡️",
  vertical_jumps: "⬆️",
  throws: "🥏",
  combined: "🏅",
};

/**
 * One athlete of the mercato catalogue, on one compact line (#503): who, which event, PB (the
 * SB only when it differs), the price or « Recruté ». `children` goes at the bottom: the
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
          className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-lg"
        >
          {FAMILY_SIGN[athlete.family]}
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
        <p className="font-mono text-sm tabular-nums">
          <span className="font-bold">
            {text.pb} {pb ?? "—"}
          </span>
          {sb && sb !== pb && (
            <span className="text-muted-foreground">
              {" "}
              · {text.sb} {sb}
            </span>
          )}
        </p>
        {children}
      </div>
    </article>
  );
}
