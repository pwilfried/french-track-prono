import { messages } from "@/app/messages.fr";
import type { Animal as AnimalName } from "@/domain/band";
import { cn } from "@/lib/utils";

import { Animal } from "./animal";
import type { Metal } from "./dossard";

const METAL_RING: Record<Metal, string> = {
  gold: "bg-gradient-to-b from-(--medal-gold-from) to-(--medal-gold-to)",
  silver: "bg-gradient-to-b from-(--medal-silver-from) to-(--medal-silver-to)",
  bronze: "bg-gradient-to-b from-(--medal-bronze-from) to-(--medal-bronze-to)",
};

/**
 * A trophy as a statuette of the band (#768): the animal cast in gold, silver or bronze on a
 * wooden base with an engraved plaque (league, season, place). Without a metal the slot of the
 * display case is still empty: a grey « ? » silhouette and what it takes to win it.
 */
export function Statuette({
  animal,
  metal,
  plaque,
  className = "",
}: {
  animal: AnimalName;
  /** Null for an empty slot of the display case. */
  metal: Metal | null;
  /** The engraved lines: league, season, place; or, for an empty slot, how to win it. */
  plaque: string[];
  className?: string;
}) {
  const name = messages.band.animals[animal];
  const title = metal
    ? messages.band.statuette(name, messages.band.metals[metal])
    : messages.band.toWin;
  return (
    <figure
      data-metal={metal ?? "empty"}
      className={cn("flex w-full flex-col items-center", className)}
    >
      <span
        className={cn(
          "grid size-24 place-items-center rounded-full p-1.5 shadow-md",
          metal ? METAL_RING[metal] : "border-2 border-dashed border-[#9AA4B2] bg-[#D5DAE1]",
        )}
      >
        <Animal
          kind={metal ? animal : "locked"}
          size="large"
          className={cn("size-full", metal ? "" : "opacity-80")}
        />
      </span>
      {/* The base: a dark wooden plinth in both themes, the plaque on it. */}
      <span
        aria-hidden="true"
        className={cn("-mt-1 h-3 w-16 rounded-t-sm", metal ? "bg-[#6B4226]" : "bg-[#9AA4B2]")}
      />
      <figcaption
        className={cn(
          "flex w-full flex-col items-center rounded-md px-2 py-1.5 text-center",
          metal ? "bg-[#4A2C17] text-[#F3E3C7]" : "bg-muted text-muted-foreground",
        )}
      >
        <span className="text-xs font-extrabold">{title}</span>
        {plaque.map((line) => (
          <span key={line} className="max-w-full break-words text-[11px] leading-tight">
            {line}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
