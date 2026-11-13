"use client";

import { useState, type ComponentProps } from "react";

import { messages } from "@/app/messages.fr";
import { LineupBoard } from "@/components/manager/lineup-board";

import { saveLineupAction } from "../../../lineup-actions";

/** The stadium of one competition, wired to the database (#427). */
export function LineupForm({
  leagueId,
  competitionId,
  slug,
  ...board
}: Omit<ComponentProps<typeof LineupBoard>, "onValidate" | "error"> & {
  leagueId: string;
  competitionId: string;
  slug: string;
}) {
  const [error, setError] = useState<string>();
  return (
    <LineupBoard
      {...board}
      error={error}
      onValidate={async (athleteIds) => {
        const result = await saveLineupAction({ leagueId, competitionId, slug, athleteIds });
        setError(result.error ? messages.errors[result.error] : undefined);
        return !result.error;
      }}
    />
  );
}
