// #339: turns the clubs.csv written by fetch.mjs into SQL batches for import_clubs():
// other sports dropped, names and towns put back in normal case (rules in src/domain/club.ts).
// Usage: node scripts/clubs/import.mjs clubs.csv out-dir
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const { formatClubName, isAthleticsClubName } = await import(
  new URL("../../src/domain/club.ts", import.meta.url).href
);

const [input = "clubs.csv", out = "clubs-sql"] = process.argv.slice(2);
const BATCH = 500;

function parseCsv(text) {
  const rows = [];
  for (const line of text.split("\n").slice(1)) {
    if (!line.trim()) continue;
    const cells = [...line.matchAll(/"((?:[^"]|"")*)"/g)].map((m) => m[1].replaceAll('""', '"'));
    const [name, city, department, siren] = cells;
    rows.push({ name, city, department, siren });
  }
  return rows;
}

const all = parseCsv(readFileSync(input, "utf8"));
const kept = all
  .filter((c) => /^[0-9]{9}$/.test(c.siren ?? "") && c.name && isAthleticsClubName(c.name))
  .map((c) => ({
    name: formatClubName(c.name).slice(0, 120),
    city: formatClubName(c.city ?? ""),
    department: c.department ?? "",
    siren: c.siren,
  }));

mkdirSync(out, { recursive: true });
for (let i = 0; i * BATCH < kept.length; i += 1) {
  const json = JSON.stringify(kept.slice(i * BATCH, (i + 1) * BATCH));
  writeFileSync(
    join(out, `${String(i).padStart(3, "0")}.sql`),
    `select import_clubs($clubs$${json}$clubs$::jsonb);`,
  );
}
console.log(
  `${all.length} lignes lues, ${kept.length} clubs d'athlétisme gardés, ${all.length - kept.length} écartés`,
);
