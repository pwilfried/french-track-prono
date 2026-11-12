import type { ReactNode } from "react";

import { messages } from "@/app/messages.fr";

const text = messages.leagues;

/**
 * The official league, « Ligue FrenchTrack » (#553), while the player is not in it: a night-blue
 * block above the public leagues. The join form comes as children.
 */
export function OfficialLeague({
  name,
  memberCount,
  children,
}: {
  name: string;
  memberCount: number;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby="official-league"
      className="hero flex flex-col gap-3 rounded-card p-4"
    >
      <p className="flex flex-wrap gap-2 text-xs font-bold">
        <span className="rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">
          {text.officialBadge}
        </span>
        <span className="rounded-full bg-white/15 px-2 py-0.5">{text.officialOpen}</span>
      </p>
      <h2 id="official-league" className="break-words font-display text-xl font-extrabold">
        {name}
      </h2>
      <p className="text-sm">
        {text.officialPitch} · {text.members(memberCount)}
      </p>
      {children}
    </section>
  );
}
