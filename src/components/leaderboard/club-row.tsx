"use client";

import { useId, useState } from "react";

import { messages } from "@/app/messages.fr";
import type { RankedClub } from "@/domain/club-ranking";

import { decimal } from "./decimal";

const text = messages.clubRanking;
const medals = ["🥇", "🥈", "🥉"];

/** A player of a club, as the unfolded line lists them. */
export type ClubMember = { userId: string; pseudo: string; points: number };

/**
 * One club of the ranking (#1132): rank (a medal for the first three), name, players and average.
 * Touching it unfolds its players with their points; the player's club is highlighted.
 */
export function ClubRow({
  club,
  mine,
  meId,
  defaultOpen = false,
}: {
  club: RankedClub<ClubMember>;
  mine: boolean;
  meId?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const listId = useId();
  return (
    <li
      aria-current={mine ? "true" : undefined}
      className="flex flex-col aria-[current]:bg-gold-soft aria-[current]:text-gold-ink"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span aria-hidden="true" className="w-7 shrink-0 text-center font-mono text-lg font-bold">
          {medals[club.rank - 1] ?? club.rank}
        </span>
        <span className="sr-only">{text.rank(club.rank)}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold [overflow-wrap:anywhere]">{club.name}</span>
          <span className="text-xs opacity-80">{text.players(club.players)}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end leading-tight">
          <span className="font-mono font-bold tabular-nums">{decimal(club.average)}</span>
          <span className="text-xs opacity-80">{text.averageShort}</span>
        </span>
        <span aria-hidden="true" className="shrink-0 text-xs opacity-70">
          {open ? "▲" : "▼"}
        </span>
      </button>
      {open && (
        <ul id={listId} aria-label={text.membersOf(club.name)} className="flex flex-col px-4 pb-3">
          {club.members.map((m) => (
            <li
              key={m.userId}
              className={`flex min-h-9 items-center justify-between gap-3 border-t border-border/60 pl-10 text-sm ${m.userId === meId ? "font-bold" : ""}`}
            >
              <span className="min-w-0 [overflow-wrap:anywhere]">{m.pseudo}</span>
              <span className="shrink-0 font-mono tabular-nums">{text.points(m.points)}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
