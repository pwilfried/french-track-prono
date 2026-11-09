// #203: sends the push notifications due (rules in
// supabase/migrations/20261109100000_push_notifications.sql): a reminder before the lock of a final
// not predicted yet, and the points once computed. Run every 5 minutes by the « Push
// notifications » workflow. Talks to the production database through the Supabase Management API
// (same secrets as the migrations). Without the VAPID keys nothing is sent.
import webpush from "web-push";

const { SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } =
  process.env;

async function query(sql) {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    },
  );
  if (!response.ok)
    throw new Error(`database answered ${response.status}: ${await response.text()}`);
  return response.json();
}

const literal = (value) => `'${JSON.stringify(value).replaceAll("'", "''")}'`;
const GENDER = { F: "femmes", M: "hommes", X: "mixte" };

/** The text of a notification, as on the site (« 100 m femmes »). */
function notificationOf(due, now = Date.now()) {
  const event = `${due.discipline} ${GENDER[due.gender]}`;
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
  return {
    title: due.points > 0 ? `🎯 +${due.points} pts au ${event}` : `0 point au ${event}`,
    body: due.points > 0 ? "Tes points sont tombés." : "Le chrono ne ment pas.",
    url,
    tag: `result-${due.event_slug}`,
  };
}

async function main() {
  if (!SUPABASE_ACCESS_TOKEN || !SUPABASE_PROJECT_REF || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.log("No production database or no VAPID keys: nothing to send.");
    return;
  }
  webpush.setVapidDetails("https://www.frenchtrackprono.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const due = await query("select * from private.push_due()");
  const forgotten = [];
  for (const notification of due) {
    const payload = JSON.stringify(notificationOf(notification));
    for (const device of notification.devices) {
      try {
        await webpush.sendNotification(
          { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
          payload,
          { TTL: notification.kind === "reminder" ? 15 * 60 : 24 * 3600, urgency: "high" },
        );
      } catch (error) {
        // 404 and 410: the device unsubscribed. Anything else is retried by nobody: logged.
        if (error.statusCode === 404 || error.statusCode === 410) forgotten.push(device.endpoint);
        else
          console.error(`push failed (${error.statusCode ?? "network"}): ${error.body ?? error}`);
      }
    }
  }
  if (due.length) {
    const sent = due.map(({ user_id, event_slug, kind }) => ({ user_id, event_slug, kind }));
    await query(`select private.push_mark_sent(${literal(sent)}::jsonb)`);
  }
  if (forgotten.length)
    await query(
      `select private.push_forget(array(select jsonb_array_elements_text(${literal(forgotten)}::jsonb)))`,
    );
  console.log(
    `${due.length} notification(s) envoyée(s), ${forgotten.length} appareil(s) oublié(s).`,
  );
}

await main();
