import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { test } from "@playwright/test";

import { newPlayer, signUp } from "../e2e/players";
import { sql } from "../src/infra/contract/database";

/**
 * Screenshots of the pages a pull request touches (#454), at 390 px, light and dark, signed in as
 * an invented admin on the seeded data. Writes the PNGs and a `routes.md` summary to UI_SHOTS_DIR.
 */
const out = process.env.UI_SHOTS_DIR ?? "ui-shots-out";
const base = process.env.UI_SHOTS_BASE ?? "origin/main";
const competition = process.env.COMPETITION_SLUG ?? "ultimate-championship-2026";
// ponytail: a cap, not a priority order; raise it if PRs routinely touch more pages.
const MAX_ROUTES = 8;

/** The route of the page a file of src/app belongs to: the nearest folder above it with a page. */
function routeOf(file: string): string | undefined {
  for (let dir = dirname(file); dir.startsWith("src/app"); dir = dirname(dir)) {
    if (existsSync(join(dir, "page.tsx"))) {
      const route = dir.slice("src/app".length).replace(/\/\([^)]+\)/g, "");
      return route || "/";
    }
  }
  return undefined;
}

/** The files of src/app containing the text (git grep exits 1 when none does). */
function gitGrep(text: string): string[] {
  try {
    return execFileSync("git", ["grep", "-l", "-F", text, "--", "src/app"], { encoding: "utf8" })
      .split("\n")
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** The pages touched by the diff: its app files, and the app files importing its components. */
function touchedRoutes(): string[] {
  const files = execFileSync("git", ["diff", "--name-only", `${base}...HEAD`], { encoding: "utf8" })
    .split("\n")
    .filter((f) => existsSync(f));
  const appFiles = files.filter((f) => f.startsWith("src/app/"));
  for (const component of files.filter(
    (f) => /^src\/components\/.*\.tsx$/.test(f) && !f.includes(".stories."),
  )) {
    const importPath = "@/" + component.slice("src/".length).replace(/\.tsx$/, "");
    appFiles.push(...gitGrep(`"${importPath}"`));
  }
  return [...new Set(appFiles.map(routeOf).filter((r): r is string => r !== undefined))].sort();
}

/** Values for the dynamic segments, keyed by the segment and the one before it (/admin/competitions/[slug]
 * is "competitions/[slug]"). Undefined: the page is listed as not captured. */
function segmentValue(parent: string, segment: string, email: string): string | undefined {
  const league = () =>
    sql(`select l.id || ' ' || l.invite_code from leagues l join auth.users u on u.id = l.owner_id
         where u.email = '${email}'`).split(" ");
  switch (`${parent}/${segment}`) {
    case "competitions/[slug]":
    case "admin/[slug]":
      return competition;
    case "epreuves/[slug]":
      return sql(`select e.slug from events e join competitions c on c.id = e.competition_id
                  where c.slug = '${competition}' order by e.lock_at limit 1`);
    case "athletes/[slug]":
      return sql(`select slug from athletes order by slug limit 1`);
    case "ligues/[id]":
      return league()[0];
    case "rejoindre/[code]":
      return league()[1];
    default:
      return undefined;
  }
}

function resolve(route: string, email: string): string | undefined {
  const parts = route.split("/");
  for (let i = 1; i < parts.length; i++) {
    if (!parts[i].startsWith("[")) continue;
    const value = segmentValue(parts[i - 1], parts[i], email);
    if (!value) return undefined;
    parts[i] = value;
  }
  return parts.join("/");
}

const fileName = (route: string) =>
  route === "/" ? "accueil" : route.slice(1).replace(/[^a-z0-9]+/gi, "-");

test("screenshots of the touched pages", async ({ page }) => {
  test.setTimeout(10 * 60_000);
  mkdirSync(out, { recursive: true });
  const routes = touchedRoutes();
  const lines: string[] = [];
  if (routes.length === 0) {
    writeFileSync(join(out, "routes.md"), "");
    return;
  }

  const admin = newPlayer("shots");
  await page.goto("/connexion");
  await signUp(page, admin);
  sql(`update profiles set is_admin = true where pseudo = '${admin.pseudo}'`);
  sql(`with u as (select id from auth.users where email = '${admin.email}'),
    l as (insert into leagues (name, owner_id) select 'Ligue des captures', id from u returning id, owner_id)
    insert into league_members (league_id, user_id, role) select id, owner_id, 'owner' from l`);

  for (const route of routes.slice(0, MAX_ROUTES)) {
    const url = resolve(route, admin.email);
    if (!url) {
      lines.push(`- \`${route}\` : pas de valeur d'exemple pour ce segment, page non capturée.`);
      continue;
    }
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(url);
      await page.waitForLoadState("networkidle");
      await page.screenshot({
        path: join(out, `${fileName(route)}-${scheme}.png`),
        fullPage: true,
      });
    }
    lines.push(`- \`${url}\` : ${fileName(route)}`);
  }
  if (routes.length > MAX_ROUTES)
    lines.push(`- … et ${routes.length - MAX_ROUTES} autres pages, non capturées.`);
  writeFileSync(join(out, "routes.md"), lines.join("\n") + "\n");
  // Keeps the summary readable in the job log too.
  console.log(readFileSync(join(out, "routes.md"), "utf8"));
});
