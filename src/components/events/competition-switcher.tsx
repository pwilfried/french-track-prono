"use client";

import { useState } from "react";

import { CompetitionButton } from "./competition-button";
import { CompetitionSheet, type SheetCompetition } from "./competition-sheet";

/** The head card of the « Compétitions » tab and the sheet it opens (#659). */
export function CompetitionSwitcher({
  shown,
  competitions,
  myLeagueSlugs,
  today,
}: {
  shown: SheetCompetition;
  competitions: SheetCompetition[];
  myLeagueSlugs: string[];
  today: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <CompetitionButton
        competition={shown}
        expanded={open}
        onChange={competitions.length > 1 ? () => setOpen(true) : undefined}
      />
      <CompetitionSheet
        open={open}
        onClose={() => setOpen(false)}
        competitions={competitions}
        myLeagueSlugs={myLeagueSlugs}
        selected={shown.slug}
        today={today}
      />
    </>
  );
}
