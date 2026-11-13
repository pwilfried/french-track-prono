"use server";

import { redirect } from "next/navigation";

import { enterPerformances } from "@/application/enter-performances";
import { UseCaseError } from "@/application/errors";
import { getEvent } from "@/application/get-event";
import {
  PERFORMANCE_STATUSES,
  RECORD_FLAGS,
  type Performance,
  type PerformanceStatus,
  type RecordFlag,
} from "@/domain/performance";
import {
  createPublicSupabaseClient,
  createSupabaseEventReader,
  createSupabasePerformanceRepository,
} from "@/infra";

import { formText } from "../../../form-data";
import { adminOnly } from "../../guard";
import type { AdminActionState } from "../actions";

/** Reads the lines the form sends as JSON; anything malformed becomes an empty list. */
function linesOf(data: FormData): Performance[] {
  try {
    const parsed: unknown = JSON.parse(formText(data, "lines"));
    if (!Array.isArray(parsed)) return [];
    return parsed.map(
      (l: {
        athleteId?: unknown;
        status?: unknown;
        place?: unknown;
        mark?: unknown;
        records?: unknown;
      }) => ({
        athleteId: String(l.athleteId ?? ""),
        status: PERFORMANCE_STATUSES.includes(l.status as PerformanceStatus)
          ? (l.status as PerformanceStatus)
          : "ok",
        place: l.place === null || l.place === "" || l.place === undefined ? null : Number(l.place),
        mark: typeof l.mark === "string" ? l.mark : null,
        records: Array.isArray(l.records)
          ? RECORD_FLAGS.filter((flag: RecordFlag) => (l.records as unknown[]).includes(flag))
          : [],
      }),
    );
  } catch {
    return [];
  }
}

export async function savePerformancesAction(
  _: AdminActionState,
  data: FormData,
): Promise<AdminActionState> {
  const { client } = await adminOnly();
  const slug = formText(data, "slug");
  try {
    // The unit of the discipline comes from the event itself, not from the form.
    const event = await getEvent({
      events: createSupabaseEventReader(createPublicSupabaseClient()),
    }).execute({ competitionSlug: null, eventSlug: slug });
    await enterPerformances({ performances: createSupabasePerformanceRepository(client) }).execute({
      eventId: event.id,
      unit: event.markUnit ?? "time",
      lines: linesOf(data),
    });
  } catch (error) {
    if (error instanceof UseCaseError) return { error: error.code };
    throw error;
  }
  redirect(`/admin/${slug}/performances?enregistre=1`);
}
