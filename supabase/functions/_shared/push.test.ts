import { describe, expect, it } from "vitest";
import { notificationOf, sendDue } from "./push.mjs";

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

function fakeDatabase(due: unknown[]) {
  const calls = { marked: [] as unknown[], forgotten: [] as string[] };
  return {
    calls,
    due: async () => due,
    markSent: async (sent: unknown[]) => void calls.marked.push(...sent),
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
    expect(report).toEqual({ sent: 2, forgotten: 0, failed: 0 });
  });

  it("forgets a device the push service no longer knows and counts other failures", async () => {
    const database = fakeDatabase([reminder]);
    const report = await sendDue(database, async (device: { endpoint: string }) => {
      if (device.endpoint.endsWith("/1")) throw Object.assign(new Error("gone"), { statusCode: 410 });
      throw Object.assign(new Error("boom"), { statusCode: 500 });
    });
    expect(database.calls.forgotten).toEqual(["https://push.example.test/1"]);
    expect(report).toEqual({ sent: 1, forgotten: 1, failed: 1 });
  });

  it("does not touch the database when nothing is due", async () => {
    const database = fakeDatabase([]);
    const report = await sendDue(database, async () => {});
    expect(database.calls.marked).toEqual([]);
    expect(report).toEqual({ sent: 0, forgotten: 0, failed: 0 });
  });
});
