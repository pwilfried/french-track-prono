import { messages } from "@/app/messages.fr";
import { Statuette, type StatuetteShape } from "@/components/band/statuette";
import type { Trophy, TrophyKind, TrophyShelf } from "@/domain/trophies";

const text = messages.trophies;

/** The form of each kind: the animal of its league, or the drawing of the feat (#856). */
const FORM: Record<Exclude<TrophyKind, "league" | "manager">, StatuetteShape> = {
  general: "laurel",
  chrono: "chrono",
  record: "record",
  witness: "witness",
};

/** The forms the latest shelf keeps a slot for, won or still to win (#856). */
const FEATS = Object.keys(FORM) as (keyof typeof FORM)[];

/** The statuette's name (« Guépard d'or », « Chrono figé ») and what it was won in. */
export function trophyLabel(trophy: Trophy): { name: string; detail: string } {
  const kind = text.kinds[trophy.kind];
  const base =
    trophy.kind === "league" && trophy.animal ? messages.band.animals[trophy.animal] : kind.name;
  return {
    name: trophy.metal ? `${base} ${messages.band.metals[trophy.metal]}` : kind.name,
    detail: !trophy.leagueName
      ? kind.detail
      : trophy.kind === "manager"
        ? text.managerDetail(trophy.leagueName)
        : trophy.leagueName,
  };
}

function TrophyStatuette({ trophy }: { trophy: Trophy }) {
  const label = trophyLabel(trophy);
  // A feat has no metal of its own: it is cast in gold.
  const metal = trophy.metal ?? "gold";
  const shape =
    trophy.kind === "league" || trophy.kind === "manager"
      ? (trophy.animal ?? "lievre")
      : FORM[trophy.kind];
  return (
    <li data-kind={trophy.kind} data-metal={trophy.metal ?? "none"} className="min-w-0">
      <Statuette
        shape={shape}
        metal={metal}
        title={label.name}
        plaque={[label.detail, text.season(trophy.season)]}
        center={trophy.kind === "general" ? text.laurelPlace[metal] : undefined}
      />
    </li>
  );
}

function EmptySlot({ kind }: { kind: keyof typeof FORM }) {
  return (
    <li data-kind={kind} data-metal="empty" className="min-w-0">
      <Statuette
        shape={FORM[kind]}
        metal={null}
        title={text.kinds[kind].name}
        plaque={[text.toWin, text.conditions[kind]]}
      />
    </li>
  );
}

/** « Vitrine » (#822): one shelf per season, the latest first; an empty one says how to start. */
export function TrophyShowcase({ shelves }: { shelves: TrophyShelf[] }) {
  return (
    <section aria-labelledby="trophies" className="flex flex-col gap-2">
      <h2
        id="trophies"
        className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
      >
        {text.title}
      </h2>
      {shelves.length === 0 ? (
        <p className="rounded-card border border-dashed border-border bg-muted p-4 text-sm font-semibold text-muted-foreground">
          {text.empty}
        </p>
      ) : (
        shelves.map((shelf, i) => (
          <div
            key={shelf.season}
            role="group"
            aria-labelledby={`shelf-${shelf.season}`}
            className="flex flex-col gap-3 rounded-card bg-card px-3 pt-3 ring-1 ring-border"
          >
            <p
              id={`shelf-${shelf.season}`}
              className="flex items-baseline justify-between gap-2 font-semibold"
            >
              <span>{text.season(shelf.season)}</span>
              <span className="text-sm font-normal text-muted-foreground">
                {text.count(shelf.trophies.length)}
              </span>
            </p>
            {/* The shelf itself: the statuettes stand on a thick board. On the latest one, each
                feat not won yet keeps its slot, dashed, with what it takes. */}
            <ul className="-mx-3 grid grid-cols-3 gap-x-1.5 gap-y-3 border-b-[6px] border-gold-ink/40 px-2 pb-3">
              {shelf.trophies.map((t) => (
                <TrophyStatuette key={`${t.kind}-${t.leagueId ?? ""}`} trophy={t} />
              ))}
              {i === 0 &&
                FEATS.filter((k) => !shelf.trophies.some((t) => t.kind === k)).map((k) => (
                  <EmptySlot key={k} kind={k} />
                ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
