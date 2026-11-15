import type { SupabaseClient } from "@supabase/supabase-js";

import { UseCaseError } from "@/application/errors";
import type { AdminFunFact, FunFactRepository } from "@/application/fun-facts";
import type { FunFact, FunFactTag } from "@/domain/fun-facts";

type FactRow = {
  id: string;
  title: string;
  body: string;
  tag: FunFactTag;
  discipline: string | null;
  starts_on: string | null;
  ends_on: string | null;
  competitions: { slug: string } | null;
};

type AdminRow = Omit<FactRow, "competitions"> & {
  source: string;
  active: boolean;
  competition_slug: string | null;
};

/** 42501: not an admin; 23503: an unknown competition or discipline; 23514: a bound broken. */
const refuse = (error: { code?: string }): never => {
  const code =
    error.code === "42501"
      ? "NOT_ADMIN"
      : error.code === "23503"
        ? "FUN_FACT_TIE_INVALID"
        : error.code === "23514"
          ? "FUN_FACT_TEXT_INVALID"
          : "FUN_FACTS_UNAVAILABLE";
  throw new UseCaseError(code);
};

const toFact = (row: FactRow): FunFact => ({
  id: row.id,
  title: row.title,
  body: row.body,
  tag: row.tag,
  competitionSlug: row.competitions?.slug ?? null,
  discipline: row.discipline,
  startsOn: row.starts_on,
  endsOn: row.ends_on,
});

/**
 * « Le saviez-vous ? » (#766). With a player's session: the active facts (row level security, no
 * source) and the switch; with the admin's: every fact and the writes, through admin functions.
 */
export function createSupabaseFunFactRepository(client: SupabaseClient): FunFactRepository {
  return {
    async enabled() {
      const { data, error } = await client.from("fun_fact_settings").select("enabled").maybeSingle();
      if (error) return refuse(error);
      return data?.enabled ?? true;
    },
    async active() {
      // A bank of a few dozen facts: one page is enough.
      const { data, error } = await client
        .from("fun_facts")
        .select("id, title, body, tag, discipline, starts_on, ends_on, competitions(slug)")
        .order("created_at")
        .order("id")
        .returns<FactRow[]>();
      if (error) return refuse(error);
      return data.map(toFact);
    },
    async all() {
      const { data, error } = await client.rpc("admin_fun_facts");
      if (error) return refuse(error);
      return ((data ?? []) as AdminRow[]).map(
        (row): AdminFunFact => ({
          id: row.id,
          title: row.title,
          body: row.body,
          tag: row.tag,
          source: row.source,
          active: row.active,
          competitionSlug: row.competition_slug,
          discipline: row.discipline,
          startsOn: row.starts_on,
          endsOn: row.ends_on,
        }),
      );
    },
    async save(id, fact) {
      const { data, error } = await client.rpc("admin_save_fun_fact", {
        p_id: id,
        p_fact: {
          title: fact.title,
          body: fact.body,
          tag: fact.tag,
          source: fact.source,
          active: fact.active,
          competition_slug: fact.competitionSlug,
          discipline: fact.discipline,
          starts_on: fact.startsOn,
          ends_on: fact.endsOn,
        },
      });
      if (error) return refuse(error);
      if (!data) throw new UseCaseError("FUN_FACTS_UNAVAILABLE");
      return data as string;
    },
    async remove(id) {
      const { error } = await client.rpc("admin_delete_fun_fact", { p_id: id });
      if (error) refuse(error);
    },
    async setEnabled(enabled) {
      const { error } = await client.rpc("admin_set_fun_facts_enabled", { p_enabled: enabled });
      if (error) refuse(error);
    },
  };
}
