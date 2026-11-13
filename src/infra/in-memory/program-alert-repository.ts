import type { ProgramAlertRepository } from "@/application/program-alerts";

/** Test double of the ProgramAlertRepository port: one store, a session per player. */
export function createInMemoryProgramAlertStore() {
  const alerts = new Set<string>();
  const key = (playerId: string, slug: string) => JSON.stringify([playerId, slug]);
  return {
    slugsOf: (playerId: string) =>
      [...alerts]
        .map((alert) => JSON.parse(alert) as [string, string])
        .filter(([id]) => id === playerId)
        .map(([, slug]) => slug),
    session(playerId: string): ProgramAlertRepository {
      return {
        isOn: async (slug) => alerts.has(key(playerId, slug)),
        turnOn: async (slug) => void alerts.add(key(playerId, slug)),
        turnOff: async (slug) => void alerts.delete(key(playerId, slug)),
      };
    },
  };
}
