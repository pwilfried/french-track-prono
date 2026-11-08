import type { SupabaseClient } from "@supabase/supabase-js";

import { UseCaseError } from "@/application/errors";
import type {
  AdminAction,
  AdminActionKind,
  AdminLogRepository,
} from "@/application/list-admin-actions";
import type { EventGender } from "@/domain/event";

type Row = {
  id: string;
  at: string;
  action: AdminActionKind;
  payload: unknown;
  admin: { id: string; pseudo: string } | null;
  event: { id: string; slug: string; discipline: string; gender: EventGender } | null;
};

/** The client must carry the admin's session: row level security hides the log from players. */
export function createSupabaseAdminLogRepository(client: SupabaseClient): AdminLogRepository {
  return {
    async list(filter, limit) {
      let query = client
        .from("admin_actions")
        .select(
          "id, at, action, payload, admin:profiles(id, pseudo), event:events(id, slug, discipline, gender)",
        )
        .order("at", { ascending: false })
        .limit(limit);
      if (filter.adminId) query = query.eq("admin_id", filter.adminId);
      if (filter.eventId) query = query.eq("event_id", filter.eventId);
      if (filter.since) query = query.gte("at", filter.since);
      const { data, error } = await query.returns<Row[]>();
      if (error) throw new UseCaseError("ADMIN_LOG_UNAVAILABLE");
      return data.map(
        (row): AdminAction => ({
          id: row.id,
          at: new Date(row.at).toISOString(),
          kind: row.action,
          admin: row.admin,
          event: row.event,
          size: Array.isArray(row.payload) ? row.payload.length : 0,
        }),
      );
    },
  };
}
