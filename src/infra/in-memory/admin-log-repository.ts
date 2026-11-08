import type { AdminAction, AdminLogRepository } from "@/application/list-admin-actions";

/**
 * Test double of the AdminLogRepository port: players read nothing, admins read every line. The
 * test records lines as the database would when an RPC succeeds.
 */
export function createInMemoryAdminLogStore() {
  const lines: AdminAction[] = [];
  return {
    record(line: AdminAction) {
      lines.push(line);
    },
    session(options: { isAdmin: boolean }): AdminLogRepository {
      return {
        async list(filter, limit) {
          if (!options.isAdmin) return [];
          return lines
            .filter((l) => !filter.adminId || l.admin?.id === filter.adminId)
            .filter((l) => !filter.eventId || l.event?.id === filter.eventId)
            .filter((l) => !filter.since || l.at >= filter.since)
            .sort((a, b) => b.at.localeCompare(a.at))
            .slice(0, limit)
            .map((l) => ({ ...l }));
        },
      };
    },
  };
}
