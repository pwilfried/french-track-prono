import type { EventGender } from "@/domain/event";

export type AdminActionKind =
  | "set_start_list"
  | "set_results"
  | "run_scoring"
  | "set_tolerance"
  | "edit_athlete"
  | "edit_competition"
  | "set_odds"
  | "set_rule"
  | "moderate_league";

/** One line of the admin log. */
export type AdminAction = {
  id: string;
  /** ISO 8601, UTC. */
  at: string;
  kind: AdminActionKind;
  /** Null once the admin deleted their account. */
  admin: { id: string; pseudo: string } | null;
  event: { id: string; slug: string; discipline: string; gender: EventGender } | null;
  /** How many lines were written (athletes, podium lines or players). */
  size: number;
};

export type AdminLogFilter = { adminId?: string; eventId?: string; since?: string };

/** Port: the admin log. Real adapter = Supabase (the admin's own session), fake = in memory. */
export interface AdminLogRepository {
  /** The latest lines matching the filter, newest first; empty for a player who is not admin. */
  list(filter: AdminLogFilter, limit: number): Promise<AdminAction[]>;
}

/** How many lines the log page shows. */
export const ADMIN_LOG_SIZE = 50;

/**
 * The admin log page: the latest actions matching the filter, and the admins and events seen in
 * the latest actions overall, to fill the filters.
 */
export function listAdminActions(ports: { log: AdminLogRepository }) {
  return {
    async execute(input: { filter: AdminLogFilter }) {
      const [actions, recent] = await Promise.all([
        ports.log.list(input.filter, ADMIN_LOG_SIZE),
        ports.log.list({}, 200),
      ]);
      const admins = new Map<string, NonNullable<AdminAction["admin"]>>();
      const events = new Map<string, NonNullable<AdminAction["event"]>>();
      for (const action of recent) {
        if (action.admin) admins.set(action.admin.id, action.admin);
        if (action.event) events.set(action.event.id, action.event);
      }
      return {
        actions,
        admins: [...admins.values()].sort((a, b) => a.pseudo.localeCompare(b.pseudo)),
        events: [...events.values()].sort((a, b) => a.discipline.localeCompare(b.discipline)),
      };
    },
  };
}
