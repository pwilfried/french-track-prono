import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sqlScript } from "./contract/database";

// The owner's account in pre-production (#769): ci/preprod/owner.sh guards, then the SQL it sends,
// run twice on local Supabase after the demo set, in one transaction that is rolled back.
const preprodRef = "flezuosnpafwcnoubdiu";
const email = "owner-769@example.test";

function runOwner(env: Record<string, string>) {
  const result = spawnSync("bash", ["ci/preprod/owner.sh"], {
    encoding: "utf8",
    // Only what the script reads: the runner's own PREPROD_OWNER_EMAIL or token never leaks in.
    env: { NODE_ENV: "test", PATH: process.env.PATH ?? "", PREPROD_OWNER_DRY_RUN: "1", ...env },
  });
  return { status: result.status, out: `${result.stdout}${result.stderr}` };
}

describe("pre-production owner account script", () => {
  it("is skipped with a warning when the e-mail secret is missing", () => {
    const { status, out } = runOwner({ SUPABASE_PROJECT_REF: preprodRef });

    expect(status).toBe(0);
    expect(out).toContain("::warning::PREPROD_OWNER_EMAIL");
    expect(out).not.toContain("set_config");
  });

  it("refuses a project that is not pre-production", () => {
    const { status, out } = runOwner({
      PREPROD_OWNER_EMAIL: email,
      SUPABASE_PROJECT_REF: "productionref0000000",
    });

    expect(status).toBe(1);
    expect(out).toContain("::error::SUPABASE_PROJECT_REF");
    expect(out).not.toContain("set_config");
  });

  it("refuses an e-mail that could break out of the SQL string", () => {
    const { status, out } = runOwner({
      PREPROD_OWNER_EMAIL: "x'); drop table profiles; --@example.test",
      SUPABASE_PROJECT_REF: preprodRef,
    });

    expect(status).toBe(1);
    expect(out).toContain("::error::PREPROD_OWNER_EMAIL");
    expect(out).not.toContain("drop table");
  });

  it("masks the e-mail in the logs and sets it before the owner SQL", () => {
    const { status, out } = runOwner({
      PREPROD_OWNER_EMAIL: email,
      SUPABASE_PROJECT_REF: preprodRef,
    });

    expect(status).toBe(0);
    expect(out).toContain(`::add-mask::${email}`);
    expect(out).toContain(`select set_config('preprod.owner_email', '${email}', false);`);
    expect(out).toContain("insert into league_members");
  });
});

const demo = readFileSync("supabase/preprod/demo.sql", "utf8");
const strip = (sql: string) => sql.replace(/^begin;$/m, "").replace(/^commit;$/m, "");

function ownerSql(): string {
  const { out } = runOwner({ PREPROD_OWNER_EMAIL: email, SUPABASE_PROJECT_REF: preprodRef });
  return strip(
    out
      .split("\n")
      .filter((line) => !line.startsWith("::"))
      .join("\n"),
  );
}

const owner = `(select id from auth.users where email = '${email}')`;
const counts = `select json_build_object(
  'accounts', (select count(*) from auth.users where email = '${email}'),
  'admin', (select is_admin from profiles where id = ${owner}),
  'pseudo', (select pseudo from profiles where id = ${owner}),
  'leagues', (select count(*) from leagues where is_official),
  'memberships', (select count(*) from league_members where user_id = ${owner}),
  'managerLeagues', (select count(*) from manager_leagues),
  'managerMemberships', (select count(*) from manager_members where user_id = ${owner}),
  'demoMembers', (select count(*) from league_members
                  where league_id = '00000000-0000-4000-9a00-000000000002')
)::text;`;

type Counts = Record<string, number | boolean | string>;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  describe("pre-production owner account", () => {
    it("joins only the official league as an admin, once, when it runs twice", () => {
      const body = ownerSql();
      // Without the pseudo « admin » taken by someone else (local data may hold one).
      const free = `update profiles set pseudo = 'was-admin-' || left(id::text, 8)
                    where lower(pseudo) = 'admin';`;
      const output = sqlScript(
        `begin;\n${strip(demo)}\n${free}\n${body}\n${counts}\n${body}\n${counts}\nrollback;\n`,
      );
      const [first, second] = output
        .split("\n")
        .filter((line) => line.startsWith("{"))
        .map((line) => JSON.parse(line) as Counts);

      expect(second).toEqual(first);
      expect(first).toMatchObject({ accounts: 1, admin: true, pseudo: "admin" });
      expect(first!.memberships).toBe(first!.leagues);
      expect(first!.managerMemberships).toBe(0);
      // The private demo league « Club du jeudi »: its 8 players, without the owner.
      expect(first!.demoMembers).toBe(8);
    });

    it("keeps an account that already exists and makes it admin", () => {
      const body = ownerSql();
      const existing = `insert into auth.users (id, email) values
          ('00000000-0000-4000-9769-000000000001', '${email}');
        insert into profiles (id, pseudo, age_confirmed_at)
        values ('00000000-0000-4000-9769-000000000001', 'Owner 769', now());`;
      const check = `select json_build_object(
        'accounts', (select count(*) from auth.users where email = '${email}'),
        'admin', (select is_admin from profiles where id = '00000000-0000-4000-9769-000000000001')
      )::text;`;
      const output = sqlScript(`begin;\n${existing}\n${body}\n${check}\nrollback;\n`);
      const line = output.split("\n").find((l) => l.startsWith("{"))!;

      expect(JSON.parse(line)).toEqual({ accounts: 1, admin: true });
    });
  });
} else {
  describe("pre-production owner account", () => {
    const message = "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are not set";
    if (process.env.REQUIRE_SUPABASE_TESTS) {
      it("has a local Supabase configured", () => {
        throw new Error(message);
      });
    } else {
      it.skip(`is skipped: ${message}`, () => {});
    }
  });
}
