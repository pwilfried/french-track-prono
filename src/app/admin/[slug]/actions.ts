"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { computeEventPoints } from "@/application/compute-event-points";
import { enterResults, type ResultEntry } from "@/application/enter-results";
import { promoteToNextRound } from "@/application/promote-to-next-round";
import { setEventOdds } from "@/application/set-event-odds";
import { parseOdds } from "@/domain/odds";
import { UseCaseError, type ErrorCode } from "@/application/errors";
import { importStartList, type ImportEntry } from "@/application/import-start-list";
import { setStartList, type StartListEntry } from "@/application/set-start-list";
import {
  createSupabasePointsRepository,
  createSupabaseResultRepository,
  createSupabaseOddsRepository,
  createSupabaseStartListRepository,
} from "@/infra";

import { formText } from "../../form-data";
import { adminOnly } from "../guard";

/** Only errors come back: on success the action goes back to the event page, which shows the new state. */
export type AdminActionState = { error?: ErrorCode };

/** Reads the result lines the form sends as JSON; anything malformed becomes an empty list. */
function linesOf(data: FormData): ResultEntry[] {
  try {
    const parsed: unknown = JSON.parse(formText(data, "lines"));
    if (!Array.isArray(parsed)) return [];
    return parsed.map((l: { athleteId?: unknown; rank?: unknown; mark?: unknown }) => ({
      athleteId: String(l.athleteId ?? ""),
      rank: Number(l.rank),
      mark: typeof l.mark === "string" ? l.mark : null,
    }));
  } catch {
    return [];
  }
}

export async function saveResultAction(
  _: AdminActionState,
  data: FormData,
): Promise<AdminActionState> {
  const { client } = await adminOnly();
  const slug = formText(data, "slug");
  try {
    await enterResults({ results: createSupabaseResultRepository(client) }).execute({
      eventId: formText(data, "eventId"),
      lines: linesOf(data),
    });
  } catch (error) {
    // Only known error codes are expected here; anything else is a bug and stays visible.
    if (error instanceof UseCaseError) return { error: error.code };
    throw error;
  }
  revalidatePath("/admin");
  redirect(`/admin/${slug}`);
}

export async function computePointsAction(
  _: AdminActionState,
  data: FormData,
): Promise<AdminActionState> {
  const { client } = await adminOnly();
  const slug = formText(data, "slug");
  try {
    await computeEventPoints({ points: createSupabasePointsRepository(client) }).execute({
      eventId: formText(data, "eventId"),
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
