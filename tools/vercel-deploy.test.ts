import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { expect, it } from "vitest";

const script = resolve("ci/vercel-deploy.sh");
const executable = (path: string, body: string) => {
  writeFileSync(path, `#!/usr/bin/env bash\n${body}\n`);
  chmodSync(path, 0o755);
};

// Production deployments the fake API lists, newest first: the one just made, then the previous.
const listed = JSON.stringify({
  deployments: [
    { uid: "dpl_new", url: "french-track-abc.vercel.app" },
    { uid: "dpl_previous", url: "french-track-old.vercel.app" },
  ],
});

// Runs the deploy script with a fake Vercel CLI (npx), a fake curl (the Vercel REST API), a fake
// gh and a fake smoke test. `pulled` is the environment file `vercel pull` writes; `smoke` is the
// smoke test's exit code; `apiStatus` is the HTTP status the fake API answers.
function deploy({
  pulled,
  smoke,
  extra,
  apiStatus = 200,
}: {
  pulled: string;
  smoke: number;
  extra?: string;
  apiStatus?: number;
}) {
  const root = mkdtempSync(join(tmpdir(), "vercel-deploy-"));
  const bin = join(root, "bin");
  mkdirSync(bin);
  const calls = join(root, "calls");
  writeFileSync(calls, "");
  executable(
    join(bin, "npx"),
    `shift 2  # --yes vercel@latest
echo "vercel $*" >> "${calls}"
case "$1" in
  pull) mkdir -p .vercel && printf '%s' "$PULLED" > .vercel/.env.production.local ;;
  build) cp .vercel/.env.production.local "${root}/built-env" ;;
  deploy) echo "https://french-track-abc.vercel.app" ;;
esac`,
  );
  // Records the method and URL (never the headers), writes the body to -o, prints -w's status.
  executable(
    join(bin, "curl"),
    `method=GET; out=""; url=""
while [ $# -gt 0 ]; do
  case "$1" in
    -X) method=$2; shift ;;
    -o) out=$2; shift ;;
    -H|-w) shift ;;
    -*) ;;
    *) url=$1 ;;
  esac
  shift
done
echo "curl $method $url" >> "${calls}"
if [ "$method" = GET ]; then printf '%s' '${listed}' > "$out"; else printf '{}' > "$out"; fi
printf '%s' "$API_STATUS"`,
  );
  // One line per call, even for a multi-line issue body.
  executable(join(bin, "gh"), `args="$*"; echo "gh \${args//$'\\n'/ }" >> "${calls}"`);
  executable(join(root, "smoke.sh"), `echo "smoke $*" >> "${calls}"; exit ${smoke}`);
  const run = spawnSync("bash", [script, "https://www.example.test"], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      PULLED: pulled,
      API_STATUS: String(apiStatus),
      SMOKE_TEST: join(root, "smoke.sh"),
      VERCEL_TOKEN: "token-secret-value",
      VERCEL_ORG_ID: "team_abc",
      VERCEL_PROJECT_ID: "prj_abc",
      GH_TOKEN: "x",
      GITHUB_REPOSITORY: "owner/repo",
      GITHUB_RUN_ID: "99",
      AGENTS_OWNER: "alice bob",
      ...(extra ? { VERCEL_EXTRA_ENV: extra } : {}),
    },
  });
  return {
    status: run.status,
    output: run.stdout + run.stderr,
    calls: readFileSync(calls, "utf8").trim().split("\n"),
    builtEnv: () => readFileSync(join(root, "built-env"), "utf8"),
  };
}

const complete = `NEXT_PUBLIC_SUPABASE_URL="https://ref.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="anon-secret-value"
`;

it("builds, deploys straight to the domains and smoke-tests when the environment is complete", () => {
  const run = deploy({ pulled: complete, smoke: 0 });

  expect(run.status).toBe(0);
  expect(run.calls.map((c) => c.split(" ").slice(0, 2).join(" "))).toEqual([
    "vercel pull",
    "vercel build",
    "vercel deploy",
    "smoke https://www.example.test",
  ]);
  // `vercel promote` answered "User not found" with the project token (#731).
  expect(run.calls[2]).toContain("--prod");
  expect(run.calls[2]).not.toContain("--skip-domain");
});

it("stops before the build when a Supabase variable is missing, naming it without any value", () => {
  const run = deploy({
    pulled: `NEXT_PUBLIC_SUPABASE_URL="https://ref.supabase.co"\nNEXT_PUBLIC_SUPABASE_ANON_KEY=""\n`,
    smoke: 0,
  });

  expect(run.status).not.toBe(0);
  expect(run.calls).toEqual([expect.stringMatching(/^vercel pull/)]);
  expect(run.output).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  expect(run.output).not.toContain("NEXT_PUBLIC_SUPABASE_URL");
  expect(run.output).not.toContain("ref.supabase.co");
});

it("rolls production back through the Vercel API and opens an issue when the smoke test fails", () => {
  const run = deploy({ pulled: complete, smoke: 1 });

  expect(run.status).not.toBe(0);
  // `vercel rollback` fails like `promote` with the project token (#735).
  expect(run.calls).not.toContainEqual(expect.stringMatching(/^vercel (rollback|promote)/));
  expect(run.calls.filter((c) => c.startsWith("curl"))).toEqual([
    "curl GET https://api.vercel.com/v6/deployments?projectId=prj_abc&target=production&state=READY&limit=20&teamId=team_abc",
    "curl POST https://api.vercel.com/v9/projects/prj_abc/rollback/dpl_previous?teamId=team_abc",
  ]);
  const issue = run.calls.find((c) => c.startsWith("gh issue create")) ?? "";
  expect(issue).toContain("-R owner/repo");
  expect(issue).toContain("@alice @bob");
  expect(issue).toContain("https://github.com/owner/repo/actions/runs/99");
  expect(issue).toContain("Retour au déploiement précédent : oui.");
  expect(run.output).not.toContain("anon-secret-value");
  expect(run.output).not.toContain("token-secret-value");
});

it("tells the owners the rollback failed when the Vercel API answers an HTTP error", () => {
  const run = deploy({ pulled: complete, smoke: 1, apiStatus: 403 });

  expect(run.status).not.toBe(0);
  expect(run.output).toContain("::error::Vercel API: GET /v6/deployments answered HTTP 403");
  expect(run.calls).not.toContainEqual(expect.stringMatching(/^curl POST/));
  const issue = run.calls.find((c) => c.startsWith("gh issue create")) ?? "";
  expect(issue).toContain("Retour au déploiement précédent : non");
  expect(run.output).not.toContain("token-secret-value");
});

it("adds the extra build variables to the pulled environment (pre-production's noindex)", () => {
  const run = deploy({ pulled: complete, smoke: 0, extra: "NEXT_PUBLIC_SITE_NOINDEX=1" });

  expect(run.status).toBe(0);
  expect(run.builtEnv()).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY=");
  expect(run.builtEnv()).toMatch(/^NEXT_PUBLIC_SITE_NOINDEX=1$/m);
});
