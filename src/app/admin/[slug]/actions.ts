"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { computeEventPoints } from "@/application/compute-event-points";
import { enterResults, type ResultEntry } from "@/application/enter-results";
import { UseCaseError, type ErrorCode } from "@/application/errors";
import { setStartList, type StartListEntry } from "@/application/set-start-list";
import {
  createSupabasePointsRepository,
  createSupabaseResultRepository,
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
