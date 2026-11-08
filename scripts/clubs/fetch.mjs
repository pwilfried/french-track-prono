// Spike #337: the athletics clubs found by the State's company API (recherche-entreprises.api.gouv.fr,
// open, no key, 7 calls per second). Sports clubs (NAF 93.12Z) still active whose name evokes
// athletics. Writes clubs.csv (name, city, department, SIREN) and prints a summary.
// Usage: node scripts/clubs/fetch.mjs [out.csv]
import { writeFileSync } from "node:fs";

const API = "https://recherche-entreprises.api.gouv.fr/search";
const QUERIES = ["athletisme", "athletique", "athletic", "athle", "running club", "jogging"];
const PER_PAGE = 25;
const MAX_PAGES = 400; // the API stops at 10 000 results per query
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function page(q, n) {
  const url = new URL(API);
  url.search = new URLSearchParams({
    q,
    activite_principale: "93.12Z",
    etat_administratif: "A",
    page: String(n),
    per_page: String(PER_PAGE),
  }).toString();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, { headers: { accept: "application/json" } });
    if (response.status === 429) {
      await pause(2000);
      continue;
    }
    if (!response.ok) throw new Error(`${url} answered ${response.status}`);
    return response.json();
  }
  throw new Error(`${url}: too many requests`);
}

const clubs = new Map();
for (const q of QUERIES) {
  let total = 0;
  for (let n = 1; n <= MAX_PAGES; n += 1) {
    const body = await page(q, n);
    total = body.total_results ?? 0;
    for (const r of body.results ?? []) {
      if (clubs.has(r.siren)) continue;
      clubs.set(r.siren, {
        name: r.nom_complet ?? r.nom_raison_sociale ?? "",
        city: r.siege?.libelle_commune ?? "",
        department: r.siege?.departement ?? "",
        siren: r.siren,
      });
    }
    if (n >= (body.total_pages ?? 1)) break;
    await pause(160); // stays under 7 calls per second
  }
  console.log(`« ${q} » : ${total} résultats`);
}

const csv = (value) => `"${String(value).replaceAll('"', '""')}"`;
const rows = [...clubs.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));
const out = process.argv[2] ?? "clubs.csv";
writeFileSync(
  out,
  [
    "name,city,department,siren",
    ...rows.map((c) => [c.name, c.city, c.department, c.siren].map(csv).join(",")),
  ].join("\n"),
);
console.log(`${rows.length} clubs distincts écrits dans ${out}`);
const byDepartment = new Map();
for (const c of rows) byDepartment.set(c.department, (byDepartment.get(c.department) ?? 0) + 1);
console.log(`${byDepartment.size} départements couverts`);
console.log(
  "Échantillon :",
  rows
    .filter((_, i) => i % Math.max(1, Math.floor(rows.length / 15)) === 0)
    .map((c) => `${c.name} (${c.city})`)
    .join(" · "),
);
