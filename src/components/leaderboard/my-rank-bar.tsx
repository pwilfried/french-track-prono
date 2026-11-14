"use client";

import { useEffect, useState } from "react";

import { messages } from "@/app/messages.fr";

/** Room taken at the bottom of the screen by the bar itself and the tab bar under it. */
const COVERED_BOTTOM = "-140px";

/**
 * The player's rank, stuck at the bottom of a ranking. « Autour de moi » jumps to their line
 * (`#moi`), and only shows while that line is out of view (#710): never in a ranking that fits
 * on screen, nor when the player is not in the list.
 */
export function MyRankBar({ rank, points }: { rank: number; points: number }) {
  const [outOfView, setOutOfView] = useState(false);

  useEffect(() => {
    const line = document.getElementById("moi");
    if (!line) return;
    const observer = new IntersectionObserver(
      ([entry]) => setOutOfView(entry ? !entry.isIntersecting : false),
      { rootMargin: `0px 0px ${COVERED_BOTTOM} 0px` },
    );
    observer.observe(line);
    return () => observer.disconnect();
  }, []);

  return (
    <p className="sticky bottom-20 flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-foreground py-1.5 pl-3.5 pr-1.5 font-extrabold text-background shadow-lg md:bottom-3">
      <span>{messages.ranking.you(rank, points)}</span>
      {outOfView && (
        <a
          href="#moi"
          className="inline-flex min-h-11 items-center rounded-xl px-3 underline underline-offset-4"
        >
          {messages.ranking.aroundMe}
        </a>
      )}
    </p>
  );
}
