// #1134: draws the trophies of the current season every day and, in January, of the one just over
// (rules of docs/decisions/badges-et-trophees.md), then announces the new ones: a moment in the
// feed of their league, a notification to the winner. Run daily by the « Trophies » workflow, in
// production and in pre-production; running it again adds nothing and announces nothing again.
// The TypeScript of the app (scripts/award-trophies.ts) is loaded through Vite, as by the tests.
// The service_role key is SUPABASE_SERVICE_ROLE_KEY when set, otherwise read from the Supabase
// Management API with the secrets of the migrations (SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF).
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";
import { runnerImport } from "vite";

const { SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } =
  process.env;

/** The service_role key of the project, from the Management API. */
async function serviceKey() {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/api-keys?reveal=true`,
    { headers: { Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}` } },
  );
  if (!response.ok)
    throw new Error(`Management API answered ${response.status}: ${await response.text()}`);
  const keys = await response.json();
  const key =
    keys.find((k) => k.name === "service_role")?.api_key ??
    keys.find((k) => k.type === "secret")?.api_key;
  if (!key) throw new Error("the project has no service_role key");
  return key;
}

async function main() {
  const url =
    SUPABASE_URL || (SUPABASE_PROJECT_REF && `https://${SUPABASE_PROJECT_REF}.supabase.co`);
  if (!url || (!SUPABASE_SERVICE_ROLE_KEY && !SUPABASE_ACCESS_TOKEN)) {
    console.log("No Supabase project configured: nothing to do.");
    return;
  }
  const key = SUPABASE_SERVICE_ROLE_KEY || (await serviceKey());
  const root = fileURLToPath(new URL("..", import.meta.url));
  const { module } = await runnerImport(`${root}scripts/award-trophies.ts`, {
    configFile: false,
    root,
    logLevel: "error",
    resolve: { alias: { "@": `${root}src` } },
  });
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  for (const report of await module.awardTrophies(client)) console.log(report);
}

await main();
