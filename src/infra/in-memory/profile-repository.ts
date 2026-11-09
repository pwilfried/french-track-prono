import type { Profile, ProfileRepository } from "@/application/create-profile";

/** Test double of the ProfileRepository port. Same rules as the database. */
export function createInMemoryProfileRepository(
  options: { admins?: string[] } = {},
): ProfileRepository {
  const byUser = new Map<string, Profile>();
  const admins = new Set(options.admins ?? []);
  return {
    async find(userId) {
      return byUser.get(userId) ?? null;
    },
    async isAdmin(userId) {
      return byUser.has(userId) && admins.has(userId);
    },
    async create(profile) {
      if (byUser.has(profile.userId)) return "profile_exists";
      const key = profile.pseudo.toLowerCase();
      for (const other of byUser.values()) {
        if (other.pseudo.toLowerCase() === key) return "pseudo_taken";
      }
      byUser.set(profile.userId, profile);
      return "created";
    },
    async update(userId, change) {
      const mine = byUser.get(userId);
      if (!mine) return "updated";
      const key = change.pseudo.toLowerCase();
      for (const other of byUser.values()) {
        if (other.userId !== userId && other.pseudo.toLowerCase() === key) return "pseudo_taken";
      }
      byUser.set(userId, { ...mine, ...change });
      return "updated";
    },
    async deleteMine(userId) {
      byUser.delete(userId);
    },
  };
}
