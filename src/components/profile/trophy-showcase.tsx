import { messages } from "@/app/messages.fr";
import type { Metal, Trophy, TrophyShelf } from "@/domain/trophies";
import { cn } from "@/lib/utils";

const text = messages.trophies;

const METAL_STYLE: Record<Metal, string> = {
  gold: "bg-gradient-to-b from-(--medal-gold-from) to-(--medal-gold-to)",
  silver: "bg-gradient-to-b from-(--medal-silver-from) to-(--medal-silver-to)",
  bronze: "bg-gradient-to-b from-(--medal-bronze-from) to-(--medal-bronze-to)",
};

/** The statuette's name (« Guépard d'or », « Chrono figé ») and what it was won in. */
export function trophyLabel(trophy: Trophy): { emoji: string; name: string; detail: string } {
  const kind = text.kinds[trophy.kind];
  const animal = trophy.animal
    ? { emoji: text.animalEmoji[trophy.animal], name: messages.band.animals[trophy.animal] }
    : null;
  const base = trophy.kind === "league" && animal ? animal : kind;
  const name = trophy.metal ? `${base.name} ${messages.band.metals[trophy.metal]}` : kind.name;
  return {
    emoji: trophy.kind === "league" && animal ? animal.emoji : kind.emoji,
    name,
    detail: !trophy.leagueName
      ? kind.detail
      : trophy.kind === "manager"
        ? text.managerDetail(trophy.leagueName)
        : trophy.leagueName,
  };
}

function Statuette({ trophy }: { trophy: Trophy }) {
  const label = trophyLabel(trophy);
  return (
    <li
      data-kind={trophy.kind}
      data-metal={trophy.metal ?? "none"}
      className="flex min-w-0 flex-col items-center gap-1 px-1 pb-2 text-center"
    >
      <span
        aria-hidden="true"
        className={cn(
          "grid size-14 place-items-center rounded-full text-2xl shadow-sm ring-1 ring-black/10",
          trophy.metal ? METAL_STYLE[trophy.metal] : "bg-brand-soft",
        )}
      >
        {label.emoji}
      </span>
      <span className="w-full break-words text-sm font-bold leading-tight">{label.name}</span>
      <span className="w-full break-words text-[11px] leading-tight text-muted-foreground">
        {label.detail}
      </span>
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
        shelves.map((shelf) => (
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
            {/* The shelf itself: the statuettes stand on a thick board. */}
            <ul className="-mx-3 grid grid-cols-3 gap-y-2 border-b-[6px] border-gold-ink/40 px-2">
              {shelf.trophies.map((t) => (
                <Statuette key={`${t.kind}-${t.leagueId ?? ""}`} trophy={t} />
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
