import type { SupabaseClient } from "@supabase/supabase-js";

import type { DisciplineRepository } from "@/application/disciplines";
import { UseCaseError } from "@/application/errors";
import type { Discipline, DisciplineFamily, MarkUnit } from "@/domain/discipline";

type Row = {
  name: string;
  family: DisciplineFamily;
  unit: MarkUnit;
  lower_is_better: boolean;
  tolerance: number | string;
};

/** Disciplines are public; changing a tolerance needs the admin's own session. */
export function createSupabaseDisciplineRepository(client: SupabaseClient): DisciplineRepository {
  return {
    async list() {
      const { data, error } = await client
        .from("disciplines")
        .select("name, family, unit, lower_is_better, tolerance")
        .returns<Row[]>();
      if (error) throw new UseCaseError("DISCIPLINES_UNAVAILABLE");
      return data.map(
        (row): Discipline => ({
          name: row.name,
          family: row.family,
          unit: row.unit,
          lowerIsBetter: row.lower_is_better,
          // numeric columns come back as text.
          tolerance: Number(row.tolerance),
        }),
      );
    },

    async setTolerance(name, tolerance) {
      const { error } = await client.rpc("set_discipline_tolerance", {
        p_discipline: name,
        p_tolerance: tolerance,
      });
      if (!error) return "saved";
      if (error.code === "42501") return "not_admin";
      // FT003: no discipline with this name.
      if (error.code === "FT003") return "unknown";
      throw new UseCaseError("DISCIPLINES_UNAVAILABLE");
    },

    async create(discipline) {
      const { error } = await client.rpc("create_discipline", {
        p_name: discipline.name,
        p_family: discipline.family,
        p_unit: discipline.unit,
        p_lower_is_better: discipline.lowerIsBetter,
        p_tolerance: discipline.tolerance,
      });
      if (!error) return "created";
      if (error.code === "42501") return "not_admin";
      if (error.code === "23505") return "exists";
      if (error.code === "22023" || error.code === "23514") {
        throw new UseCaseError("DISCIPLINE_NAME_INVALID");
      }
      throw new UseCaseError("DISCIPLINES_UNAVAILABLE");
    },
  };
}
