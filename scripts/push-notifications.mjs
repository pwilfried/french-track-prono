// #203: sends the push notifications due, by hand (the Edge Function `push-notifications`, run
// every minute by pg_cron, does it in production: #502). Same sending as the function
// (supabase/functions/_shared/push.mjs); talks to the production database through the Supabase
// Management API (same secrets as the migrations). Without the VAPID keys nothing is sent.
import webpush from "web-push";
import { sendDue, sendTest } from "../supabase/functions/_shared/push.mjs";

const {
  SUPABASE_ACCESS_TOKEN,
  SUPABASE_PROJECT_REF,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
  PUSH_TEST_EMAIL,
} = process.env;

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

async function main() {
  if (!SUPABASE_ACCESS_TOKEN || !SUPABASE_PROJECT_REF || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.log("No database or no VAPID keys: nothing to send.");
    return;
  }
  webpush.setVapidDetails("https://www.frenchtrackprono.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  // #977: one test notification to every device of one account, then stop.
  if (PUSH_TEST_EMAIL) {
    const email = `'${PUSH_TEST_EMAIL.toLowerCase().replaceAll("'", "''")}'`;
    const devices = await query(
      `select s.endpoint, s.p256dh, s.auth from push_subscriptions s
         join auth.users u on u.id = s.user_id where lower(u.email) = ${email}`,
    );
    if (!devices.length) {
      console.log(
        "::warning::Aucun appareil abonné pour ce compte : active les notifications dans ton profil.",
      );
      process.exitCode = 1;
      return;
    }
    const report = await sendTest(devices, (device, payload, options) =>
      webpush.sendNotification(device, payload, options),
    );
    console.log(
      `Test : ${report.sent} notification(s) envoyée(s) sur ${devices.length} appareil(s), ${report.forgotten.length} appareil(s) désabonné(s).`,
    );
    if (report.forgotten.length)
      await query(
        `select private.push_forget(array(select jsonb_array_elements_text(${literal(report.forgotten)}::jsonb)))`,
      );
    if (report.failed || !report.sent) process.exitCode = 1;
    return;
  }

  const report = await sendDue(
    {
      due: () => query("select * from private.reminder_due()"),
      markSent: (sent) => query(`select private.reminder_mark_sent(${literal(sent)}::jsonb)`),
      programDue: () => query("select * from private.program_due()"),
      markProgramSent: (sent) => query(`select private.program_mark_sent(${literal(sent)}::jsonb)`),
      forget: (endpoints) =>
        query(
          `select private.push_forget(array(select jsonb_array_elements_text(${literal(endpoints)}::jsonb)))`,
        ),
    },
    (device, payload, options) => webpush.sendNotification(device, payload, options),
  );
  console.log(
    `${report.sent} notification(s) envoyée(s), ${report.forgotten} appareil(s) oublié(s).`,
  );
  // A failed send makes the run fail: GitHub e-mails the owner (#195).
  if (report.failed) process.exitCode = 1;
}

await main();
