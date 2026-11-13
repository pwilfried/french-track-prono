import type { SupabaseClient } from "@supabase/supabase-js";

import { lockSharedRow, sql } from "./database";

/**
 * Competitions of their own, open to the Manager (#644): `count` not over yet, a week apart from
 * 30 days on (returned first first), and one already over. `manager_competitions` is replaced as
 * a whole by the Manager rule tests: hold the lock of `manager_rules` while they are needed.
 */
export function insertManagerCompetitions(count: number) {
  const tag = `mgr-${crypto.randomUUID().slice(0, 8)}`;
  const insert = (n: number, startsIn: number, status: string) =>
    sql(`insert into competitions (slug, name, starts_on, ends_on, status)
         values ('${tag}-${n}', 'Meeting ${tag} ${n}', current_date + ${startsIn},
                 current_date + ${startsIn}, '${status}') returning id`);
  const ids = Array.from({ length: count }, (_, i) => insert(i + 1, 30 + 7 * i, "upcoming"));
  const finished = insert(0, -10, "finished");
  sql(`insert into manager_competitions (competition_id)
       select id from competitions where slug like '${tag}-%'`);
  return {
    ids,
    finished,
    /** The leagues keep the ids of their competitions: removing these does not touch them. */
    remove: () => void sql(`delete from competitions where slug like '${tag}-%'`),
  };
}

/** A Manager league of the signed-in player, on six competitions of its own: 4 players. */
export async function createManagerLeagueAs(client: SupabaseClient, name: string) {
  const unlock = await lockSharedRow("manager_rules");
  const competitions = insertManagerCompetitions(6);
  try {
    const { data, error } = await client.rpc("create_manager_league", {
      p_name: name,
      p_public: false,
      p_competitions: competitions.ids,
    });
    if (error) throw new Error(error.message);
    return data as string;
  } finally {
    competitions.remove();
    unlock();
  }
}
