import { describe, expect, it } from "vitest";

import type { MomentResponse } from "@/domain/moment-reactions";

import { UseCaseError } from "./errors";
import {
  dismissMomentReports,
  getMomentReactions,
  hideMomentReaction,
  listMomentReports,
  reactToMoment,
  reportMomentReaction,
  sendPresetMessage,
  type MomentReactionRepository,
} from "./moment-reactions";

type Item = MomentResponse & { userId: string; hidden: boolean; reportedBy: Set<string> };

/**
 * A small store: Ana and Bob in « Les amis », one moment about Ana; each player sees it through
 * `as(id)`. The full rules are checked against the database in the port's contract.
 */
function world() {
  const items: Item[] = [];
  const members = ["ana", "bob"];
  const pseudos: Record<string, string> = { ana: "Ana", bob: "Bob", cid: "Cid" };
  const key = "perfect_podium:e1:ana";
  const repository = (me: string, admin = false): MomentReactionRepository => {
    const ok = (leagueId: string, momentKey: string) =>
      leagueId === "friends" && momentKey === key && members.includes(me);
    const visible = (id: string) => items.find((i) => i.id === id && !i.hidden);
    const add = (kind: Item["kind"], code: string) =>
      items.push({
        id: `r${items.length + 1}`,
        momentKey: key,
        kind,
        code,
        pseudo: pseudos[me],
        mine: false,
        reported: false,
        userId: me,
        hidden: false,
        reportedBy: new Set(),
      });
    const drop = (test: (i: Item) => boolean) => {
      const at = items.findIndex((i) => test(i) && i.userId === me && !i.hidden);
      if (at >= 0) items.splice(at, 1);
    };
    const open = () => items.filter((i) => !i.hidden && i.reportedBy.size > 0);
    return {
      list: async (leagueId) =>
        members.includes(me) && leagueId === "friends"
          ? items
              .filter((i) => !i.hidden)
              .map((i) => ({ ...i, mine: i.userId === me, reported: i.reportedBy.has(me) }))
          : [],
      addEmoji: async (leagueId, momentKey, emoji) => {
        if (!ok(leagueId, momentKey)) return "refused";
        drop((i) => i.kind === "emoji" && i.code === emoji);
        add("emoji", emoji);
        return "done";
      },
      removeEmoji: async (leagueId, momentKey, emoji) => {
        if (!ok(leagueId, momentKey)) return "refused";
        drop((i) => i.kind === "emoji" && i.code === emoji);
        return "done";
      },
      sendMessage: async (leagueId, momentKey, message) => {
        if (!ok(leagueId, momentKey)) return "refused";
        drop((i) => i.kind === "message");
        add("message", message);
        return "done";
      },
      report: async (id) => {
        const item = visible(id);
        if (!item) return "unknown";
        item.reportedBy.add(me);
        return "done";
      },
      reports: async () =>
        admin
          ? open().map((i) => ({
              id: i.id,
              kind: i.kind,
              code: i.code,
              pseudo: i.pseudo,
              leagueId: "friends",
              leagueName: "Les amis",
              momentKind: "perfect_podium",
              reports: i.reportedBy.size,
              lastReportedAt: "2026-11-15T20:00:00.000Z",
            }))
          : "not_admin",
      hide: async (id) => {
        if (!admin) return "not_admin";
        const item = visible(id);
        if (!item) return "unknown";
        item.hidden = true;
        return "done";
      },
      dismiss: async (id) => {
        if (!admin) return "not_admin";
        const item = visible(id);
        if (!item) return "unknown";
        item.reportedBy.clear();
        return "done";
      },
    };
  };
  const moment = { leagueId: "friends", momentKey: key };
  const as = (id: string) => ({ reactions: repository(id) });
  return { moment, as, admin: { reactions: repository("admin", true) } };
}

const shown = async (ports: ReturnType<ReturnType<typeof world>["as"]>) =>
  (await getMomentReactions(ports).execute({ leagueId: "friends" }))["perfect_podium:e1:ana"];

describe("reacting to a league moment", () => {
  it("adds a reaction then removes it, the counter following", async () => {
    // Given Bob in Ana's league
    const { moment, as } = world();
    // When he reacts with 🔥
    await reactToMoment(as("bob")).execute({ ...moment, emoji: "fire", on: true });
    // Then the moment shows one 🔥, his
    expect((await shown(as("ana")))?.emojis[0]).toEqual({ code: "fire", count: 1, mine: false });
    expect((await shown(as("bob")))?.emojis[0]).toEqual({ code: "fire", count: 1, mine: true });
    // When he taps it again
    await reactToMoment(as("bob")).execute({ ...moment, emoji: "fire", on: false });
    // Then it is gone
    expect((await shown(as("ana")))?.emojis[0].count ?? 0).toBe(0);
  });

  it("keeps one reaction of each sort per player", async () => {
    const { moment, as } = world();
    await reactToMoment(as("bob")).execute({ ...moment, emoji: "fire", on: true });
    await reactToMoment(as("bob")).execute({ ...moment, emoji: "fire", on: true });
    await reactToMoment(as("bob")).execute({ ...moment, emoji: "clap", on: true });
    const emojis = (await shown(as("ana")))!.emojis;
    expect(emojis.map((e) => e.count)).toEqual([1, 1, 0, 0]);
  });

  it("replaces a first preset message with the second on the same moment", async () => {
    const { moment, as } = world();
    await sendPresetMessage(as("bob")).execute({ ...moment, message: "well_played" });
    await sendPresetMessage(as("bob")).execute({ ...moment, message: "rematch" });
    const messages = (await shown(as("ana")))!.messages;
    expect(messages.map((m) => [m.pseudo, m.code])).toEqual([["Bob", "rematch"]]);
  });

  it("refuses an emoji or a message out of the lists", async () => {
    const { moment, as } = world();
    await expect(
      reactToMoment(as("bob")).execute({ ...moment, emoji: "🤡", on: true }),
    ).rejects.toEqual(new UseCaseError("INVALID_REACTION"));
    await expect(
      sendPresetMessage(as("bob")).execute({ ...moment, message: "Salut !" }),
    ).rejects.toEqual(new UseCaseError("INVALID_REACTION"));
  });

  it("refuses a player outside the league", async () => {
    const { moment, as } = world();
    await expect(
      reactToMoment(as("cid")).execute({ ...moment, emoji: "fire", on: true }),
    ).rejects.toEqual(new UseCaseError("MOMENT_REACTION_REFUSED"));
    await expect(
      sendPresetMessage(as("cid")).execute({ ...moment, message: "well_played" }),
    ).rejects.toEqual(new UseCaseError("MOMENT_REACTION_REFUSED"));
    expect(await getMomentReactions(as("cid")).execute({ leagueId: "friends" })).toEqual({});
  });
});

describe("moderating the reactions of the feed", () => {
  it("a player reports a message, the admin hides it, it disappears for everyone", async () => {
    // Given Bob's message under Ana's moment
    const { moment, as, admin } = world();
    await sendPresetMessage(as("bob")).execute({ ...moment, message: "rematch" });
    const id = (await shown(as("ana")))!.messages[0].id;
    // When Ana reports it, twice
    await reportMomentReaction(as("ana")).execute({ reactionId: id });
    await reportMomentReaction(as("ana")).execute({ reactionId: id });
    // Then the admin sees one report
    const reports = await listMomentReports(admin).execute();
    expect(reports).toMatchObject([
      { id, kind: "message", code: "rematch", pseudo: "Bob", leagueName: "Les amis", reports: 1 },
    ]);
    expect((await shown(as("ana")))!.messages[0].reported).toBe(true);
    // When the admin hides it
    await hideMomentReaction(admin).execute({ reactionId: id });
    // Then nobody reads it any more, and the report is handled
    expect((await shown(as("ana")))?.messages ?? []).toEqual([]);
    expect((await shown(as("bob")))?.messages ?? []).toEqual([]);
    expect(await listMomentReports(admin).execute()).toEqual([]);
  });

  it("the admin dismisses a report: the message stays", async () => {
    const { moment, as, admin } = world();
    await sendPresetMessage(as("bob")).execute({ ...moment, message: "bad_luck" });
    const id = (await shown(as("ana")))!.messages[0].id;
    await reportMomentReaction(as("ana")).execute({ reactionId: id });
    await dismissMomentReports(admin).execute({ reactionId: id });
    expect(await listMomentReports(admin).execute()).toEqual([]);
    expect((await shown(as("ana")))!.messages).toHaveLength(1);
  });

  it("only the admin hides or lists the reports", async () => {
    const { moment, as } = world();
    await sendPresetMessage(as("bob")).execute({ ...moment, message: "bad_luck" });
    const id = (await shown(as("ana")))!.messages[0].id;
    await expect(hideMomentReaction(as("ana")).execute({ reactionId: id })).rejects.toEqual(
      new UseCaseError("NOT_ADMIN"),
    );
    await expect(listMomentReports(as("ana")).execute()).rejects.toEqual(
      new UseCaseError("NOT_ADMIN"),
    );
  });

  it("refuses to report a reaction that is not there", async () => {
    const { as, admin } = world();
    await expect(reportMomentReaction(as("ana")).execute({ reactionId: "nope" })).rejects.toEqual(
      new UseCaseError("REACTION_UNKNOWN"),
    );
    await expect(hideMomentReaction(admin).execute({ reactionId: "nope" })).rejects.toEqual(
      new UseCaseError("REACTION_UNKNOWN"),
    );
  });

  it("refuses a report beyond 20 in a day with REPORT_LIMIT", async () => {
    const { as } = world();
    const ports = {
      reactions: { ...as("ana").reactions, report: async () => "too_many" as const },
    };
    await expect(reportMomentReaction(ports).execute({ reactionId: "any" })).rejects.toEqual(
      new UseCaseError("REPORT_LIMIT"),
    );
  });
});
