import { describe, expect, it } from "vitest";
import { programNotificationOf, sendDue, sendTest, testNotifications } from "./push.mjs";

const devices12 = [
  { endpoint: "https://push.example.test/1", p256dh: "k1", auth: "a1" },
  { endpoint: "https://push.example.test/2", p256dh: "k2", auth: "a2" },
];
const final = (slug: string, discipline: string, gender: string, lock_at: string) => ({
  slug,
  discipline,
  gender,
  lock_at,
});
const reminder = {
  user_id: "u1",
  kind: "forgotten",
  evening: "2026-11-11",
  payload: { events: [final("100m-f", "100 m", "F", "2026-11-11T20:10:00Z")] },
  devices: devices12,
};
const result = {
  user_id: "u2",
  kind: "recap",
  evening: "2026-11-11",
  payload: {
    points: 9,
    finals: 2,
    rank: 4,
    players: 120,
    competition_slug: "meeting-paris",
    competition_name: "Meeting de Paris",
  },
  devices: [{ endpoint: "https://push.example.test/3", p256dh: "k3", auth: "a3" }],
};

const manager = {
  user_id: "u3",
  evening: "2026-11-11",
  devices: [{ endpoint: "https://push.example.test/4", p256dh: "k4", auth: "a4" }],
};

const program = {
  user_id: "u1",
  competition_slug: "meeting-paris-2027",
  competition_name: "Meeting de Paris",
  devices: devices12,
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
  it("marks a Manager reminder sent with what it is about, short-lived when it expires", async () => {
    const due = {
      ...manager,
      kind: "lineup",
      ref: "l1:c1",
      payload: {
        league_id: "l1",
        league_name: "Les Lièvres",
        competition_slug: "meeting-paris",
        competition_name: "Meeting de Paris",
        lock_at: "2026-11-11T18:45:00Z",
      },
    };
    const database = fakeDatabase([due]);
    const ttls: number[] = [];
    await sendDue(database, async (_device: unknown, _payload: string, options: { TTL: number }) => {
      ttls.push(options.TTL);
    });
    expect(ttls).toEqual([900]);
    expect(database.calls.marked).toEqual([
      { user_id: "u3", kind: "lineup", evening: "2026-11-11", ref: "l1:c1" },
    ]);
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
      { user_id: "u1", kind: "forgotten", evening: "2026-11-11", ref: "" },
      { user_id: "u2", kind: "recap", evening: "2026-11-11", ref: "" },
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
      failures: [{ kind: "forgotten", status: 500, count: 1 }],
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
      { kind: "forgotten", status: 500, count: 2 },
      { kind: "recap", status: "network", count: 1 },
    ]);
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

describe("sendTest", () => {
  it("sends one test notification to every device of the account and counts them", async () => {
    const sent: { endpoint: string; payload: { title: string; url: string; tag: string } }[] = [];
    const report = await sendTest(devices12, async (device, payload) => {
      sent.push({ endpoint: device.endpoint, payload: JSON.parse(payload) });
    });
    expect(report).toEqual({ sent: 2, forgotten: [], failed: 0 });
    const first = sent.filter((s) => s.endpoint === devices12[0].endpoint);
    expect(first).toHaveLength(26);
    expect(first.at(-1)!.payload).toMatchObject({ title: "🔔✅ Test réussi", url: "/" });
    expect(new Set(first.map((s) => s.payload.tag)).size).toBe(26);
  });

  it("lists the devices that unsubscribed and counts the other failures", async () => {
    const report = await sendTest(devices12, async (device) => {
      throw Object.assign(new Error("gone"), {
        statusCode: device.endpoint.endsWith("1") ? 410 : 500,
      });
    });
    expect(report).toEqual({ sent: 0, forgotten: ["https://push.example.test/1"], failed: 1 });
  });
});

describe("testNotifications", () => {
  it("gives one example of every case, chambrage and mercato reveal included, each with its own tag", () => {
    const now = new Date("2026-11-16T18:00:00Z").getTime();
    const samples = testNotifications(now);
    expect(samples).toHaveLength(26);
    expect(new Set(samples.map((n) => n.tag)).size).toBe(26);
    expect(samples.map((n) => `${n.title} | ${n.body}`)).toMatchSnapshot();
  });
});
