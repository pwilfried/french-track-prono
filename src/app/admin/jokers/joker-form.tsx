"use client";

import { useActionState } from "react";

import { messages } from "@/app/messages.fr";
import { SubmitButton } from "@/components/account/submit-button";
import { ChipStatus } from "@/components/ui/chip-status";

import { setJokerActiveAction, type JokerState } from "./actions";

const text = messages.leagueJokers;

/** One joker of the catalogue: its name, what it does, active or not, and the switch. */
export function JokerForm({
  game,
  joker,
  name,
  explain,
  active,
}: {
  game: "predictions" | "manager";
  joker: string;
  name: string;
  explain: string | null;
  active: boolean;
}) {
  const [state, action] = useActionState<JokerState, FormData>(setJokerActiveAction, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="game" value={game} />
      <input type="hidden" name="joker" value={joker} />
      <input type="hidden" name="active" value={active ? "0" : "1"} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-extrabold break-words">🃏 {name}</span>
        <ChipStatus tone={active ? "ok" : "neutral"}>
          {active ? text.adminActive : text.adminOff}
        </ChipStatus>
      </div>
      {explain && <p className="text-sm text-muted-foreground">{explain}</p>}
      <SubmitButton pendingLabel={text.adminSaving} variant="muted">
        {active ? text.adminTurnOff(name) : text.adminTurnOn(name)}
      </SubmitButton>
      {state.error && (
        <p role="alert" className="text-sm font-semibold text-accent-text">
          {messages.errors[state.error]}
        </p>
      )}
    </form>
  );
}
