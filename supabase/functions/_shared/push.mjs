// #203, #502: the sending of the push notifications due, shared by the Edge Function
// `push-notifications` (run every minute by pg_cron) and by `scripts/push-notifications.mjs`
// (by hand). Rules of what is due: supabase/migrations/20261109100000_push_notifications.sql.
// Plain JavaScript with no import, so that Deno and Node both load it.

const GENDER = { F: "femmes", M: "hommes", X: "mixte" };

/**
 * The text of a notification, as on the site (« 100 m femmes »).
 * @param {{ kind: string, event_slug: string, discipline: string, gender: string,
 *           lock_at: string, points: number | null }} due
 * @param {number} [now]
 */
export function notificationOf(due, now = Date.now()) {
  const event = `${due.discipline} ${GENDER[/** @type {"F" | "M" | "X"} */ (due.gender)]}`;
  const url = `/epreuves/${due.event_slug}`;
  if (due.kind === "reminder") {
    const minutes = Math.max(1, Math.round((new Date(due.lock_at).getTime() - now) / 60_000));
    return {
      title: `⏱ ${event} se verrouille dans ${minutes} min`,
      body: "Ton podium n'est pas encore fait.",
      url,
      tag: `reminder-${due.event_slug}`,
    };
  }
  const points = due.points ?? 0;
  return {
    title: points > 0 ? `🎯 +${points} pts au ${event}` : `0 point au ${event}`,
    body: points > 0 ? "Tes points sont tombés." : "Le chrono ne ment pas.",
    url,
    tag: `result-${due.event_slug}`,
  };
}

/**
 * Sends what is due to every device of each player, then records it.
 * `push(device, payload, options)` sends one notification (web-push's sendNotification); it throws
 * an error with `statusCode` 404 or 410 when the device unsubscribed.
 * @param {{ due: () => Promise<any[]>, markSent: (sent: any[]) => Promise<void>,
 *           forget: (endpoints: string[]) => Promise<void> }} database
 * @param {(device: any, payload: string, options: any) => Promise<unknown>} push
 */
export async function sendDue(database, push) {
  const due = await database.due();
  /** @type {string[]} */
  const forgotten = [];
  /** Failed sends by kind and HTTP status (#527), in the order first met. */
  /** @type {Map<string, { kind: string, status: number | "network", count: number }>} */
  const failures = new Map();
  let failed = 0;
  for (const notification of due) {
    const payload = JSON.stringify(notificationOf(notification));
    for (const device of notification.devices) {
      try {
        await push(
          { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
          payload,
          { TTL: notification.kind === "reminder" ? 15 * 60 : 24 * 3600, urgency: "high" },
        );
      } catch (error) {
        // 404 and 410: the device unsubscribed. Anything else is logged and counted.
        const { statusCode, body } = /** @type {{ statusCode?: number, body?: string }} */ (error);
        if (statusCode === 404 || statusCode === 410) forgotten.push(device.endpoint);
        else {
          failed += 1;
          const status = statusCode ?? "network";
          const key = `${notification.kind}:${status}`;
          const failure = failures.get(key) ?? { kind: notification.kind, status, count: 0 };
          failure.count += 1;
          failures.set(key, failure);
          console.error(`push failed (${statusCode ?? "network"}): ${body ?? error}`);
        }
      }
    }
  }
  if (due.length)
    await database.markSent(due.map(({ user_id, event_slug, kind }) => ({ user_id, event_slug, kind })));
  if (forgotten.length) await database.forget(forgotten);
  return { sent: due.length, forgotten: forgotten.length, failed, failures: [...failures.values()] };
}
