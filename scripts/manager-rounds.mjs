// #423: closes the bidding rounds of the French Track Manager mercato whose time is over and
// awards the athletes (rules in supabase/migrations/20261111170000_manager_awards.sql), then closes
// the mercatos due (#424, 20261111190000_manager_mercato_close.sql). Run every
// 5 minutes by the « Manager rounds » workflow; running it again closes nothing twice. Talks to the
// production database through the Supabase Management API (same secrets as the migrations).
const { SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF } = process.env;

async function main() {
  if (!SUPABASE_ACCESS_TOKEN || !SUPABASE_PROJECT_REF) {
    console.log("No production database: nothing to close.");
    return;
  }
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: "select private.close_manager_rounds() as closed" }),
    },
  );
  // A failed close makes the run fail: GitHub e-mails the owner.
  if (!response.ok)
    throw new Error(`database answered ${response.status}: ${await response.text()}`);
  const [{ closed }] = await response.json();
  console.log(`${closed} tour(s) d'enchères clôturé(s).`);
}

await main();
