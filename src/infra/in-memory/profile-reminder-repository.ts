import type { ProfileReminderRepository } from "@/application/profile-reminder";

/** Test double of the ProfileReminderRepository port. */
export function createInMemoryProfileReminderRepository(): ProfileReminderRepository {
  const byUser = new Map<string, Date>();
  return {
    async hiddenUntil(userId) {
      const until = byUser.get(userId);
      return until ? new Date(until) : null;
    },
    async hideUntil(userId, until) {
      byUser.set(userId, new Date(until));
    },
  };
}
