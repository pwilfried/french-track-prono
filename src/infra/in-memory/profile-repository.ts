import type { Profile, ProfileRepository } from "@/application/create-profile";

/** Test double of the ProfileRepository port. Same rules as the database. */
export function createInMemoryProfileRepository(): ProfileRepository {
  const byUser = new Map<string, Profile>();
  return {
    async find(userId) {
      return byUser.get(userId) ?? null;
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
  };
}
