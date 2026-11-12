// #502: sends the push notifications due. Called every minute by pg_cron
// (supabase/migrations/20261111180000_push_cron.sql) with the secret it reads from Vault; anyone
// else gets a 401. Secrets of the function (set by the migrations workflow at each tag):
// PUSH_CRON_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and SENTRY_DSN if any (#527: a failed run
// is reported to Sentry; without it, nothing is). SUPABASE_DB_URL is given by Supabase.
// Deno code: excluded from the app's typecheck (tsconfig.json).
import webpush from "npm:web-push@3.6.7";
import postgres from "npm:postgres@3.4.5";
import { sendDue } from "../_shared/push.mjs";
import { reportPushFailure } from "../_shared/sentry.mjs";

const env = (name: string) => Deno.env.get(name) ?? "";
const sentry = () => ({ dsn: env("SENTRY_DSN"), fetch });

/** Compares the secrets without leaking how much of them matches. */
function sameSecret(given: string, expected: string) {
  if (!expected || given.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < given.length; i += 1)
    difference |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return difference === 0;
}

Deno.serve(async (request) => {
  if (!sameSecret(request.headers.get("x-push-secret") ?? "", env("PUSH_CRON_SECRET")))
    return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!env("VAPID_PUBLIC_KEY") || !env("VAPID_PRIVATE_KEY"))
    return Response.json({ error: "no_vapid_keys" }, { status: 503 });
  webpush.setVapidDetails(
    "https://www.frenchtrackprono.com",
    env("VAPID_PUBLIC_KEY"),
    env("VAPID_PRIVATE_KEY"),
  );

  const sql = postgres(env("SUPABASE_DB_URL"), { max: 1, prepare: false });
  try {
    // One run at a time: if the previous minute's run is still sending, this one does nothing
    // (the lock is released with the transaction, so a crashed run never blocks the next).
    const report = await sql.begin(async (tx) => {
      const [{ locked }] =
        await tx`select pg_try_advisory_xact_lock(hashtext('push-notifications')) as locked`;
      if (!locked) return null;
      return sendDue(
        {
          due: () => tx`select * from private.push_due()`,
          markSent: async (sent) => {
            await tx`select private.push_mark_sent(${tx.json(sent)}::jsonb)`;
          },
          forget: async (endpoints) => {
            await tx`select private.push_forget(${endpoints}::text[])`;
          },
        },
        (device, payload, options) => webpush.sendNotification(device, payload, options),
      );
    });
    if (!report) return Response.json({ skipped: "already_running" });
    console.log(
      `${report.sent} notification(s) envoyée(s), ${report.forgotten} appareil(s) oublié(s).`,
    );
    // 404 and 410 (expired subscriptions) are not failures: sendDue forgets those devices.
    if (report.failed) await reportPushFailure(sentry(), { failures: report.failures });
    return Response.json(report, { status: report.failed ? 500 : 200 });
  } catch (error) {
    await reportPushFailure(sentry(), { error });
    throw error;
  } finally {
    await sql.end();
  }
});
