import { describe, expect, it } from "vitest";

import {
  ADMIN_LOG_SIZE,
  listAdminActions,
  type AdminAction,
  type AdminLogFilter,
  type AdminLogRepository,
} from "./list-admin-actions";

const line = (id: string, adminPseudo: string, eventSlug: string): AdminAction => ({
  id,
  at: "2026-09-12T20:00:00.000Z",
  kind: "set_results",
  admin: { id: `admin-${adminPseudo}`, pseudo: adminPseudo },
  event: { id: `event-${eventSlug}`, slug: eventSlug, discipline: eventSlug, gender: "F" },
  size: 3,
});

describe("listAdminActions", () => {
  it("returns the latest filtered actions and fills the filters from the latest actions", async () => {
    const all = [
      line("1", "Zoé", "f-100m"),
      line("2", "Alex", "m-400m"),
      line("3", "Zoé", "m-400m"),
    ];
    const calls: [AdminLogFilter, number][] = [];
    const log: AdminLogRepository = {
      list: async (filter, limit) => {
        calls.push([filter, limit]);
        return filter.adminId ? all.filter((a) => a.admin?.id === filter.adminId) : all;
      },
    };

    const page = await listAdminActions({ log }).execute({ filter: { adminId: "admin-Zoé" } });

    expect(page.actions.map((a) => a.id)).toEqual(["1", "3"]);
    expect(calls[0]).toEqual([{ adminId: "admin-Zoé" }, ADMIN_LOG_SIZE]);
    expect(page.admins.map((a) => a.pseudo)).toEqual(["Alex", "Zoé"]);
    expect(page.events.map((e) => e.slug)).toEqual(["f-100m", "m-400m"]);
  });
});
