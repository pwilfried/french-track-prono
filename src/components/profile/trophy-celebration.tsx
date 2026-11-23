"use client";

import { useEffect, useRef, useState } from "react";

import { messages } from "@/app/messages.fr";
import { Statuette } from "@/components/band/statuette";
import { buttonVariants } from "@/components/ui/button";
import type { Trophy } from "@/domain/trophies";
import { cn } from "@/lib/utils";

import { statuetteOf } from "./trophy-showcase";

const text = messages.trophies;
const words = text.celebration;

/** Confetti: gold, red and white, spread by position, fall time and delay (no randomness). */
const CONFETTI = Array.from({ length: 18 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  delay: `${((i * 53) % 40) / 10}s`,
  color: ["#F5C542", "#E5484D", "#FFFFFF"][i % 3]!,
}));

/** What the trophy was won for: « 1er de Ma Ligue », « Meilleure soirée de… ». */
function reason(trophy: Trophy): string {
  const league = trophy.leagueName ?? "";
  const place = trophy.metal ? (words.place[trophy.metal] ?? "") : "";
  switch (trophy.kind) {
    case "league":
      return words.reason.league(place, league);
    case "manager":
      return words.reason.manager(place, league);
    case "general":
      return words.reason.general(trophy.metal ? text.laurelPlace[trophy.metal] : "");
    case "chrono":
      return words.reason.chrono(league);
    case "record":
      return words.reason.record(league);
    case "witness":
      return words.reason.witness;
  }
}

/**
 * The celebration of the new trophies (#1135), full screen at the first visit of the profile after
 * the award: one trophy per screen, in the order of the shelf. Closing it, « Plus tard » or the
 * last button, stores them as seen so it comes only once, then leads to the showcase. The confetti
 * stop with reduced motion.
 */
export function TrophyCelebration({
  trophies,
  onSeen,
}: {
  trophies: Trophy[];
  onSeen: () => Promise<void>;
}) {
  const [open, setOpen] = useState(true);
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const primary = useRef<HTMLButtonElement>(null);

  const close = async () => {
    setSaving(true);
    try {
      await onSeen();
    } finally {
      setOpen(false);
      setSaving(false);
      document.getElementById("trophies")?.scrollIntoView({ block: "start" });
    }
  };

  useEffect(() => {
    if (open && trophies.length > 0) primary.current?.focus();
  }, [open, index, trophies.length]);

  const trophy = trophies[index];
  if (!open || !trophy) return null;
  const last = index === trophies.length - 1;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={words.label}
      className="fixed inset-0 z-50 flex flex-col items-center overflow-y-auto bg-[#052b5c] px-5 py-6 text-white"
      style={{
        backgroundImage: "radial-gradient(circle at 50% 40%, #0b4a94 0%, #052b5c 70%)",
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !saving) void close();
      }}
    >
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        {CONFETTI.map((c, i) => (
          <span
            key={i}
            className="absolute top-0 hidden h-3 w-2 rounded-sm motion-safe:block motion-safe:animate-confetti"
            style={{ left: c.left, animationDelay: c.delay, backgroundColor: c.color }}
          />
        ))}
      </div>
      <div className="relative flex w-full max-w-md flex-1 flex-col items-center gap-5">
        <p className="flex w-full items-center justify-between gap-2">
          <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-bold">
            {words.badge}
          </span>
          {trophies.length > 1 && (
            <span
              aria-label={words.step(index + 1, trophies.length)}
              className="font-mono text-sm font-bold"
            >
              {words.counter(index + 1, trophies.length)}
            </span>
          )}
        </p>
        <div
          key={index}
          role="status"
          className="flex w-full flex-1 flex-col items-center justify-center gap-3 text-center"
        >
          <div className="w-24 [zoom:1.7] motion-safe:animate-trophy-pop">
            <Statuette {...statuetteOf(trophy)} />
          </div>
          <p className="mt-10 font-display text-lg font-extrabold break-words">{reason(trophy)}</p>
          <p className="font-semibold break-words text-[#F5C542]">{words.tease[trophy.kind]}</p>
        </div>
        {trophies.length > 1 && (
          <span aria-hidden="true" className="flex gap-2">
            {trophies.map((t, i) => (
              <span
                key={i}
                className={cn("size-2 rounded-full", i === index ? "bg-white" : "bg-white/35")}
              />
            ))}
          </span>
        )}
        <button
          ref={primary}
          type="button"
          disabled={saving}
          className={cn(buttonVariants({ size: "lg" }), "w-full")}
          onClick={() => (last ? void close() : setIndex(index + 1))}
        >
          {saving ? words.saving : last ? words.last : words.next}
        </button>
        <button
          type="button"
          disabled={saving}
          className="min-h-11 px-4 text-sm font-semibold underline underline-offset-4 disabled:opacity-50"
          onClick={() => void close()}
        >
          {words.later}
        </button>
      </div>
    </div>
  );
}
