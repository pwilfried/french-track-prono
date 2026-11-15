import type { MomentReactionRepository, MomentReport } from "@/application/moment-reactions";
import type { MomentKind } from "@/domain/league-moments";
import type { MomentResponse } from "@/domain/moment-reactions";

type Stored = {
  id: string;
  leagueId: string;
  momentKey: string;
  userId: string;
  kind: "emoji" | "message";
  code: string;
  hidden: boolean;
  createdAt: number;
};

type Report = { reactionId: string; userId: string; at: string; dismissed: boolean };

/**
 * Test double of the MomentReactionRepository port: one store, seen by each player through
 * `as(viewerId)` (an admin through `as(id, { admin: true })`). Same rules as the database: members
 * only, one emoji of each sort, one message per player and moment, a hidden item gone for all.
 */
export function createInMemoryMomentReactionStore(world: {
  leagues: { id: string; name: string; members: string[] }[];
  moments: { leagueId: string; key: string; kind: MomentKind }[];
  pseudos?: Record<string, string>;
}): { as(viewerId: string, options?: { admin?: boolean }): MomentReactionRepository } {
  const stored: Stored[] = [];
  const reports: Report[] = [];
  let next = 0;
  const isMember = (leagueId: string, userId: string) =>
    world.leagues.some((l) => l.id === leagueId && l.members.includes(userId));
  const momentOf = (leagueId: string, key: string) =>
    world.moments.find((m) => m.leagueId === leagueId && m.key === key);
  const shown = (id: string) => stored.find((s) => s.id === id && !s.hidden);

  const as = (viewerId: string, options: { admin?: boolean } = {}): MomentReactionRepository => {
    const allowed = (leagueId: string, key: string) =>
      isMember(leagueId, viewerId) && momentOf(leagueId, key) !== undefined;
    const add = (leagueId: string, momentKey: string, kind: Stored["kind"], code: string) =>
      stored.push({
        id: `reaction-${++next}`,
        leagueId,
        momentKey,
        userId: viewerId,
        kind,
        code,
        hidden: false,
        createdAt: next,
      });
    const remove = (test: (s: Stored) => boolean) => {
      const index = stored.findIndex((s) => test(s) && s.userId === viewerId && !s.hidden);
      if (index >= 0) stored.splice(index, 1);
    };

    return {
      async list(leagueId) {
        if (!isMember(leagueId, viewerId)) return [];
        return stored
          .filter((s) => s.leagueId === leagueId && !s.hidden)
          .sort((a, b) => a.createdAt - b.createdAt)
          .map((s): MomentResponse => ({
            id: s.id,
            momentKey: s.momentKey,
            kind: s.kind,
            code: s.code,
            pseudo: world.pseudos?.[s.userId] ?? s.userId,
            mine: s.userId === viewerId,
            reported: reports.some((r) => r.reactionId === s.id && r.userId === viewerId),
          }));
      },

      async addEmoji(leagueId, momentKey, emoji) {
        if (!allowed(leagueId, momentKey)) return "refused";
        const has = stored.some(
          (s) =>
            s.leagueId === leagueId &&
            s.momentKey === momentKey &&
            s.userId === viewerId &&
            s.kind === "emoji" &&
            s.code === emoji &&
            !s.hidden,
        );
        if (!has) add(leagueId, momentKey, "emoji", emoji);
        return "done";
      },

      async removeEmoji(leagueId, momentKey, emoji) {
        if (!allowed(leagueId, momentKey)) return "refused";
        remove(
          (s) =>
            s.leagueId === leagueId &&
            s.momentKey === momentKey &&
            s.kind === "emoji" &&
            s.code === emoji,
        );
        return "done";
      },

      async sendMessage(leagueId, momentKey, message) {
        if (!allowed(leagueId, momentKey)) return "refused";
        remove((s) => s.leagueId === leagueId && s.momentKey === momentKey && s.kind === "message");
        add(leagueId, momentKey, "message", message);
        return "done";
      },

      async report(reactionId) {
        const item = shown(reactionId);
        if (!item || !isMember(item.leagueId, viewerId)) return "unknown";
        if (!reports.some((r) => r.reactionId === reactionId && r.userId === viewerId))
          reports.push({
            reactionId,
            userId: viewerId,
            at: new Date(Date.UTC(2026, 10, 15, 0, 0, next++)).toISOString(),
            dismissed: false,
          });
        return "done";
      },

      async reports() {
        if (!options.admin) return "not_admin";
        const open = reports.filter((r) => !r.dismissed && shown(r.reactionId));
        const ids = [...new Set(open.map((r) => r.reactionId))];
        return ids
          .map((id): MomentReport => {
            const item = shown(id)!;
            const mine = open.filter((r) => r.reactionId === id);
            return {
              id,
              kind: item.kind,
              code: item.code,
              pseudo: world.pseudos?.[item.userId] ?? item.userId,
              leagueId: item.leagueId,
              leagueName: world.leagues.find((l) => l.id === item.leagueId)?.name ?? "",
              momentKind: momentOf(item.leagueId, item.momentKey)!.kind,
              reports: mine.length,
              lastReportedAt: mine
                .map((r) => r.at)
                .sort()
                .at(-1)!,
            };
          })
          .sort(
            (a, b) => b.reports - a.reports || b.lastReportedAt.localeCompare(a.lastReportedAt),
          );
      },

      async hide(reactionId) {
        if (!options.admin) return "not_admin";
        const item = shown(reactionId);
        if (!item) return "unknown";
        item.hidden = true;
        for (const r of reports) if (r.reactionId === reactionId) r.dismissed = true;
        return "done";
      },

      async dismiss(reactionId) {
        if (!options.admin) return "not_admin";
        if (!stored.some((s) => s.id === reactionId)) return "unknown";
        for (const r of reports) if (r.reactionId === reactionId) r.dismissed = true;
        return "done";
      },
    };
  };

  return { as };
}
