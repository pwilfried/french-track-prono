// #314: warns the players without activity for 23 months, then deletes those still silent at
// 24 months (rules in supabase/migrations/20261109030000_inactive_accounts.sql). Run daily by the
// « Inactive accounts » workflow. Talks to the production database through the Supabase
// Management API (same secrets as the migrations) and sends the e-mails through Resend.
// Without RESEND_API_KEY nobody is warned, so nobody is deleted.
const { SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF, RESEND_API_KEY, RESEND_FROM } = process.env;
const SITE = "https://www.frenchtrackprono.com";

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

const escape = (text) =>
  text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

async function warn(player) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: player.email,
      subject: "Ton compte French Track Prono sera bientôt supprimé",
      html: `<p>Bonjour ${escape(player.pseudo)},</p>
<p>Tu ne t'es pas connecté à French Track Prono depuis bientôt 2 ans. Sans nouvelle de toi, ton
compte et tes pronos seront supprimés dans un mois, comme annoncé dans notre politique de
confidentialité.</p>
<p>Pour le garder, il suffit de te connecter : <a href="${SITE}/connexion">${SITE}/connexion</a></p>
<p>L'équipe FrenchTrack</p>`,
    }),
  });
  if (!response.ok) throw new Error(`Resend answered ${response.status}: ${await response.text()}`);
}

if (!SUPABASE_ACCESS_TOKEN || !SUPABASE_PROJECT_REF) {
  console.log("No production Supabase project configured: nothing to do.");
  process.exit(0);
}

const toWarn = await query(
  "select user_id, email, pseudo from private.inactive_accounts_to_warn()",
);
if (!RESEND_API_KEY || !RESEND_FROM) {
  console.log(
    `${toWarn.length} compte(s) à prévenir, mais pas de clé Resend : personne n'est prévenu.`,
  );
} else {
  const warned = [];
  for (const player of toWarn) {
    await warn(player);
    warned.push(player.user_id);
  }
  if (warned.length > 0) {
    const ids = warned.map((id) => `'${id.replace(/[^0-9a-f-]/g, "")}'`).join(",");
    await query(`select private.mark_inactivity_warned(array[${ids}]::uuid[])`);
  }
  console.log(`${warned.length} compte(s) prévenu(s).`);
}

const [{ purge_inactive_accounts: deleted }] = await query(
  "select private.purge_inactive_accounts()",
);
console.log(`${deleted} compte(s) supprimé(s).`);
