"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getEvent } from "@/application/get-event";
import { promoteToNextRound } from "@/application/promote-to-next-round";
import { setEventOdds } from "@/application/set-event-odds";
import { parseOdds } from "@/domain/odds";
import { UseCaseError, type ErrorCode } from "@/application/errors";
import { importStartList, type ImportEntry } from "@/application/import-start-list";
import { recomputeResultSheet } from "@/application/save-result-sheet";
import { setStartList, type StartListEntry } from "@/application/set-start-list";
import {
  createPublicSupabaseClient,
  createSupabaseEventReader,
  createSupabaseOddsRepository,
  createSupabaseStartListRepository,
} from "@/infra";

import { formText } from "../../form-data";
import { adminOnly } from "../guard";
import { sheetPorts } from "./sheet-ports";

/** Only errors come back: on success the action goes back to the event page, which shows the new state. */
export type AdminActionState = { error?: ErrorCode };

/**
 * « Recalculer », the fallback of the results sheet (#665): the same computation, prediction points
 * of the event then Manager scores of its competition.
 */
export async function computePointsAction(
  _: AdminActionState,
  data: FormData,
): Promise<AdminActionState> {
  const { client } = await adminOnly();
  const slug = formText(data, "slug");
  try {
    const event = await getEvent({
      events: createSupabaseEventReader(createPublicSupabaseClient()),
    }).execute({ competitionSlug: null, eventSlug: slug });
    await recomputeResultSheet(sheetPorts(client)).execute({
      eventId: event.id,
      competitionSlug: event.competitionSlug ?? null,
      final: event.round === "final",
    });
  } catch (error) {
    if (error instanceof UseCaseError) return { error: error.code };
    throw error;
  }
  revalidatePath("/admin");
  redirect(`/admin/${slug}`);
}

/** Reads the start list the form sends as JSON; anything malformed becomes an empty list. */
function entriesOf(data: FormData): StartListEntry[] {
  try {
    const parsed: unknown = JSON.parse(formText(data, "entries"));
    if (!Array.isArray(parsed)) return [];
    return parsed.map((e: { athleteId?: unknown; seasonBest?: unknown }) => ({
      athleteId: String(e.athleteId ?? ""),
      seasonBest: typeof e.seasonBest === "string" ? e.seasonBest : null,
    }));
  } catch {
    return [];
  }
}

export async function saveStartListAction(
  _: AdminActionState,
  data: FormData,
): Promise<AdminActionState> {
  const { client } = await adminOnly();
  const slug = formText(data, "slug");
  try {
    await setStartList({ startLists: createSupabaseStartListRepository(client) }).execute({
      eventId: formText(data, "eventId"),
      entries: entriesOf(data),
    });
  } catch (error) {
    if (error instanceof UseCaseError) return { error: error.code };
    throw error;
  }
  revalidatePath(`/epreuves/${slug}`);
  redirect(`/admin/${slug}/depart?enregistre=1`);
}

/** Reads the confirmed import the form sends as JSON; anything malformed becomes an empty list. */
function importOf(data: FormData): ImportEntry[] {
  try {
    const parsed: unknown = JSON.parse(formText(data, "entries"));
    if (!Array.isArray(parsed)) return [];
    return parsed.map(
      (e: {
        athleteId?: unknown;
        newAthlete?: { name?: unknown; countryCode?: unknown };
        seasonBest?: unknown;
      }) => {
        const seasonBest = typeof e.seasonBest === "string" ? e.seasonBest : null;
        return e.newAthlete
          ? {
              newAthlete: {
                name: String(e.newAthlete.name ?? ""),
                countryCode: String(e.newAthlete.countryCode ?? ""),
              },
              seasonBest,
            }
          : { athleteId: String(e.athleteId ?? ""), seasonBest };
      },
    );
  } catch {
    return [];
  }
}

export async function importStartListAction(
  _: AdminActionState,
  data: FormData,
): Promise<AdminActionState> {
  const { client } = await adminOnly();
  const slug = formText(data, "slug");
  const gender = formText(data, "gender");
  try {
    await importStartList({ startLists: createSupabaseStartListRepository(client) }).execute({
      eventId: formText(data, "eventId"),
      gender: gender === "M" || gender === "X" ? gender : "F",
      entries: importOf(data),
    });
  } catch (error) {
    if (error instanceof UseCaseError) return { error: error.code };
    throw error;
  }
  revalidatePath(`/epreuves/${slug}`);
  redirect(`/admin/${slug}/depart?enregistre=1`);
}

export async function promoteAction(
  _: AdminActionState & { done?: boolean },
  data: FormData,
): Promise<AdminActionState & { done?: boolean }> {
  const { client } = await adminOnly();
  try {
    await promoteToNextRound({ startLists: createSupabaseStartListRepository(client) }).execute({
      eventId: formText(data, "eventId"),
      top: Number(formText(data, "top")),
    });
  } catch (error) {
    if (error instanceof UseCaseError) return { error: error.code };
    throw error;
  }
  revalidatePath("/admin");
  return { done: true };
}

/** Reads the odds the form sends as JSON; anything malformed becomes an invalid set. */
function oddsOf(data: FormData) {
  try {
    const parsed = JSON.parse(formText(data, "odds")) as {
      proposed?: { athleteId?: unknown; odds?: unknown }[];
      other?: unknown;
    };
    return {
      proposed: (parsed.proposed ?? []).map((p) => ({
        athleteId: String(p.athleteId ?? ""),
        odds: parseOdds(String(p.odds ?? "")) ?? 0,
      })),
      other: parseOdds(String(parsed.other ?? "")) ?? 0,
    };
  } catch {
    return { proposed: [], other: 0 };
  }
}

export async function saveOddsAction(
  _: AdminActionState,
  data: FormData,
): Promise<AdminActionState> {
  const { client } = await adminOnly();
  const slug = formText(data, "slug");
  let startList: string[] = [];
  try {
    startList = (JSON.parse(formText(data, "startList")) as unknown[]).map(String);
  } catch {
    startList = [];
  }
  try {
    await setEventOdds({ odds: createSupabaseOddsRepository(client) }).execute({
      eventId: formText(data, "eventId"),
      startList,
      odds: oddsOf(data),
    });
  } catch (error) {
    if (error instanceof UseCaseError) return { error: error.code };
    throw error;
  }
  revalidatePath(`/epreuves/${slug}`);
  redirect(`/admin/${slug}/cotes?enregistre=1`);
}
