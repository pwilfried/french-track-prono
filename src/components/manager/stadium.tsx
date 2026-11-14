import type { ReactNode } from "react";

import { messages } from "@/app/messages.fr";
import type { DisciplineFamily } from "@/domain/discipline";
import type { LineupPlace } from "@/domain/manager-lineup";
import { athleteInitials, cardGroupOf, shortAthleteName } from "@/domain/manager-team";
import { cn } from "@/lib/utils";

import { STADIUM_HEIGHT, STADIUM_WIDTH, stadiumSpots } from "./stadium-spots";

const W = STADIUM_WIDTH;
const H = STADIUM_HEIGHT;
const TRACK = 40;
const LANE = TRACK / 4;
/** Where a place beyond the stadium sits: in rows of four under it. */
const EXTRA_ROW = 70;

function StadiumDrawing({ flipped }: { flipped: boolean }) {
  const lanes = [1, 2, 3].map((n) => n * LANE);
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${W} ${H}`}
      className={cn("absolute inset-0 size-full", flipped && "rotate-180")}
    >
      {/* The track, its lanes, and the finish line at the end of the home straight. */}
      <rect width={W} height={H} rx={W / 2} className="fill-track" />
      {lanes.map((d) => (
        <rect
          key={d}
          x={d}
          y={d}
          width={W - 2 * d}
          height={H - 2 * d}
          rx={W / 2 - d}
          fill="none"
          className="stroke-white/40"
          strokeWidth={1}
        />
      ))}
      <line
        x1={W - TRACK}
        x2={W}
        y1={H - W / 2}
        y2={H - W / 2}
        className="stroke-white"
        strokeWidth={3}
      />
      <rect
        x={TRACK}
        y={TRACK}
        width={W - 2 * TRACK}
        height={H - 2 * TRACK}
        rx={W / 2 - TRACK}
        className="fill-field"
      />
      {/* The jumps: a runway down to its sand pit. */}
      <rect x={84} y={110} width={16} height={230} rx={3} className="fill-track" />
      <rect x={78} y={340} width={28} height={50} rx={4} className="fill-white/35" />
      {/* The throws: a sector opening from its circle. */}
      <path
        d="M208 390 L168 110 M208 390 L248 110"
        fill="none"
        className="stroke-white/60"
        strokeWidth={2}
      />
      <circle cx={208} cy={390} r={9} fill="none" className="stroke-white" strokeWidth={3} />
    </svg>
  );
}

/**
 * The Manager stadium seen from above (#775): a running track around a field, with one spot per
 * place of the lineup at its place (sprint on the home straight, middle and long distance on the
 * bends, jumps on the runway, throws in the sector, combined events in between, free places on the
 * back straight). `spots` gives what stands on each place, in their order. `flipped` turns the
 * drawing round, for the opponent's stadium facing the player's in a head-to-head.
 */
export function StadiumMap({
  label,
  places,
  spots,
  flipped = false,
}: {
  label: string;
  places: LineupPlace[];
  spots: ReactNode[];
  flipped?: boolean;
}) {
  const positions = stadiumSpots(places);
  let extras = 0;
  const style = positions.map((p) => {
    if (p) {
      const { x, y } = flipped ? { x: W - p.x, y: H - p.y } : p;
      return { left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` };
    }
    const k = extras++;
    return {
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
        <StadiumDrawing flipped={flipped} />
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

const SPOT = "flex h-[62px] w-14 flex-col items-center justify-between rounded-xl p-1 text-center";

/**
 * An athlete on their spot: family code (and bonus), initials (never a photo), then the short
 * name, or the points in a head-to-head. Gold for the player, light blue for the opponent; an
 * athlete at 0 gets a dashed red frame. With `label`, it reads as an article of that name.
 */
export function PlacedSpot({
  athlete,
  tone = "gold",
  points,
  bonus = 0,
  label,
  className,
}: {
  athlete: { name: string; family: DisciplineFamily };
  tone?: "gold" | "blue";
  /** In a head-to-head: the athlete's points, null until scored. */
  points?: number | null;
  bonus?: number;
  label?: string;
  className?: string;
}) {
  const scored = points !== undefined;
  return (
    <span
      role={label ? "article" : undefined}
      aria-label={label}
      className={cn(
        SPOT,
        "shadow-md",
        tone === "gold"
          ? "bg-gradient-to-b from-(--medal-gold-from) to-(--medal-gold-to) text-(--medal-gold-ink)"
          : "bg-gradient-to-b from-(--duel-blue-from) to-(--duel-blue-to) text-(--duel-blue-ink)",
        points === 0 && "outline-2 outline-offset-1 outline-dashed outline-primary",
        className,
      )}
    >
      <span className="flex w-full justify-between gap-0.5 text-[9px] font-extrabold leading-none tracking-wide">
        <span>{messages.team.codes[cardGroupOf(athlete.family)]}</span>
        {bonus > 0 && <span className="font-mono">{messages.team.bonus(bonus)}</span>}
      </span>
      <span
        aria-hidden
        className="grid size-7 place-items-center rounded-full border border-current/30 bg-white/50 font-display text-xs font-extrabold"
      >
        {athleteInitials(athlete.name)}
      </span>
      <span
        className={cn(
          "w-full truncate text-[10px] font-extrabold leading-tight",
          scored && "font-mono tabular-nums",
        )}
      >
        {scored ? messages.team.points(points) : shortAthleteName(athlete.name)}
      </span>
    </span>
  );
}

/** An empty spot, dashed on the track or the grass: « + » and its family, or « Personne ». */
export function EmptySpot({
  label,
  fillable,
  children,
  className,
}: {
  label: string;
  fillable: boolean;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        SPOT,
        "justify-center gap-0.5 border-2 border-dashed font-bold text-field-foreground",
        fillable ? "border-white bg-black/25" : "border-white/40 bg-black/40",
        className,
      )}
    >
      <span aria-hidden className={fillable ? "text-xl leading-none" : "text-[10px] leading-none"}>
        {fillable ? messages.lineup.add : messages.lineup.nobody}
      </span>
      <span className="w-full break-words text-[9px] leading-tight">{label}</span>
      {children}
    </span>
  );
}
