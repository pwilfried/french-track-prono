import { describe, expect, it } from "vitest";
import { notificationOf, programNotificationOf, sendDue } from "./push.mjs";

const reminder = {
  user_id: "u1",
  kind: "reminder",
  event_slug: "100m-f",
  discipline: "100 m",
  gender: "F",
  lock_at: "2026-11-11T20:10:00Z",
  points: null,
  devices: [
    { endpoint: "https://push.example.test/1", p256dh: "k1", auth: "a1" },
    { endpoint: "https://push.example.test/2", p256dh: "k2", auth: "a2" },
  ],
};
const result = {
  user_id: "u2",
  kind: "result",
  event_slug: "400m-h",
  discipline: "400 m",
  gender: "M",
  lock_at: "2026-11-11T18:00:00Z",
  points: 9,
  devices: [{ endpoint: "https://push.example.test/3", p256dh: "k3", auth: "a3" }],
};

const program = {
  user_id: "u1",
  competition_slug: "meeting-paris-2027",
  competition_name: "Meeting de Paris",
  devices: reminder.devices,
};

type ProgramSent = { user_id: string; competition_slug: string };

function fakeDatabase(due: unknown[], programs: ProgramSent[] = []) {
  const calls = {
    marked: [] as unknown[],
    programsMarked: [] as ProgramSent[],
    forgotten: [] as string[],
  };
  const isMarked = (p: ProgramSent) =>
    calls.programsMarked.some(
      (m) => m.user_id === p.user_id && m.competition_slug === p.competition_slug,
    );
  return {
    calls,
    due: async () => due,
    markSent: async (sent: unknown[]) => void calls.marked.push(...sent),
    // An alert marked sent is no longer due, as with private.program_mark_sent().
    programDue: async () => programs.filter((p) => !isMarked(p)),
    markProgramSent: async (marked: ProgramSent[]) => void calls.programsMarked.push(...marked),
    forget: async (endpoints: string[]) => void calls.forgotten.push(...endpoints),
  };
}

describe("push notifications", () => {
  it("words a reminder with the minutes left before the lock", () => {
    const now = new Date("2026-11-11T20:00:00Z").getTime();
    expect(notificationOf(reminder, now)).toEqual({
      title: "⏱ 100 m femmes se verrouille dans 10 min",
      body: "Ton podium n'est pas encore fait.",
      url: "/epreuves/100m-f",
      tag: "reminder-100m-f",
    });
  });

  it("words the points once computed", () => {
    expect(notificationOf(result).title).toBe("🎯 +9 pts au 400 m hommes");
    expect(notificationOf({ ...result, points: 0 }).title).toBe("0 point au 400 m hommes");
  });

  it("sends each due notification to every device and marks it sent", async () => {
    const database = fakeDatabase([reminder, result]);
    const pushed: string[] = [];
    const report = await sendDue(database, async (device: { endpoint: string }) => {
      pushed.push(device.endpoint);
    });
    expect(pushed).toEqual([
      "https://push.example.test/1",
      "https://push.example.test/2",
      "https://push.example.test/3",
    ]);
    expect(database.calls.marked).toEqual([
      { user_id: "u1", event_slug: "100m-f", kind: "reminder" },
      { user_id: "u2", event_slug: "400m-h", kind: "result" },
    ]);
    expect(report).toEqual({ sent: 2, forgotten: 0, failed: 0, failures: [] });
  });

  it("forgets a device the push service no longer knows and counts other failures", async () => {
    const database = fakeDatabase([reminder]);
    const report = await sendDue(database, async (device: { endpoint: string }) => {
      if (device.endpoint.endsWith("/1")) throw Object.assign(new Error("gone"), { statusCode: 410 });
      throw Object.assign(new Error("boom"), { statusCode: 500 });
    });
    expect(database.calls.forgotten).toEqual(["https://push.example.test/1"]);
    expect(report).toEqual({
      sent: 1,
      forgotten: 1,
      failed: 1,
      failures: [{ kind: "reminder", status: 500, count: 1 }],
    });
  });

  it("groups the failures by kind and HTTP status, a network error having none", async () => {
    const database = fakeDatabase([reminder, result]);
    const report = await sendDue(database, async (device: { endpoint: string }) => {
      if (device.endpoint.endsWith("/3")) throw new Error("offline");
      throw Object.assign(new Error("boom"), { statusCode: 500 });
    });
    expect(report.failed).toBe(3);
    expect(report.failures).toEqual([
      { kind: "reminder", status: 500, count: 2 },
      { kind: "result", status: "network", count: 1 },
    ]);
  });

  it("words the publication of a programme", () => {
    expect(programNotificationOf(program)).toEqual({
      title: "Le programme de Meeting de Paris est en ligne",
      body: "Les épreuves sont là : pose tes podiums.",
      url: "/competitions?competition=meeting-paris-2027",
      tag: "program-meeting-paris-2027",
    });
  });

  it("notifies each subscriber once when the programme of a competition is published", async () => {
    const other = {
      ...program,
      user_id: "u2",
      devices: [{ endpoint: "https://push.example.test/3", p256dh: "k3", auth: "a3" }],
    };
    const database = fakeDatabase([], [program, other]);
    const pushed: { endpoint: string; payload: string; ttl: number }[] = [];
    const push = async (device: { endpoint: string }, payload: string, options: { TTL: number }) =>
      void pushed.push({ endpoint: device.endpoint, payload, ttl: options.TTL });

    const report = await sendDue(database, push);
    expect(pushed.map((p) => p.endpoint)).toEqual([
      "https://push.example.test/1",
      "https://push.example.test/2",
      "https://push.example.test/3",
    ]);
    expect(JSON.parse(pushed[0]!.payload)).toEqual(programNotificationOf(program));
    expect(pushed[0]!.ttl).toBe(24 * 3600);
    expect(database.calls.programsMarked).toEqual([
      { user_id: "u1", competition_slug: "meeting-paris-2027" },
      { user_id: "u2", competition_slug: "meeting-paris-2027" },
    ]);
    expect(report).toEqual({ sent: 2, forgotten: 0, failed: 0, failures: [] });

    const again = await sendDue(database, push);
    expect(pushed).toHaveLength(3);
    expect(again.sent).toBe(0);
  });

  it("does not touch the database when nothing is due", async () => {
    const database = fakeDatabase([]);
    const report = await sendDue(database, async () => {});
    expect(database.calls.marked).toEqual([]);
    expect(database.calls.programsMarked).toEqual([]);
    expect(report).toEqual({ sent: 0, forgotten: 0, failed: 0, failures: [] });
  });
});
