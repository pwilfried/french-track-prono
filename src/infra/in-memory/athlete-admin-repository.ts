import type { AthleteAdminRepository, AthleteFile } from "@/application/edit-athlete";

/** Test double of the AthleteAdminRepository port: one store, a session per player. */
export function createInMemoryAthleteAdminStore(athletes: AthleteFile[]) {
  const stored = athletes.map((a) => ({
    ...a,
    disciplines: [...a.disciplines],
    records: [...a.records],
  }));
  const byId = (id: string) => {
    const found = stored.find((a) => a.athleteId === id);
    if (!found) throw new Error(`unknown athlete ${id}`);
    return found;
  };
  return {
    session(options: { isAdmin: boolean }): AthleteAdminRepository {
      const guard = async (write: () => void) => {
        if (!options.isAdmin) return "not_admin" as const;
        write();
        return "saved" as const;
      };
      return {
        async list() {
          return stored.map(({ athleteId, slug, name, countryCode, gender }) => ({
            athleteId,
            slug,
            name,
            countryCode,
            gender,
          }));
        },
        async find(slug) {
          const found = stored.find((a) => a.slug === slug);
          return found ? structuredClone(found) : null;
        },
        update: (id, fields) => guard(() => Object.assign(byId(id), fields)),
        setDiscipline: (id, discipline, isPrimary) =>
          guard(() => {
            const athlete = byId(id);
            if (isPrimary) athlete.disciplines.forEach((d) => (d.isPrimary = false));
            athlete.disciplines = athlete.disciplines.filter((d) => d.discipline !== discipline);
            athlete.disciplines.push({ discipline, isPrimary });
          }),
        removeDiscipline: (id, discipline) =>
          guard(() => {
            const athlete = byId(id);
            athlete.disciplines = athlete.disciplines.filter((d) => d.discipline !== discipline);
          }),
        setRecord: (id, record) =>
          guard(() => {
            const athlete = byId(id);
            athlete.records = athlete.records.filter(
              (r) => !(r.discipline === record.discipline && r.kind === record.kind),
            );
            if (record.mark) {
              athlete.records.push({
                discipline: record.discipline,
                kind: record.kind,
                mark: record.mark,
                date: record.date,
                meeting: null,
              });
            }
          }),
      };
    },
  };
}
