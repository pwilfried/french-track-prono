import { describe, expect, it } from "vitest";

import type { EventSummary } from "@/domain/event";

import { getAdminTodo, type AdminTodoPorts } from "./admin-todo";
import type { AdminClub } from "./club-admin";

const NOW = new Date("2026-08-10T12:00:00Z");

function event(id: string, lockAt: string): EventSummary {
  return {
    id,
    slug: id,
    discipline: "100 m",
    gender: "F",
    startsAt: lockAt,
    lockAt,
    isFeatured: false,
    status: "upcoming",
    round: "final",
  };
}

const club = (id: string, validated: boolean): AdminClub => ({
  id,
  name: id,
  city: "Fictiville",
  department: "92",
  source: "player",
  validated,
  playerCount: 1,
});

function ports(overrides: Partial<AdminTodoPorts> = {}): AdminTodoPorts {
  return {
    events: {
      listByCompetition: async () => [
        event("locked-no-result", "2026-08-10T10:00:00Z"),
        event("locked-with-result", "2026-08-10T09:00:00Z"),
        event("open", "2026-08-11T10:00:00Z"),
      ],
      findBySlug: async () => null,
    },
    points: { progress: async () => ({ withResult: ["locked-with-result"], scored: [] }) },
    clubs: {
      list: async (_query, pendingOnly) =>
        [club("a", false), club("b", false), club("c", true)].filter(
          (c) => !pendingOnly || !c.validated,
        ),
      save: async () => "unknown",
      validate: async () => "unknown",
      remove: async () => "unknown",
    },
    moderation: {
      listReported: async () => [{ id: "l1", name: "L", reportCount: 2, memberCount: 3 }],
      rename: async () => "unknown",
      remove: async () => "unknown",
    },
    ...overrides,
  };
}

describe("admin to-do counters", () => {
  it("counts locked events without a result, clubs to validate and reported leagues", async () => {
    // given an admin with work waiting in each section
    // when the counters are read
    const todo = await getAdminTodo(ports()).execute({ competitionSlug: "uc-2026", now: NOW });
    // then each section gets its count
    expect(todo).toEqual({ results: 1, clubs: 2, leagues: 1 });
  });

  it("leaves a counter out when its section cannot be read", async () => {
    // given the league moderation is not reachable and clubs answer "not admin"
    const todo = await getAdminTodo(
      ports({
        moderation: {
          listReported: async () => {
            throw new Error("down");
          },
          rename: async () => "unknown",
          remove: async () => "unknown",
        },
        clubs: {
          list: async () => "not_admin",
          save: async () => "unknown",
          validate: async () => "unknown",
          remove: async () => "unknown",
        },
      }),
    ).execute({ competitionSlug: "uc-2026", now: NOW });
    // then the other counters still show
    expect(todo).toEqual({ results: 1, clubs: null, leagues: null });
  });
});
