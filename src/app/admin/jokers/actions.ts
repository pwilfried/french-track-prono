"use server";

import { revalidatePath } from "next/cache";

import { UseCaseError, type ErrorCode } from "@/application/errors";
import { setJokerActive } from "@/application/league-jokers";
import { createSupabaseLeagueJokerRepository } from "@/infra";

import { formText } from "../../form-data";
import { adminOnly } from "../guard";

export type JokerState = { error?: ErrorCode; saved?: boolean };

/** Turns a joker of the catalogue on or off (#1090): the leagues created from now on follow it. */
export async function setJokerActiveAction(_: JokerState, data: FormData): Promise<JokerState> {
  const { client } = await adminOnly();
  const game = formText(data, "game") === "manager" ? "manager" : "predictions";
  try {
    await setJokerActive({ jokers: createSupabaseLeagueJokerRepository(client) }).execute({
      game,
      joker: formText(data, "joker"),
      active: formText(data, "active") === "1",
    });
  } catch (error) {
    if (error instanceof UseCaseError) return { error: error.code };
    throw error;
  }
  revalidatePath("/admin/jokers");
  return { saved: true };
}
