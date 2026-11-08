import type {
  CompetitionAdminRepository,
  CompetitionFile,
  EnteredAthlete,
} from "@/application/create-competition";
import type { CompetitionEditRepository } from "@/application/edit-competition";

/** Test double of the CompetitionAdminRepository port: one store, a session per player. */
export function createInMemoryCompetitionAdminStore(athletes: EnteredAthlete[]) {
  const stored: CompetitionFile[] = [];
  const onStartList = new Set<string>();
  const predicted = new Set<string>();
  const free = (slug: string, taken: (s: string) => boolean) => {
    let candidate = slug;
    for (let n = 2; taken(candidate); n++) candidate = `${slug}-${n}`;
    return candidate;
  };
  return {
    /** Puts an athlete on a start list of a competition (cannot be withdrawn then). */
    putOnStartList(competition: string, athleteId: string) {
      onStartList.add(`${competition}/${athleteId}`);
    },
    /** Someone predicted this event: it cannot be deleted nor change its round. */
    predict(eventSlug: string) {
      predicted.add(eventSlug);
    },
    session(options: { isAdmin: boolean }): CompetitionAdminRepository & CompetitionEditRepository {
      const find = (slug: string) => stored.find((c) => c.slug === slug);
      return {
        async list() {
          return stored.map(({ eventList, athletes: entered, ...c }) => ({
            ...c,
            events: eventList.length,
            entered: entered.length,
          }));
        },
        async find(slug) {
          const found = find(slug);
          return found
            ? {
                ...structuredClone(found),
                events: found.eventList.length,
                entered: found.athletes.length,
              }
            : null;
        },
        async create(c) {
          if (!options.isAdmin) return "not_admin";
          const slug = free(c.slug, (s) => !!find(s));
          stored.push({ ...c, slug, events: 0, entered: 0, eventList: [], athletes: [] });
          return slug;
        },
        async addEvent(competition, event) {
          if (!options.isAdmin) return "not_admin";
          const found = find(competition);
          if (!found) return "unknown";
          const slug = free(event.slug, (s) =>
            stored.some((c) => c.eventList.some((e) => e.slug === s)),
          );
          found.eventList.push({
            slug,
            discipline: event.discipline,
            gender: event.gender,
            round: event.round,
            startsAt: event.startsAt,
            entries: 0,
          });
          return slug;
        },
        async setAthlete(competition, athleteId, entered) {
          if (!options.isAdmin) return "not_admin";
          const found = find(competition);
          if (!found) return "saved";
          if (!entered && onStartList.has(`${competition}/${athleteId}`)) return "in_use";
          found.athletes = found.athletes.filter((a) => a.athleteId !== athleteId);
          const athlete = athletes.find((a) => a.athleteId === athleteId);
          if (entered && athlete) found.athletes.push({ ...athlete });
          return "saved";
        },
        async update(slug, fields) {
          if (!options.isAdmin) return "not_admin";
          const found = find(slug);
          if (!found) return "unknown";
          Object.assign(found, fields);
          return "saved";
        },
        async remove(slug) {
          if (!options.isAdmin) return "not_admin";
          const found = find(slug);
          if (!found) return "unknown";
          if (found.eventList.some((e) => predicted.has(e.slug))) return "has_predictions";
          stored.splice(stored.indexOf(found), 1);
          return "saved";
        },
        async updateEvent(eventSlug, change) {
          if (!options.isAdmin) return "not_admin";
          const event = stored.flatMap((c) => c.eventList).find((e) => e.slug === eventSlug);
          if (!event) return "unknown";
          if (change.round !== event.round && predicted.has(eventSlug)) return "has_predictions";
          event.round = change.round;
          event.startsAt = change.startsAt;
          return "saved";
        },
        async removeEvent(eventSlug) {
          if (!options.isAdmin) return "not_admin";
          const owner = stored.find((c) => c.eventList.some((e) => e.slug === eventSlug));
          if (!owner) return "unknown";
          if (predicted.has(eventSlug)) return "has_predictions";
          owner.eventList = owner.eventList.filter((e) => e.slug !== eventSlug);
          return "saved";
        },
      };
    },
  };
}
