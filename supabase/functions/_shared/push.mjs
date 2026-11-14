// #203, #502: the sending of the push notifications due, shared by the Edge Function
// `push-notifications` (run every minute by pg_cron) and by `scripts/push-notifications.mjs`
// (by hand). Rules of what is due: the grouped reminders (#681),
// supabase/migrations/20261114060000_reminder_settings.sql, and for the programme of a
// competition (#659): supabase/migrations/20261113120000_program_alerts.sql.
// Plain JavaScript with no import, so that Deno and Node both load it.

const GENDER = { F: "femmes", M: "hommes", X: "mixte" };

/** « 100 m femmes », as on the site. @param {{ discipline: string, gender: string }} event */
const labelOf = (event) =>
  `${event.discipline} ${GENDER[/** @type {"F" | "M" | "X"} */ (event.gender)]}`;

/** « a, b et c ». @param {string[]} items */
const listOf = (items) =>
  items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} et ${items.at(-1)}`;

/** @param {number} n */
const pts = (n) => (n > 1 ? `${n} pts` : `${n} pt`);

/**
 * The text of a grouped reminder (#681): « Pronos oubliés » for every final of the evening
 * locking soon, or « Résultats du soir » once all its points are computed.
 * @param {{ kind: string, evening: string, payload: any }} due
 * @param {number} [now]
 */
export function notificationOf(due, now = Date.now()) {
  if (due.kind === "forgotten") {
    /** @type {{ slug: string, discipline: string, gender: string, lock_at: string }[]} */
    const events = due.payload.events;
    const first = events[0];
    const minutes = Math.max(1, Math.round((new Date(first.lock_at).getTime() - now) / 60_000));
    if (events.length === 1)
      return {
        title: `⏱ ${labelOf(first)} se verrouille dans ${minutes} min`,
        body: "Ton podium n'est pas encore fait.",
        url: `/epreuves/${first.slug}`,
        tag: `forgotten-${due.evening}`,
      };
    return {
      title: `⏱ ${events.length} podiums à poser`,
      body: `${listOf(events.map(labelOf))} : premier verrou dans ${minutes} min.`,
      url: `/epreuves/${first.slug}`,
      tag: `forgotten-${due.evening}`,
    };
  }
  const { points, finals, rank, players, competition_slug } = due.payload;
  const place = rank ? ` Tu es ${rank === 1 ? "1er" : `${rank}e`} sur ${players}.` : "";
  return {
    title: points > 0 ? `🎯 +${pts(points)} ce soir` : "0 point ce soir",
    body: `${finals > 1 ? `Tes ${finals} finales sont calculées.` : "Ta finale est calculée."}${place}`,
    url: `/mes-points?competition=${encodeURIComponent(competition_slug)}`,
    tag: `recap-${due.evening}`,
  };
}

/**
 * The text of the notification sent when the programme of a competition is published (#659).
 * @param {{ competition_slug: string, competition_name: string }} due
 */
export function programNotificationOf(due) {
  return {
    title: `Le programme de ${due.competition_name} est en ligne`,
    body: "Les épreuves sont là : pose tes podiums.",
    url: `/competitions?competition=${encodeURIComponent(due.competition_slug)}`,
    tag: `program-${due.competition_slug}`,
  };
}

/**
 * Sends what is due to every device of each player, then records it.
 * `push(device, payload, options)` sends one notification (web-push's sendNotification); it throws
 * an error with `statusCode` 404 or 410 when the device unsubscribed.
 * Then the same for the programmes published (#659), one notification per player and competition.
 * @param {{ due: () => Promise<any[]>, markSent: (sent: any[]) => Promise<void>,
 *           programDue: () => Promise<any[]>, markProgramSent: (sent: any[]) => Promise<void>,
 *           forget: (endpoints: string[]) => Promise<void> }} database
 * @param {(device: any, payload: string, options: any) => Promise<unknown>} push
 */
export async function sendDue(database, push) {
  const due = await database.due();
  const programs = await database.programDue();
  /** @type {string[]} */
  const forgotten = [];
  /** Failed sends by kind and HTTP status (#527), in the order first met. */
  /** @type {Map<string, { kind: string, status: number | "network", count: number }>} */
  const failures = new Map();
  let failed = 0;

  /**
   * @param {string} kind
   * @param {any[]} devices
   * @param {string} payload
   * @param {number} ttl in seconds
   */
  async function sendToDevices(kind, devices, payload, ttl) {
    for (const device of devices) {
      try {
        await push(
          { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
          payload,
          { TTL: ttl, urgency: "high" },
        );
      } catch (error) {
        // 404 and 410: the device unsubscribed. Anything else is logged and counted.
        const { statusCode, body } = /** @type {{ statusCode?: number, body?: string }} */ (error);
        if (statusCode === 404 || statusCode === 410) forgotten.push(device.endpoint);
        else {
          failed += 1;
          const status = statusCode ?? "network";
          const key = `${kind}:${status}`;
          const failure = failures.get(key) ?? { kind, status, count: 0 };
          failure.count += 1;
          failures.set(key, failure);
          console.error(`push failed (${statusCode ?? "network"}): ${body ?? error}`);
        }
      }
    }
  }

  for (const notification of due) {
    await sendToDevices(
      notification.kind,
      notification.devices,
      JSON.stringify(notificationOf(notification)),
      notification.kind === "forgotten" ? 15 * 60 : 24 * 3600,
    );
  }
  for (const program of programs) {
    await sendToDevices(
      "program",
      program.devices,
      JSON.stringify(programNotificationOf(program)),
      24 * 3600,
    );
  }
  if (due.length)
    await database.markSent(due.map(({ user_id, kind, evening }) => ({ user_id, kind, evening })));
  if (programs.length)
    await database.markProgramSent(
      programs.map(({ user_id, competition_slug }) => ({ user_id, competition_slug })),
    );
  if (forgotten.length) await database.forget(forgotten);
  return {
    sent: due.length + programs.length,
    forgotten: forgotten.length,
    failed,
    failures: [...failures.values()],
  };
}
