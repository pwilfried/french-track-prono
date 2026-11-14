import { messages } from "@/app/messages.fr";
import type { Metal } from "@/domain/trophies";
import { cn } from "@/lib/utils";

import { Animal, type AnimalKind } from "./animal";

/** The level band of each metal: the medal gradients of the theme, AA ink on top. */
const METAL_BAND: Record<Metal, string> = {
  gold: "bg-gradient-to-r from-(--medal-gold-from) to-(--medal-gold-to) text-(--medal-gold-ink)",
  silver:
    "bg-gradient-to-r from-(--medal-silver-from) to-(--medal-silver-to) text-(--medal-silver-ink)",
  bronze:
    "bg-gradient-to-r from-(--medal-bronze-from) to-(--medal-bronze-to) text-(--medal-bronze-ink)",
};

// Below the level band, in the white of the bib.
const PINS = ["left-1.5 top-7", "right-1.5 top-7"];

/**
 * A badge as a bib (#768): the band of its level at the top, the animal of its discipline large
 * behind, the number and the name at the bottom. Without a level the badge is still to win: grey,
 * with the « ? » medallion. A white card in both themes, like a real bib.
 */
export function Dossard({
  animal,
  number,
  name,
  level,
  className = "",
}: {
  animal: AnimalKind;
  /** Printed large, like a bib number. */
  number: string;
  name: string;
  /** Null while the badge is still to win. */
  level: Metal | null;
  className?: string;
}) {
  const locked = level === null;
  return (
    <div
      data-level={level ?? "locked"}
      className={cn(
        "relative flex w-full flex-col overflow-hidden rounded-xl border-2 shadow-sm",
        locked
          ? "border-dashed border-[#9AA4B2] bg-[#EEF1F5] text-[#3F4856]"
          : "border-[#B8C2D3] bg-white text-[#052B5C]",
        className,
      )}
    >
      {PINS.map((pin) => (
        <span
          key={pin}
          aria-hidden="true"
          className={`absolute ${pin} z-10 size-2 rounded-full border border-black/30 bg-[#D5DAE1]`}
        />
      ))}
      <span
        className={cn(
          "whitespace-nowrap px-1 py-0.5 text-center text-[10px] font-extrabold uppercase tracking-wide",
          locked ? "bg-[#D5DAE1] text-[#3F4856]" : METAL_BAND[level],
        )}
      >
        {locked ? messages.profile.badgeLocked : messages.badgeLevels.name[level]}
      </span>
      <span className="relative flex aspect-[5/4] items-center justify-center">
        <Animal
          kind={locked ? "locked" : animal}
          size="large"
          className={cn("absolute size-[78%]", locked ? "" : "opacity-90")}
        />
      </span>
      <span className="flex flex-1 flex-col items-center bg-white/85 px-1 pb-1.5 pt-0.5 leading-none">
        <span className="font-mono text-xl font-extrabold tabular-nums">{number}</span>
        <span className="mt-0.5 max-w-full break-words text-center text-[11px] font-bold leading-tight">
          {name}
        </span>
      </span>
    </div>
  );
}
