import type { CommunityRepository } from "@/application/community";
import type { Announcement, Poll } from "@/domain/community";

type StoredPoll = {
  poll: Omit<Poll, "myChoice" | "votes">;
  createdAt: number;
  ballots: Map<string, number>;
};

/**
 * Test double of the CommunityRepository port: one store, seen by each player through
 * `as(viewerId)` (an admin through `as(id, { admin: true })`). Like the database, the votes of a
 * poll are readable once the viewer voted, once it is closed, or by an admin.
 */
export function createInMemoryCommunityStore(world: { now?: () => Date } = {}): {
  as(viewerId: string, options?: { admin?: boolean }): CommunityRepository;
} {
  const now = world.now ?? (() => new Date());
  const announcements: { announcement: Announcement; order: number }[] = [];
  const polls: StoredPoll[] = [];
  let order = 0;
  let ids = 0;

  const as = (viewerId: string, options: { admin?: boolean } = {}): CommunityRepository => ({
    async announcements() {
      return [...announcements]
        .sort((a, b) => b.order - a.order)
        .map(({ announcement }) => announcement);
    },

    async polls() {
      const weekAgo = now().getTime() - 7 * 86400000;
      return polls
        .filter((p) => Date.parse(p.poll.closesAt) > weekAgo)
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(({ ballots, poll }) => {
          const myChoice = ballots.get(viewerId) ?? null;
          const readable =
            myChoice !== null || Date.parse(poll.closesAt) <= now().getTime() || options.admin;
          const votes = poll.options.map(
            (_o, i) => [...ballots.values()].filter((choice) => choice === i).length,
          );
          return { ...poll, myChoice, votes: readable ? votes : null };
        });
    },

    async vote(pollId, choice) {
      const stored = polls.find((p) => p.poll.id === pollId);
      if (!stored) return "not_found";
      if (Date.parse(stored.poll.closesAt) <= now().getTime()) return "closed";
      if (choice < 0 || choice >= stored.poll.options.length) return "invalid";
      if (stored.ballots.has(viewerId)) return "already_voted";
      stored.ballots.set(viewerId, choice);
      return "voted";
    },

    async publishAnnouncement(announcement) {
      if (!options.admin) return "not_admin";
      const id = `announcement-${++ids}`;
      announcements.push({
        announcement: { ...announcement, id, publishedAt: now().toISOString() },
        order: ++order,
      });
      return id;
    },

    async removeAnnouncement(id) {
      if (!options.admin) return "not_admin";
      const index = announcements.findIndex((a) => a.announcement.id === id);
      if (index >= 0) announcements.splice(index, 1);
      return "removed";
    },

    async createPoll(poll) {
      if (!options.admin) return "not_admin";
      const id = `poll-${++ids}`;
      polls.push({ poll: { ...poll, id }, createdAt: ++order, ballots: new Map() });
      return id;
    },

    async removePoll(id) {
      if (!options.admin) return "not_admin";
      const index = polls.findIndex((p) => p.poll.id === id);
      if (index >= 0) polls.splice(index, 1);
      return "removed";
    },
  });

  return { as };
}
