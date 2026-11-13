import { describe, expect, it } from "vitest";

import type { EventReader } from "@/application/list-events";
import { listEvents } from "@/application/list-events";
import type { EventDetail } from "@/domain/event";

import {
  cachedEventReader,
  PUBLIC_TAGS,
  STALE_AFTER,
  type Memo,
  type PublicChange,
  type PublicTag,
} from "./public-cache";

/** A cache shared by "requests", as the Next.js data cache is: invalidated by tag. */
function fakeCache() {
  const entries = new Map<string, { value: unknown; tags: readonly PublicTag[] }>();
  const memo: Memo =
    (read, key, tags) =>
    async (...args) => {
      const id = JSON.stringify([key, ...args]);
      const hit = entries.get(id);
      if (hit) return hit.value as Awaited<ReturnType<typeof read>>;
      const value = await read(...args);
      entries.set(id, { value, tags });
      return value;
    };
  const invalidate = (change: PublicChange) => {
    for (const [id, entry] of entries)
      if (entry.tags.some((t) => (STALE_AFTER[change] as readonly string[]).includes(t)))
        entries.delete(id);
  };
  return { memo, invalidate };
}

const event = (startsAt: string, lockAt: string): EventDetail => ({
  id: "e1",
  slug: "100m-f",
  discipline: "100 m",
  gender: "F",
  startsAt,
  lockAt,
  isFeatured: false,
  status: "upcoming",
  round: "final",
  entries: [],
  results: [],
  subDisciplines: [],
  previousRounds: [],
});

/** The database, as the admin changes it; counts the reads that reach it. */
function database(initial: EventDetail) {
  let stored = initial;
  const reads = { list: 0, find: 0 };
  const reader: EventReader = {
    async listByCompetition() {
      reads.list += 1;
      return [stored];
    },
    async findBySlug() {
      reads.find += 1;
      return stored;
    },
  };
  return { reader, reads, set: (e: EventDetail) => (stored = e) };
}

describe("public data cache", () => {
  it("does not read the events again on a second page load while the cache is fresh", async () => {
    const db = database(event("2026-09-11T18:00:00.000Z", "2026-09-11T17:00:00.000Z"));
    const cache = fakeCache();

    // Given a first page load
    await listEvents({ events: cachedEventReader(db.reader, cache.memo) }).execute({
      competitionSlug: "uc-2026",
    });
    // When the player opens another page needing the same events
    const second = await listEvents({ events: cachedEventReader(db.reader, cache.memo) }).execute({
      competitionSlug: "uc-2026",
    });

    // Then the database was read once
    expect(db.reads.list).toBe(1);
    expect(second).toHaveLength(1);
  });

  it("shows the new time on the next page load once the admin edits an event time", async () => {
    const db = database(event("2026-09-11T18:00:00.000Z", "2026-09-11T17:00:00.000Z"));
    const cache = fakeCache();
    const load = () =>
      listEvents({ events: cachedEventReader(db.reader, cache.memo) }).execute({
        competitionSlug: "uc-2026",
      });
    await load();

    // When the admin moves the event an hour later (the action invalidates its tags)
    db.set(event("2026-09-11T19:00:00.000Z", "2026-09-11T18:00:00.000Z"));
    cache.invalidate("event");

    // Then the next page load shows the new time and lock
    const [shown] = await load();
    expect(shown?.startsAt).toBe("2026-09-11T19:00:00.000Z");
    expect(shown?.lockAt).toBe("2026-09-11T18:00:00.000Z");
  });

  it("always reads one event fresh, so its lock time is never served from the cache", async () => {
    const db = database(event("2026-09-11T18:00:00.000Z", "2026-09-11T17:00:00.000Z"));
    const reader = cachedEventReader(db.reader, fakeCache().memo);

    await reader.findBySlug("uc-2026", "100m-f");
    await reader.findBySlug("uc-2026", "100m-f");

    expect(db.reads.find).toBe(2);
  });

  it("makes the event lists stale after every admin change that touches an event", () => {
    const eventChanges: PublicChange[] = ["competition", "event", "startList", "odds", "result"];
    for (const change of eventChanges) expect(STALE_AFTER[change]).toContain("events");
    expect(STALE_AFTER.discipline).toContain("disciplines");
    expect(STALE_AFTER.scale).toContain("scale");
  });

  it("only knows public tags", () => {
    for (const tags of Object.values(STALE_AFTER))
      for (const tag of tags) expect(PUBLIC_TAGS).toContain(tag);
  });
});
