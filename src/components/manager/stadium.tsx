import type { ReactNode } from "react";

import { messages } from "@/app/messages.fr";
import type { DisciplineFamily } from "@/domain/discipline";
import type { LineupPlace } from "@/domain/manager-lineup";
import { cardGroupOf, shortAthleteName } from "@/domain/manager-team";
import { cn } from "@/lib/utils";

import { CARD_WIDTH, STADIUM_RATIO, stadiumSpots } from "./stadium-spots";

const W = 100;
const H = W * STADIUM_RATIO;
/** Where a place beyond the stadium sits: in rows of four under it. */
const EXTRA_ROW = 54;

const RACES: DisciplineFamily[] = ["sprint", "hurdles", "middle", "long", "relay"];
const isRace = (family: DisciplineFamily) => RACES.includes(family);

/** The oval seen from above: a brick red track with a thin light line, the green field inside. */
function StadiumDrawing() {
  return (
    <svg aria-hidden viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full">
      <ellipse cx={W / 2} cy={H / 2} rx={W / 2 - 3} ry={H / 2} className="fill-track" />
      <ellipse
        cx={W / 2}
        cy={H / 2}
        rx={W / 2 - 5.5}
        ry={H / 2 - 2.5}
        fill="none"
        className="stroke-white/70"
        strokeWidth={0.4}
      />
      <ellipse cx={W / 2} cy={H / 2} rx={W / 2 - 11} ry={H / 2 - 8} className="fill-field" />
    </svg>
  );
}

/**
 * The Manager stadium seen from above (#775), as in the validated mock-up: one spot per place of
 * the lineup at its place (races on the track, field events on the grass, `stadium-spots.ts`), the
 * same in the lineup and in both stadiums of a head-to-head. `spots` gives what stands on each
 * place, in their order.
 */
export function StadiumMap({
  label,
  places,
  spots,
}: {
  label: string;
  places: LineupPlace[];
  spots: ReactNode[];
}) {
  const positions = stadiumSpots(places);
  let extras = 0;
  const style = positions.map((p) => {
    const width = `${CARD_WIDTH}%`;
    if (p) return { width, left: `${p.x}%`, top: `${p.y}%` };
    const k = extras++;
    return {
      width,
      left: `${12.5 + 25 * (k % 4)}%`,
      top: `calc(100% + ${EXTRA_ROW / 2 + 8 + Math.floor(k / 4) * EXTRA_ROW}px)`,
    };
  });
  return (
    <div
      className="relative mx-auto w-full max-w-sm"
      style={{ marginBottom: extras > 0 ? Math.ceil(extras / 4) * EXTRA_ROW + 16 : undefined }}
    >
      <div className="relative" style={{ aspectRatio: `${W} / ${H}` }}>
        <StadiumDrawing />
        <ul aria-label={label} className="absolute inset-0">
          {spots.map((spot, i) => (
            <li key={i} className="absolute -translate-x-1/2 -translate-y-1/2" style={style[i]}>
              {spot}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const SPOT =
  "flex h-[46px] w-full flex-col items-center justify-center gap-px rounded-lg px-1 text-center";

/**
 * An athlete on their spot (#775): the discipline in capitals (navy for a race, red for a field
 * event), the first name and the initial of the last name, then in a head-to-head the points
 * (« à venir » until scored), « ▲ » and a thick navy frame when they win the duel of their place.
 * Races on gold, field events on white, in both themes. With `label`, it reads as an article.
 */
export function PlacedSpot({
  athlete,
  points,
  won = false,
  label,
}: {
  athlete: { name: string; discipline: string; family: DisciplineFamily };
  /** In a head-to-head: the athlete's points, null until scored. */
  points?: number | null;
  won?: boolean;
  label?: string;
}) {
  const race = isRace(athlete.family);
  return (
    <span
      role={label ? "article" : undefined}
      aria-label={label}
      className={cn(
        SPOT,
        "text-spot-ink shadow-md",
        race ? "bg-spot-race" : "bg-spot-field",
        won && "outline-3 outline-spot-ink",
      )}
    >
      <span
        className={cn(
          "w-full truncate text-[9px] font-extrabold uppercase leading-none tracking-wide",
          !race && "text-spot-field-label",
        )}
      >
        {athlete.discipline}
      </span>
      <span className="w-full truncate text-[11px] font-bold leading-tight">
        {shortAthleteName(athlete.name)}
      </span>
      {points !== undefined && (
        <span className="w-full truncate font-mono text-[11px] font-bold leading-tight tabular-nums">
          {points === null ? messages.managerDuel.toCome : points}
          {won && ` ${messages.managerDuel.won}`}
        </span>
      )}
    </span>
  );
}

/** A small square of an athlete's colour and family code, next to their name in a list. */
export function SpotSwatch({
  family,
  muted = false,
}: {
  family: DisciplineFamily;
  muted?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-11 shrink-0 place-items-center rounded-lg text-[10px] font-extrabold text-spot-ink shadow-sm ring-1 ring-border",
        isRace(family) ? "bg-spot-race" : "bg-spot-field",
        muted && "grayscale",
      )}
    >
      {messages.team.codes[cardGroupOf(family)]}
    </span>
  );
}

/** An empty spot, dashed on the track or the grass: « + » and its family, or « Personne ». */
export function EmptySpot({
  label,
  fillable,
  children,
}: {
  label: string;
  fillable: boolean;
  children?: ReactNode;
}) {
  return (
    <span
      className={cn(
        SPOT,
        "border-2 border-dashed font-bold text-field-foreground",
        fillable ? "border-white bg-black/25" : "border-white/40 bg-black/40",
      )}
    >
      <span aria-hidden className={fillable ? "text-lg leading-none" : "text-[10px] leading-none"}>
        {fillable ? messages.lineup.add : messages.lineup.nobody}
      </span>
      <span className="w-full truncate text-[9px] leading-tight">{label}</span>
      {children}
    </span>
  );
}
