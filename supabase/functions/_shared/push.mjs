// #203, #502: the sending of the push notifications due, shared by the Edge Function
// `push-notifications` (run every minute by pg_cron) and by `scripts/push-notifications.mjs`
// (by hand). Rules of what is due: the grouped reminders (#681),
// supabase/migrations/20261114060000_reminder_settings.sql, the Manager ones (#836),
// supabase/migrations/20261114070000_manager_reminders.sql, the reactions to a league moment
// (#672): supabase/migrations/20261115040000_moment_reactions.sql, and for the programme of a
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

/** « 45 min », « 2 h », « 1 h 30 ». @param {number} minutes */
const durationOf = (minutes) => {
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  return `${Math.floor(minutes / 60)} h${rest ? ` ${String(rest).padStart(2, "0")}` : ""}`;
};

/** Minutes left before an instant, at least 1. @param {string} iso @param {number} now */
const minutesUntil = (iso, now) => Math.max(1, Math.round((new Date(iso).getTime() - now) / 60_000));

/**
 * The text of a Manager reminder (#836): the end of a mercato round, a lineup not validated, a
 * head-to-head over.
 * @param {{ kind: string, ref: string, payload: any }} due
 * @param {number} now
 */
function managerNotificationOf(due, now) {
  const p = due.payload;
  const tag = `${due.kind}-${due.ref}`;
  if (due.kind === "mercato_round")
    return {
      title: `⏳ Le tour ${p.round} du mercato se termine dans ${durationOf(minutesUntil(p.ends_at, now))}`,
      body: `${p.league_name} : place tes dernières enchères.`,
      url: `/manager/${p.league_id}/catalogue`,
      tag,
    };
  if (due.kind === "lineup")
    return {
      title: "🏟 Ton alignement n'est pas validé",
      body: `${p.league_name}, ${p.competition_name} : verrou dans ${durationOf(minutesUntil(p.lock_at, now))}. Sans alignement, 0 point.`,
      url: `/manager/${p.league_id}/alignement/${encodeURIComponent(p.competition_slug)}`,
      tag,
    };
  const title =
    p.my_score > p.their_score
      ? `🏆 Victoire contre ${p.opponent}`
      : p.my_score < p.their_score
        ? `Défaite contre ${p.opponent}`
        : `Match nul contre ${p.opponent}`;
  return {
    title,
    body: `${p.league_name}, journée ${p.round} : ${pts(p.my_score)} à ${pts(p.their_score)}.`,
    url: `/manager/${p.league_id}/confrontation/${p.round}/${p.home_id}`,
    tag,
  };
}

/** The Manager reminders, sent once per round or competition (#836). */
const MANAGER_KINDS = ["mercato_round", "lineup", "duel_over"];

/** Reminders worth nothing once their time is over: a short lifetime on the push service. */
const SHORT_LIVED = ["forgotten", "mercato_round", "lineup"];

/**
 * The text of the reactions to my league moments (#672), grouped: one an hour at most.
 * @param {{ count: number, pseudo: string, league_id: string, league_name: string }} p
 */
function momentReactionNotificationOf(p) {
  const others = p.count - 1;
  return {
    title:
      others > 0
        ? `${p.pseudo} et ${others} ${others > 1 ? "autres" : "autre"} ont réagi à ton moment`
        : `${p.pseudo} a réagi à ton moment`,
    body: `${p.league_name} : va voir le fil.`,
    url: `/ligues/${p.league_id}?onglet=fil`,
    tag: "moment_reaction",
  };
}

/**
 * The text of a grouped reminder (#681): « Pronos oubliés » for every final of the evening
 * locking soon, or « Résultats du soir » once all its points are computed; or a Manager one.
 * @param {{ kind: string, evening: string, ref?: string, payload: any }} due
 * @param {number} [now]
 */
export function notificationOf(due, now = Date.now()) {
  if (due.kind === "moment_reaction") return momentReactionNotificationOf(due.payload);
  if (MANAGER_KINDS.includes(due.kind))
    return managerNotificationOf({ kind: due.kind, ref: due.ref ?? "", payload: due.payload }, now);
  if (due.kind === "forgotten") {
    /** @type {{ slug: string, discipline: string, gender: string, lock_at: string }[]} */
    const events = due.payload.events;
    const first = events[0];
    const minutes = minutesUntil(first.lock_at, now);
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
      SHORT_LIVED.includes(notification.kind) ? 15 * 60 : 24 * 3600,
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
    await database.markSent(
      due.map(({ user_id, kind, evening, ref }) => ({ user_id, kind, evening, ref: ref ?? "" })),
    );
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

/**
 * Sends one test notification to the given devices of an account (#977), to check that push
 * notifications reach a phone without waiting for a reminder or a result.
 * @param {{ endpoint: string, p256dh: string, auth: string }[]} devices
 * @param {(device: any, payload: string, options: any) => Promise<unknown>} push
 */
export async function sendTest(devices, push) {
  const payload = JSON.stringify({
    title: "🔔 Notification de test",
    body: "Si tu lis ceci, les notifications French Track Prono marchent sur cet appareil.",
    url: "/",
    tag: "test",
  });
  /** @type {string[]} */
  const forgotten = [];
  let sent = 0;
  let failed = 0;
  for (const device of devices) {
    try {
      await push(
        { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
        payload,
        { TTL: 15 * 60, urgency: "high" },
      );
      sent += 1;
    } catch (error) {
      const { statusCode, body } = /** @type {{ statusCode?: number, body?: string }} */ (error);
      if (statusCode === 404 || statusCode === 410) forgotten.push(device.endpoint);
      else {
        failed += 1;
        console.error(`push failed (${statusCode ?? "network"}): ${body ?? error}`);
      }
    }
  }
  return { sent, forgotten, failed };
}
